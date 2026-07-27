# Direct Messages (DMs) Implementation Details

Direct Messages represent 1-on-1 private conversations between two `WorkspaceMember`s.

## Data Model

- **Conversation:** Links exactly two workspace members.
- **DirectMessage:** Individual messages belonging to a conversation.

*Schema Reference:*
```prisma
model Conversation {
  id          String  @id @default(uuid())
  memberOneId String
  memberTwoId String
  // ...
}
```

## Security & Privacy Considerations
Unlike channels where any workspace member might join, DMs are strictly private.
- **API Guard:** Every REST endpoint (`GET`, `POST`) and WebSocket event must explicitly verify that the requesting user's `WorkspaceMember` ID matches either `memberOneId` or `memberTwoId`.

## Real-Time Architecture

### 1. Connection & Rooms
- Instead of joining a massive channel room, a user's socket joins personal rooms for every active conversation, e.g., `conversation:{conversationId}`.
- Alternatively, users can join a single global room matching their own `memberId` (`user:{memberId}`), and the server selectively routes DM events to that specific user room. The latter is significantly more efficient for DMs.

### 2. Message Flow (Sending)
1. **Client API Call:** User sends `POST /api/conversations/:id/messages`.
2. **Validation:** Ensure the sender is part of the conversation.
3. **Kafka & Redis:** 
   - Pushed to Kafka topic `dm.messages`.
   - Published to Redis Pub/Sub routing directly to the recipient's personal room (`user:{recipientMemberId}`).
4. **WebSocket Delivery:** The WS server holding the recipient's socket delivers the message.

### 3. Read Receipts & Typing
- **Read Receipts:** Crucial for DMs. When User B views a message, the client calls `POST /api/conversations/:id/read`.
- **Typing Indicators:** Broadcast purely via WS directly to the other member's room.

### 4. Push Notifications
- DMs usually trigger direct push notifications or emails if the recipient is offline.
- **Kafka Consumer Logic:** The worker processing `dm.messages` checks the Redis "Online Presence" set for the recipient. If the recipient is offline, the worker queues a push notification job.
