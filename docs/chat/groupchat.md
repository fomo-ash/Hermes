# Group Chat Developer Headstart Guide

**Owner:** Teammate (Group Chat Lead)  
**Teammate:** DM Lead ([Direct Messaging Guide](./dm.md))  
**Milestone:** 1 (Core Text Chat & Real-User Testing)  
**Parent Plan:** [Chat Layer Implementation Plan](./chat-layer-plan.md)

---

## 1. What You Own This Week

As the Group Chat Lead, your goal this week is to deliver multi-user group conversations within workspaces, handling group creation, membership roles, multi-member message fan-out, and unread counts.

### In Scope
1. **Group Conversation Lifecycle**: Creating groups, updating title/description, and fetching group metadata.
2. **Membership & Roles**: Adding members, removing members, and handling user self-leave (`OWNER`, `ADMIN`, `MEMBER` permissions).
3. **Group Message Fan-Out**: Reusing the shared message service to persist messages and broadcast them to all online members.
4. **Group Read State & Unread Counts**: Tracking each member's individual `lastReadSequence` and rendering unread message badges.
5. **Group Typing Indicators**: Handling multi-user typing indicators gracefully.
6. **Authorization Gates**: Ensuring non-members or removed users are immediately blocked from sending or reading group messages.

---

## 2. Shared Data Model You Will Use

You are **not** building a separate `Channel` or `ChannelMessage` table. You use the unified chat models:

```prisma
model Conversation {
  id             String           @id @default(uuid())
  workspaceId    String
  type           ConversationType @default(GROUP) // GROUP
  title          String?          // Group name e.g. "Engineering"
  canonicalDmKey String?          @unique // NULL for group conversations
  lastSequence   Int              @default(0)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  workspace      Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  members        ConversationMember[]
  messages       Message[]

  @@index([workspaceId])
  @@index([workspaceId, type])
}

model ConversationMember {
  id               String                 @id @default(uuid())
  conversationId   String
  userId           String
  role             ConversationMemberRole @default(MEMBER) // OWNER | ADMIN | MEMBER
  lastReadSequence Int                    @default(0)
  joinedAt         DateTime               @default(now())

  conversation     Conversation           @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
  @@index([userId])
  @@index([conversationId])
}

model Message {
  id              String       @id @default(uuid())
  conversationId  String
  senderId        String
  clientMessageId String       // Client UUID for retry idempotency
  sequence        Int          // Monotonic sequence (1, 2, 3...)
  content         String       @db.Text
  deleted         Boolean      @default(false)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender          User         @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@unique([conversationId, sequence])
  @@unique([senderId, clientMessageId])
}
```

---

## 3. Group Lifecycle & Permission Rules

### Roles
- **`OWNER`**: The creator of the group chat. Can rename, delete group, add/remove members, and promote members to `ADMIN`.
- **`ADMIN`**: Can add and remove regular members.
- **`MEMBER`**: Can read, send messages, and leave the group.

### Service Example: Create Group Conversation

Create this in `apps/api/src/modules/chat/group/group.service.ts`:

```typescript
export async function createGroupConversation({
  workspaceId,
  creatorUserId,
  title,
  memberUserIds,
}: {
  workspaceId: string;
  creatorUserId: string;
  title: string;
  memberUserIds: string[];
}) {
  // 1. Validate all invited user IDs are active members of this workspace
  const uniqueMemberIds = Array.from(new Set([creatorUserId, ...memberUserIds]));
  
  const validMembers = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      userId: { in: uniqueMemberIds },
    },
    select: { userId: true },
  });

  if (validMembers.length !== uniqueMemberIds.length) {
    throw new AppError(400, "SOME_USERS_ARE_NOT_WORKSPACE_MEMBERS");
  }

  // 2. Create the conversation and add members in a single transaction
  const conversation = await prisma.conversation.create({
    data: {
      workspaceId,
      type: "GROUP",
      title,
      canonicalDmKey: null,
      members: {
        create: uniqueMemberIds.map((userId) => ({
          userId,
          role: userId === creatorUserId ? "OWNER" : "MEMBER",
        })),
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, imageUrl: true },
          },
        },
      },
    },
  });

  return conversation;
}
```

---

## 4. REST API Contracts (Group Chat Lead)

Mount your router at: `/api/v1/workspaces/:workspaceSlug/chat/groups`

### 1. Create Group Conversation
* **Endpoint:** `POST /api/v1/workspaces/:workspaceSlug/chat/groups`
* **Request Body:**
  ```json
  {
    "title": "Backend Engineering",
    "memberUserIds": ["usr_123", "usr_456"]
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": "conv_group_uuid",
      "type": "GROUP",
      "title": "Backend Engineering",
      "memberCount": 3,
      "myRole": "OWNER",
      "lastSequence": 0,
      "unreadCount": 0
    }
  }
  ```

### 2. List User's Groups in Workspace
* **Endpoint:** `GET /api/v1/workspaces/:workspaceSlug/chat/groups`
* **Response (200 OK):**
  Returns all group conversations that the authenticated user is currently a member of, with title, member count, and unread count.

### 3. Add Members to Group
* **Endpoint:** `POST /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId/members`
* **Authorization:** Requires caller to be `OWNER` or `ADMIN`.
* **Request Body:**
  ```json
  {
    "userIds": ["usr_789"]
  }
  ```

### 4. Remove Member from Group
* **Endpoint:** `DELETE /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId/members/:userId`
* **Authorization:** Requires caller to be `OWNER` or `ADMIN` (or user removing themselves).

### 5. Send Message to Group
* **Endpoint:** `POST /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId/messages`
* **Shared Logic:** Delegates to the shared `MessageService.createMessage`! Verifies membership before inserting.

---

## 5. Real-Time Socket.IO Integration for Groups

### Joining Group Room
When a client opens the group chat view:
```typescript
socket.on("chat:join", async ({ conversationId }) => {
  // Check DB to ensure socket.data.userId is a valid ConversationMember
  const isMember = await conversationRepo.isMember(conversationId, socket.data.userId);
  if (!isMember) {
    return socket.emit("chat:error", { message: "NOT_A_MEMBER" });
  }

  socket.join(`conversation:${conversationId}`);
});
```

### Group Message Fan-Out
When a message is sent in the group:
```typescript
// 1. Broadcast to everyone actively viewing the channel room:
io.to(`conversation:${conversationId}`).emit("chat:message_created", { message });

// 2. Fan out unread badge notification to other group members' personal rooms:
const members = await conversationRepo.getMembers(conversationId);
for (const member of members) {
  if (member.userId !== senderUserId) {
    io.to(`user:${member.userId}`).emit("chat:unread_badge", {
      conversationId,
      sequence: message.sequence,
    });
  }
}
```

### Group Typing Indicators (Throttling)
Because groups have multiple users, debounce typing events:
```typescript
// Client sends typing:
socket.emit("chat:typing", { conversationId, isTyping: true });

// Server broadcasts to conversation room (excluding sender):
socket.to(`conversation:${conversationId}`).emit("chat:typing", {
  conversationId,
  userId: socket.data.userId,
  isTyping: true,
});
```
*Frontend Tip:* Aggregate typing indicators:
- 1 user: `"Alice is typing..."`
- 2 users: `"Alice and Bob are typing..."`
- 3+ users: `"Alice, Bob, and 2 others are typing..."`

---

## 6. Computing Unread Counts Efficiently

To show an unread badge on each group in the sidebar:

$$\text{Unread Count} = \max(0, \text{Conversation.lastSequence} - \text{ConversationMember.lastReadSequence})$$

Because both `lastSequence` and `lastReadSequence` are monotonic integers, computing unread count requires **zero table scans of the `Message` table**! It is a simple $O(1)$ integer subtraction:

```typescript
const unreadCount = Math.max(0, conversation.lastSequence - member.lastReadSequence);
```

When the user scrolls to the bottom of the group, send:
```typescript
socket.emit("chat:read", {
  conversationId,
  sequence: conversation.lastSequence,
});
```

---

## 7. Day-by-Day Implementation Roadmap (This Week)

| Day | Focus | Target Deliverables |
| :--- | :--- | :--- |
| **Day 1** | **Group Models & Creation API** | Implement `POST /groups` and `GET /groups`. Verify members are stored in `ConversationMember`. |
| **Day 2** | **Membership Management** | Implement Add Member, Remove Member, and Leave Group. Enforce `OWNER` / `ADMIN` permissions. |
| **Day 3** | **Group Messaging Integration** | Connect group endpoints to the shared `MessageService` written by the DM lead. Verify message sequence numbers. |
| **Day 4** | **Socket Fan-Out & Group Typing** | Broadcast `chat:message_created` across all connected group members. Test with 3 simultaneous browser sessions. |
| **Day 5** | **Unread Tracking & Combined Testing** | Verify integer unread count subtraction. Run end-to-end multi-user group chat verification with the DM lead. |

---

## 8. Coordination with DM Lead

- **Database Schema**: Make sure both of you run the same Prisma migration containing the unified models.
- **Message Persistence**: You both use the same `Message` table and `MessageService.createMessage` logic.
- **Event Names**: Agree on standard names: `chat:join`, `chat:leave`, `chat:message_created`, `chat:typing`, `chat:read`.
