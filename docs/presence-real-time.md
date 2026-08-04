# Real-time Presence Indicator

## Goal

Provide a real-time online/offline presence indicator for users in Hermes, so the UI can show whether a user is currently connected and update that status live across sockets.

## Current backend direction

The backend currently has the following pieces:

- Socket.IO server bootstrap from [apps/api/src/lib/socket.ts](../apps/api/src/lib/socket.ts)
- Socket authentication middleware from [apps/api/src/middleware/socket.middleware.ts](../apps/api/src/middleware/socket.middleware.ts)
- Redis-backed presence storage from [apps/api/src/lib/redis.client.ts](../apps/api/src/lib/redis.client.ts)
- Presence gateway/service/repository layers under [apps/api/src/modules/presence](../apps/api/src/modules/presence)

The presence model is currently based on Redis sets keyed per user, with a TTL-based heartbeat model:

- `presence:user:<userId>` stores socket IDs for that user
- `PRESENCE_TTL_SECONDS` controls how long the presence record remains valid
- `connect` marks a user online when the first socket joins
- `disconnect` marks the user offline only when no sockets remain

## What is already done

- JWT-authenticated socket connection
- Cookie-based socket auth handshake parsing
- Redis client configured for presence state storage
- Server integration with Socket.IO lifecycle
- Gateway wiring for connection / disconnect handling
- Repository logic for adding, removing, refreshing, and counting connection IDs
- Presence service event emission for `presence:online` and `presence:offline`

## What is still left to do in the backend

### 1. Expose a presence query API

The service already has `getPresence(userIds)` and `isOnline(userId)`, but the route/controller layer is not yet exposed for the frontend to query presence in bulk.

Recommended backend additions:

- `GET /api/v1/presence?userIds=...` or a POST-based bulk status endpoint
- controller/service route wiring
- typed response shape such as:

```ts
{
  userId: "...",
  online: true
}
```

### 2. Make the heartbeat loop explicit and reliable

The current gateway listens for a `heartbeat` event, but the client-side heartbeat sender is still missing.

Recommended backend behavior:

- keep `heartbeat` as the server-side refresh path
- define a heartbeat interval on the client such as every 15-30 seconds
- allow a server-side socket timeout fallback if the client goes silent

### 3. Add a clean presence sync payload for new connections

When a client connects, it should receive the current presence snapshot for the relevant workspace or member list.

Recommended approach:

- send a `presence:sync` event after auth completes
- include an array of user IDs and their online state
- keep the payload deterministic and typed

### 4. Decide the event fan-out model

Right now the presence service emits `presence:online` and `presence:offline` globally.

For a real product implementation, you should consider:

- emitting only to a relevant workspace or conversation room
- using targeted room join patterns for members in a workspace
- avoiding global broadcasts for scalability and privacy

### 5. Scale Redis presence to multi-instance deployment

If multiple API instances are run behind a load balancer, a single Redis store is good, but a per-instance Socket.IO event broadcast is not enough.

Recommended future hardening:

- Redis pub/sub for cross-instance presence events
- a single shared ownership model for the presence keys
- optional leader election or a central node for socket fan-out

### 6. Add runtime safeguards and observability

Recommended backend hardening:

- log `socket.id` and `userId` on connect/disconnect for debugging
- add structured errors around Redis failures
- add health checks or metrics for online-user counts
- consider a cleanup routine for stale Redis keys

### 7. Add tests

The presence flow should be covered with tests for:

- user goes online on first socket connection
- user stays online across multiple socket connections
- user goes offline only when all sockets are gone
- heartbeat refresh extends TTL correctly
- bulk presence lookup returns the right map

## Frontend integration plan

For the frontend later, the expected flow is:

1. Open a socket connection using the authenticated session cookie
2. Subscribe to `presence:online` and `presence:offline`
3. Use a presence store/hook to maintain a `Map<string, boolean>` of online members
4. On page load, fetch the current presence status for the relevant user set
5. Update UI badges or avatars accordingly
6. Handle reconnects and stale socket events cleanly

Recommended frontend structure:

- `usePresenceSocket()` hook for socket lifecycle
- `presenceStore` or Zustand store for cached online state
- UI components for member list badges, avatar status dots, and channel/member presence indicators

## Suggested next implementation order

1. Add a presence query endpoint for the frontend to load initial state
2. Add a typed `presence:sync` event and payload
3. Add a client heartbeat loop
4. Wire the frontend presence store to listen for real-time events
5. Add Redis pub/sub for multi-instance scaling if needed

## Notes

The current backend foundation is good enough for a first pass, but the feature is not fully complete until the API query layer, heartbeat behavior, and frontend subscription flow are all connected together.
