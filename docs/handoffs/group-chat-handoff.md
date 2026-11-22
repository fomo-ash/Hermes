# 🤝 Group Chat Developer Handoff Guide

**Author:** Harshit (Core Chat & DM Lead)  
**Target Audience:** Teammate (Group Chat & RBAC Lead)  
**Parent Plan:** [Chat Layer Implementation Plan](../chat/chat-layer-plan.md)  
**Reference Architecture:** [Direct Messaging & Messaging Engine Guide](../chat/dm.md)  

---

## 1. Executive Summary & Context

Welcome! The core messaging engine for Hermes is **fully implemented and verified**.

Here is the most important architectural takeaway before you write any code:

> 🚀 **The Golden Rule:**  
> **You do NOT need to implement message sending, message history, sequence allocation, or read tracking.**  
> The unified messaging engine inside `apps/api/src/modules/chat/conversation/` handles 100% of the message lifecycle (persistence, atomic sequence increments, idempotency, cursor pagination, monotonic read tracking, and Socket.IO emission) for **BOTH Direct Messages and Group Chats**.
>
> **Your sole responsibility is Group Lifecycle, Membership Rosters, and Permission Control (RBAC).**

Once you create a group conversation row in PostgreSQL, the existing endpoints:
- `POST /chat/conversations/:id/messages`
- `GET /chat/conversations/:id/messages`
- `PATCH /chat/conversations/:id/read`

will automatically handle chatting in your group out of the box with zero modifications!

---

## 2. What Is Already Built & Ready for You to Reuse

| Component | Location | What it does |
| :--- | :--- | :--- |
| **Messaging Engine** | `apps/api/src/modules/chat/conversation/` | Atomically assigns `sequence`, inserts `Message`, handles `clientMessageId` idempotency, cursor-based pagination, and read tracking. |
| **Real-Time Sockets** | `apps/api/src/lib/socket.ts` | Single multiplexed Socket.IO connection. Emits `chat:message:new` to `conversation:${conversationId}` and `user:${userId}`. |
| **Unified Database Schema** | `packages/database/prisma/schema.prisma` | PostgreSQL tables: `Conversation` (`type: GROUP`), `ConversationMember` (`role: OWNER/ADMIN/MEMBER`), `Message`. |
| **Workspace Authorization** | `apps/api/src/modules/workspace/workspace.service.ts` | `getWorkspaceWithMembership(slug, userId)` verifies user belongs to workspace. |
| **Member Verification** | `apps/api/src/modules/members/members.service.ts` | `verifyWorkspaceMembers(workspaceId, userIds)` verifies invited users belong to the workspace. |

---

## 3. What You Own: Group Chat Responsibilities

Your task is to build the dedicated Group module:

```text
apps/api/src/modules/chat/group/
├── group.schema.ts        # Zod validation schemas
├── group.repository.ts    # Prisma queries for group creation and roster management
├── group.service.ts       # RBAC business rules (owner/admin checks, workspace validation)
├── group.controller.ts    # HTTP request/response handlers
└── group.routes.ts        # Route registration mounted at /chat/groups
```

### Core Features to Deliver:
1. **Create Group Conversation:** Create a conversation with `type: GROUP`, custom `title`, optional `iconUrl`, and an array of invited workspace members.
2. **Assign Creator as `OWNER`:** The user who creates the group is assigned role `OWNER`. Invited users receive role `MEMBER`.
3. **Add Members to Group:** Only group `OWNER` or `ADMIN` can invite additional members. All invited users must be active members of the workspace.
4. **Remove Member / Self-Leave:**
   - Group `OWNER` or `ADMIN` can kick regular `MEMBER`s.
   - Any member can leave voluntarily.
   - If an `OWNER` leaves, ownership must either transfer to an `ADMIN` or the group dissolves.
5. **Role Promotion / Demotion:** Group `OWNER` can promote a `MEMBER` to `ADMIN` or demote an `ADMIN` to `MEMBER`.
6. **Group Metadata Updates:** `OWNER` or `ADMIN` can rename the group or update its description/icon.

---

## 4. API Contracts You Need to Implement

Mount your router in `apps/api/src/modules/workspace/workspace.route.ts`:
```typescript
router.use("/:workspaceSlug/chat/groups", groupRouter);
```

### 4.1 Create Group Conversation
- **Method / Path:** `POST /api/v1/workspaces/:workspaceSlug/chat/groups`
- **Request Body:**
  ```json
  {
    "title": "Backend Engineering",
    "description": "API & Infrastructure discussions",
    "memberUserIds": ["usr_uuid_1", "usr_uuid_2"]
  }
  ```
- **Business Logic:**
  1. Creator is derived from authenticated JWT (`req.user.id`).
  2. Verify all `memberUserIds` belong to `:workspaceSlug`.
  3. Create `Conversation` with `type: "GROUP"`, `canonicalDmKey: null`.
  4. Create `ConversationMember` rows in the same transaction:
     - Creator: `role: "OWNER"`
     - Others: `role: "MEMBER"`
- **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "conv_uuid",
      "type": "GROUP",
      "title": "Backend Engineering",
      "description": "API & Infrastructure discussions",
      "memberCount": 3,
      "myRole": "OWNER",
      "lastSequence": 0,
      "createdAt": "2026-11-22T10:00:00.000Z"
    }
  }
  ```

---

### 4.2 List User's Groups in Workspace
- **Method / Path:** `GET /api/v1/workspaces/:workspaceSlug/chat/groups`
- **Response (`200 OK`):**
  Returns all groups in this workspace where `ConversationMember` has `userId === req.user.id` and `leftAt === null`.

---

### 4.3 Add Members to Group
- **Method / Path:** `POST /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId/members`
- **Request Body:**
  ```json
  {
    "userIds": ["usr_uuid_3", "usr_uuid_4"]
  }
  ```
- **Permissions:** Caller must have `role: "OWNER"` or `"ADMIN"` in this conversation.
- **Validation:** All invited IDs must be active in the workspace and not already in the group.

---

### 4.4 Remove Member / Leave Group
- **Method / Path:** `DELETE /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId/members/:userId`
- **Permissions:**
  - If `userId === req.user.id`: Allowed (voluntary leave).
  - If `userId !== req.user.id`: Caller must be `OWNER` or `ADMIN`. (An `ADMIN` cannot kick another `ADMIN` or the `OWNER`).

---

### 4.5 Change Member Role
- **Method / Path:** `PATCH /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId/members/:userId/role`
- **Request Body:**
  ```json
  {
    "role": "ADMIN"
  }
  ```
- **Permissions:** Only the `OWNER` can change member roles.

---

### 4.6 Update Group Metadata
- **Method / Path:** `PATCH /api/v1/workspaces/:workspaceSlug/chat/groups/:conversationId`
- **Request Body:**
  ```json
  {
    "title": "Updated Group Title",
    "description": "Updated description",
    "iconUrl": "https://..."
  }
  ```
- **Permissions:** Caller must be `OWNER` or `ADMIN`.

---

## 5. Database Schema & Key Invariants

### 1. `Conversation` Table
```prisma
model Conversation {
  id             String           @id @default(uuid())
  workspaceId    String
  type           ConversationType @default(GROUP) // Set to GROUP
  title          String?          // Group name e.g. "Frontend Core"
  description    String?
  iconUrl        String?
  canonicalDmKey String?          @unique         // MUST BE NULL FOR GROUPS!
  createdById    String           // Creator user ID
  lastSequence   Int              @default(0)     // Maintained automatically by messaging engine
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  members        ConversationMember[]
  messages       Message[]
}
```

### 2. `ConversationMember` Table & Roles
```prisma
enum ConversationMemberRole {
  OWNER
  ADMIN
  MEMBER
}

model ConversationMember {
  id               String                 @id @default(uuid())
  conversationId   String
  userId           String
  role             ConversationMemberRole @default(MEMBER)
  lastReadSequence Int                    @default(0)     // Maintained by existing markRead endpoint
  joinedAt         DateTime               @default(now())
  leftAt           DateTime?              // Soft-delete if member leaves/kicked
}
```

> ⚠️ **Invariant:** `canonicalDmKey` must remain `null` for all group chats! It is strictly reserved for 1:1 DMs to guarantee two users never have multiple DM threads.

---

## 6. Implementation Template (Quickstart)

Here is a ready-to-use template for `group.service.ts`:

```typescript
import prisma from "../../../lib/prisma";
import { AppError } from "../../../common/errors/app-error";
import { withSpan } from "../../../observability/index";
import { getWorkspaceWithMembership } from "../../workspace/workspace.service";
import { verifyWorkspaceMembers } from "../../members/members.service";

export class GroupService {
  async createGroup(params: {
    workspaceSlug: string;
    creatorUserId: string;
    title: string;
    description?: string;
    memberUserIds: string[];
  }) {
    return withSpan("group.createGroup", async () => {
      const { workspace } = await getWorkspaceWithMembership(
        params.workspaceSlug,
        params.creatorUserId,
      );

      // Deduplicate member IDs and ensure creator is included
      const allUserIds = Array.from(
        new Set([params.creatorUserId, ...params.memberUserIds]),
      );

      // Verify all users belong to workspace
      const allValid = await verifyWorkspaceMembers(workspace.id, allUserIds);
      if (!allValid) {
        throw new AppError(400, "SOME_USERS_NOT_IN_WORKSPACE");
      }

      // Atomically create conversation and roster
      return prisma.conversation.create({
        data: {
          workspaceId: workspace.id,
          type: "GROUP",
          title: params.title,
          description: params.description,
          canonicalDmKey: null,
          createdById: params.creatorUserId,
          members: {
            create: allUserIds.map((userId) => ({
              userId,
              role: userId === params.creatorUserId ? "OWNER" : "MEMBER",
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
    });
  }
}
```

---

## 7. Real-Time Socket Connection Details

- The frontend connects to the Socket.IO server via `SocketProvider.tsx`.
- When a user views a group chat, they join the group's room:
  ```typescript
  // On client open group
  socket.emit("group:join", { conversationId });
  ```
- When anyone sends a message in that group, `apps/api/src/modules/chat/conversation/conversation.controller.ts` **already automatically emits**:
  ```typescript
  io.to(`conversation:${conversationId}`).emit("chat:message:new", message);
  ```
  Every user in the group receives the message live without any custom socket logic needed from you!

---

## 8. Definition of Done (Checklist for Teammate)

- [ ] Create `apps/api/src/modules/chat/group/` with schema, repository, service, controller, and routes.
- [ ] Mount group router under `/api/v1/workspaces/:workspaceSlug/chat/groups`.
- [ ] Ensure non-workspace users cannot be added to a group (`400 SOME_USERS_NOT_IN_WORKSPACE`).
- [ ] Test group creation assigns creator as `OWNER`.
- [ ] Test that only `OWNER` or `ADMIN` can invite new members.
- [ ] Test member self-leave and kicking.
- [ ] Test sending a message into the created group using `POST /chat/conversations/:id/messages` (verify it increments sequence and returns 201).
- [ ] Run `npx tsc --noEmit` in `apps/api` to ensure zero compilation errors.

---
*If you have any questions about the shared messaging engine or sequence locks, review [docs/chat/dm.md](../chat/dm.md) or reach out to Harshit.*
