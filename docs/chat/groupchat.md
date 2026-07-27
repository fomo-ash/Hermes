# Group Chat Implementation Details

Group chats (Channels) support multiple participants within a Workspace. Due to potentially large numbers of members, fan-out logic requires specific considerations.

## Data Model

- **Channel:** Represents the group chat room.
- **Message:** The core entity containing text, file attachments, and metadata.

*Schema Reference:*
```prisma
model Channel {
  id          String    @id @default(uuid())
  workspaceId String
  messages    Message[]
  // ...
}
```

## Real-Time Architecture

### 1. Connection & Rooms
- When a user connects via WebSocket and navigates to a channel, they emit a `join_channel(channelId)` event.
- The server adds their socket connection to a logical room named `channel:{channelId}`.

### 2. Message Flow (Sending)
1. **Client API Call:** User sends `POST /api/channels/:id/messages` with payload.
2. **Validation:** API verifies user is a valid WorkspaceMember and has permissions.
3. **Kafka Publishing:** API produces a message event to Kafka topic `channel.messages`.
4. **Immediate Broadcast:** API publishes the structured message to Redis Pub/Sub channel `channel:events`.
5. **WebSocket Delivery:** WS Servers subscribed to Redis receive the event and broadcast it to all sockets in the `channel:{channelId}` room.
6. **Async Persistence:** A Kafka Consumer group processes the `channel.messages` topic and writes the message to PostgreSQL.

### 3. Ephemeral States (Typing)
Typing indicators for group chats can become noisy. 
- **Debouncing:** Clients debounce typing events (e.g., send every 2 seconds).
- **Flow:** Client sends WS event `typing(channelId)`. Server publishes to Redis. All users in the room receive the event and display `"{User} is typing..."`.
- **Throttling UI:** The frontend aggregates multiple typing events into `"{User1}, {User2}, and 3 others are typing..."`.

### 4. Caching Strategy
- The latest 50 messages of active channels are cached in Redis List or Sorted Set to optimize the initial page load when a user clicks on a channel.

### 5. Reactions & Emojis
- Implemented as a sub-resource of a message: `POST /api/messages/:id/reactions`
- Emojis follow the same flow as messages: Validated by API -> Kafka -> Redis Pub/Sub -> WS Room Broadcast.
- DB Schema requires a `Reaction` model tied to `MessageId` and `MemberId`.
