# Direct Messaging (DM) Developer Headstart Guide

**Owner:** You (DM Lead)  
**Teammate:** Group Chat Lead ([Group Chat Guide](./groupchat.md))  
**Milestone:** 1 (Core Text Chat & Real-User Testing)  
**Parent Plan:** [Chat Layer Implementation Plan](./chat-layer-plan.md)

---

## 1. What You Own This Week

As the DM Lead, your goal this week is to deliver a rock-solid, real-time 1:1 direct messaging experience between two workspace members.

### In Scope
1. **Canonical DM Creation & Retrieval**: Opening a DM thread between the current user and any workspace member (guaranteeing exactly one thread per user pair).
2. **DM Message Persistence**: Storing messages using the unified `Message` table with monotonic sequence numbering and client-generated idempotency.
3. **Real-Time 1:1 Delivery**: Emitting and receiving real-time messages via Socket.IO across devices and tabs.
4. **Read Receipts & Unread Badges**: Updating `lastReadSequence` and notifying the other user in real time.
5. **Typing Indicators**: 1:1 ephemeral typing indicator with debouncing.
6. **Reconnection & Catch-Up**: Gap-free sync when coming back online.

---

## 2. Shared Data Model You Will Use

You are **not** building a separate `DirectMessage` table. You are consuming the unified chat models:

```prisma
model Conversation {
  id             String           @id @default(uuid())
  workspaceId    String
  type           ConversationType @default(DIRECT)
  
  // Format: "${workspaceId}:${minUserId}:${maxUserId}"
  // Enforces strictly ONE DM conversation per user-pair in a workspace!
  canonicalDmKey String?          @unique

  lastSequence   Int              @default(0)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  workspace      Workspace        @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  members        ConversationMember[]
  messages       Message[]
}

model ConversationMember {
  id               String                 @id @default(uuid())
  conversationId   String
  userId           String
  role             ConversationMemberRole @default(MEMBER)
  lastReadSequence Int                    @default(0)
  joinedAt         DateTime               @default(now())

  conversation     Conversation           @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user             User                   @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([conversationId, userId])
}

model Message {
  id              String       @id @default(uuid())
  conversationId  String
  senderId        String
  clientMessageId String       // Client UUID for deduplication
  sequence        Int          // 1, 2, 3... per conversation
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

## 3. The Canonical DM Key (Preventing Duplicate DMs)

When Alice opens a chat with Bob, or Bob opens a chat with Alice, both must open the **exact same conversation record**.

### Canonical Key Generator Function
Create this utility in `apps/api/src/modules/chat/conversation/conversation.utils.ts`:

```typescript
export function getCanonicalDmKey(workspaceId: string, userAId: string, userBId: string): string {
  const sortedUserIds = [userAId, userBId].sort();
  return `${workspaceId}:${sortedUserIds[0]}:${sortedUserIds[1]}`;
}
```

### Get or Create DM Service Flow

```typescript
export async function getOrCreateDirectMessage(
  workspaceId: string,
  currentUserId: string,
  recipientUserId: string
) {
  if (currentUserId === recipientUserId) {
    throw new AppError(400, "CANNOT_DM_SELF");
  }

  // 1. Verify recipient is an active member of this workspace
  const isMember = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: recipientUserId, workspaceId } },
  });
  if (!isMember) {
    throw new AppError(404, "RECIPIENT_NOT_IN_WORKSPACE");
  }

  const canonicalDmKey = getCanonicalDmKey(workspaceId, currentUserId, recipientUserId);

  // 2. Atomic find or create
  const conversation = await prisma.conversation.upsert({
    where: { canonicalDmKey },
    update: {},
    create: {
      workspaceId,
      type: "DIRECT",
      canonicalDmKey,
      members: {
        create: [
          { userId: currentUserId, role: "MEMBER" },
          { userId: recipientUserId, role: "MEMBER" },
        ],
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

## 4. REST API Contracts (DM Lead)

Mount your router at: `/api/v1/workspaces/:workspaceSlug/chat/dms`

### 1. Open / Get DM Thread
* **Endpoint:** `POST /api/v1/workspaces/:workspaceSlug/chat/dms`
* **Request Body:**
  ```json
  {
    "recipientUserId": "usr_bob123"
  }
  ```
* **Response (200 / 201):**
  ```json
  {
    "success": true,
    "data": {
      "conversationId": "conv_uuid",
      "type": "DIRECT",
      "partner": {
        "id": "usr_bob123",
        "name": "Bob Vance",
        "imageUrl": "https://...",
        "isOnline": true
      },
      "lastReadSequence": 18,
      "lastSequence": 24,
      "unreadCount": 6
    }
  }
  ```

### 2. Fetch DM Message History
* **Endpoint:** `GET /api/v1/workspaces/:workspaceSlug/chat/dms/:conversationId/messages`
* **Query Parameters:**
  - `beforeSequence` (optional, integer): For scrolling back in history.
  - `limit` (optional, default: 50, max: 100).
* **Response:**
  ```json
  {
    "success": true,
    "data": {
      "messages": [
        {
          "id": "msg_001",
          "sequence": 24,
          "content": "Hey Bob, do you have a moment?",
          "senderId": "usr_alice",
          "createdAt": "2026-09-21T18:40:00Z"
        }
      ],
      "hasMore": false,
      "oldestSequence": 1,
      "newestSequence": 24
    }
  }
  ```

### 3. Send Message (REST Fallback / Standard)
* **Endpoint:** `POST /api/v1/workspaces/:workspaceSlug/chat/dms/:conversationId/messages`
* **Request Body:**
  ```json
  {
    "clientMessageId": "a59600e1-7cb2-47d3-9bc2-3db3ad69aa4b",
    "content": "Sure, let's catch up!"
  }
  ```

### 4. Mark Read Cursor
* **Endpoint:** `POST /api/v1/workspaces/:workspaceSlug/chat/dms/:conversationId/read`
* **Request Body:**
  ```json
  {
    "sequence": 24
  }
  ```

---

## 5. Real-Time Socket.IO Integration for DMs

Hermes already validates JWT cookies in `socketMiddleware` and attaches `socket.data.userId`.

### Socket Handshake & Rooms
When a client connects:
1. The socket auto-joins its own personal room:
   ```typescript
   socket.join(`user:${socket.data.userId}`);
   ```
2. When the user opens a DM with Bob, the client emits:
   ```typescript
   socket.emit("chat:join", { conversationId });
   ```
   The server verifies membership and calls `socket.join(`conversation:${conversationId}`)`.

### Real-Time Event Flows

#### A. Sending a Message
```typescript
// On message created & persisted in DB:
const message = await messageService.createMessage({
  conversationId,
  senderId: userId,
  clientMessageId,
  content,
});

// 1. Broadcast to active viewers in the conversation room
io.to(`conversation:${conversationId}`).emit("chat:message_created", { message });

// 2. Also notify the recipient's personal room for unread badges & alerts:
io.to(`user:${recipientUserId}`).emit("chat:new_dm_alert", {
  conversationId,
  senderId: userId,
  snippet: content.slice(0, 80),
  sequence: message.sequence,
});
```

#### B. 1:1 Typing Indicator (Ephemeral)
```typescript
socket.on("chat:typing", ({ conversationId, isTyping }) => {
  // Broadcast to other member in conversation room, excluding sender
  socket.to(`conversation:${conversationId}`).emit("chat:typing", {
    conversationId,
    userId: socket.data.userId,
    isTyping,
  });
});
```

#### C. Read Receipt Update
```typescript
socket.on("chat:read", async ({ conversationId, sequence }) => {
  await conversationService.updateLastRead(conversationId, socket.data.userId, sequence);
  
  // Notify other member so their UI shows "Read"
  socket.to(`conversation:${conversationId}`).emit("chat:read_update", {
    conversationId,
    userId: socket.data.userId,
    lastReadSequence: sequence,
  });
});
```

---

## 6. Day-by-Day Implementation Roadmap (This Week)

| Day | Focus | Target Deliverables |
| :--- | :--- | :--- |
| **Day 1** | **Schema & DM Service** | Run Prisma migration. Implement `getCanonicalDmKey` and `getOrCreateDirectMessage`. Write tests proving two users get the exact same conversation ID. |
| **Day 2** | **Message Persistence & Idempotency** | Implement atomic sequence allocation (`lastSequence + 1`) and `(senderId, clientMessageId)` deduplication in PostgreSQL. |
| **Day 3** | **History & Cursor Pagination** | Implement `GET /messages` with `beforeSequence` and catch-up `afterSequence`. Test message ordering. |
| **Day 4** | **Socket.IO Delivery & Multi-Tab Sync** | Wire `chat:message_created`, `user:<userId>` room fanout. Open two tabs on Account A and verify instant cross-tab sync. |
| **Day 5** | **Read Receipts & Real-User Test** | Wire `chat:read` and unread counters. Pair with the Group Chat lead for combined testing. |

---

## 7. Next Steps
Coordinate with your teammate: they will build `POST /group` and group membership using the **exact same `Message` and `Conversation` models**. Make sure both of you use the shared `MessageService.createMessage` function!
