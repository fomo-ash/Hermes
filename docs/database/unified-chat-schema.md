# 🗄️ Unified Chat Database Architecture

This document describes the **Unified Chat Data Model** implemented in `apps/api/prisma/schema.prisma`, explaining the schema design, mathematical deduplication keys, monotonic sequencing, and idempotency guarantees.

---

## 1. Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    User ||--o{ WorkspaceMember : "has memberships"
    User ||--o{ ConversationMember : "joined conversations"
    User ||--o{ Message : "authored messages"

    Workspace ||--o{ WorkspaceMember : "contains members"
    Workspace ||--o{ Conversation : "hosts conversations"

    Conversation ||--o{ ConversationMember : "has members"
    Conversation ||--o{ Message : "contains messages"

    Message ||--o{ MessageAttachment : "has attachments"

    User {
        string id PK
        string email UK
        string username UK
        string name
        string imageUrl
        string provider
        string providerId
        boolean onboarded
    }

    Workspace {
        string id PK
        string name
        string slug UK
        string inviteCode UK
        string iconUrl
    }

    WorkspaceMember {
        string id PK
        string userId FK
        string workspaceId FK
        enum role "OWNER | ADMIN | MEMBER | GUEST"
    }

    Conversation {
        string id PK
        string workspaceId FK
        enum type "DIRECT | GROUP"
        string title "Nullable for DMs"
        string description "Nullable for DMs"
        string iconUrl "Nullable for DMs"
        string canonicalDmKey UK "Nullable for Groups"
        string createdById
        int lastSequence "Starts at 0"
    }

    ConversationMember {
        string id PK
        string conversationId FK
        string userId FK
        enum role "OWNER | ADMIN | MEMBER"
        int lastReadSequence "Read cursor"
        datetime joinedAt
        datetime leftAt
    }

    Message {
        string id PK
        string conversationId FK
        string senderId FK
        string clientMessageId "Client UUID"
        int sequence "Linear counter"
        string content
        enum type "TEXT | SYSTEM | MEDIA"
        boolean isEdited
        datetime deletedAt
    }

    MessageAttachment {
        string id PK
        string messageId FK
        string storageKey "S3 / MinIO Key"
        string fileName
        string fileUrl "Presigned or CDN URL"
        string mimeType
        int sizeBytes
        json metadata
    }
```

---

## 2. Core Architectural Principles

### A. The Unified Abstraction (No Separate DM/Channel Tables)
* **The Problem:** Many chat applications build two independent stacks: `DirectMessage` + `DMConversation` versus `ChannelMessage` + `Channel`. This doubles your API controllers, services, database queries, and socket event pipelines.
* **The Hermes Solution:** A single polymorphic **`Conversation`** model.
  * **Direct Messages (1:1):** `type = DIRECT`, exactly 2 members, and a composite `canonicalDmKey`.
  * **Group Channels (1:N):** `type = GROUP`, 1 to $N$ members, custom `title`, and role-based permissions (`OWNER`, `ADMIN`, `MEMBER`).

---

### B. Mathematical 1:1 DM Deduplication (`canonicalDmKey`)

When two users open a chat simultaneously, race conditions can produce duplicate conversation threads between the same two people in a workspace.

#### The Algorithm:
To guarantee that Alice opening a DM with Bob yields the exact same conversation row as Bob opening a DM with Alice, we compute a sorted canonical composite string:

$$\text{canonicalDmKey} = \text{workspaceId} + ":" + \min(\text{userA}, \text{userB}) + ":" + \max(\text{userA}, \text{userB})$$

```mermaid
flowchart TD
    Alice["Alice (usr_aaa) opens DM with Bob (usr_zzz)"] --> Calc1["sort('usr_aaa', 'usr_zzz')"]
    Bob["Bob (usr_zzz) opens DM with Alice (usr_aaa)"] --> Calc2["sort('usr_zzz', 'usr_aaa')"]

    Calc1 --> Key["canonicalDmKey = 'ws_123:usr_aaa:usr_zzz'"]
    Calc2 --> Key

    Key --> DBQuery{"prisma.conversation.upsert()<br/>where: { canonicalDmKey }"}
    DBQuery --> SingleThread[("Guaranteed 1 Single Thread in PostgreSQL!")]
```

> [!IMPORTANT]
> Because `canonicalDmKey` carries a `@unique` constraint at the database layer, PostgreSQL rejects any concurrent duplicate insertions, guaranteeing strict 1:1 DM uniqueness. For Group chats, `canonicalDmKey` is `NULL`.

---

### C. Deterministic Ordering via Monotonic Server Sequences

Relying on client clocks or microsecond timestamps (`createdAt`) causes severe message jumping due to clock drift (e.g., Client A's phone is 3 seconds ahead of Client B's laptop).

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice
    participant DB as PostgreSQL Conversation Row
    actor Bob as Bob

    Note over DB: Current lastSequence = 41
    Alice->>DB: Send Message
    DB->>DB: UPDATE Conversation SET lastSequence = 42
    DB-->>Alice: Saved with sequence = 42
    
    Bob->>DB: Send Message
    DB->>DB: UPDATE Conversation SET lastSequence = 43
    DB-->>Bob: Saved with sequence = 43

    Note over Alice,Bob: Clients simply ORDER BY sequence ASC.<br/>Zero clock drift. Instant gap detection!
```

* **Linear Sequencing:** Each conversation maintains an integer `lastSequence`. Every new message atomically increments this sequence.
* **Gap Detection:** If a client receives sequence `42` followed by sequence `45`, the client instantly knows it missed sequences `43` and `44` and triggers a reconnection sync: `GET /messages?afterSequence=42`.
* **Database Constraint:** `@@unique([conversationId, sequence])`.

---

### D. Idempotent Message Persistence (`clientMessageId`)

Under unstable cellular connections, a client may send a message, have it saved to the database, but lose internet connectivity before receiving the HTTP `201 Created` acknowledgment. When the client retries, a duplicate message would typically be inserted.

```mermaid
flowchart TD
    Client["Client: Generates clientMessageId (UUID v4)"] --> POST1["Attempt 1: POST /messages"]
    POST1 --> SaveDB[("PostgreSQL: Inserts message (senderId, clientMessageId)")]
    SaveDB -- Network Drops! --> LostAck["Ack lost in transit"]
    Client -- Auto Retry --> POST2["Attempt 2: POST /messages (Same clientMessageId)"]
    POST2 --> CheckUniq{"Check @@unique([senderId, clientMessageId])"}
    CheckUniq -- Already exists --> ReturnExisting["Return existing Message record (200 OK)"]
    ReturnExisting --> Clean["Zero Duplicate Messages Rendered!"]
```

---

## 3. Database Indexes & Performance Strategy

| Target Model | Index Definition | Purpose |
| :--- | :--- | :--- |
| `Conversation` | `@@index([workspaceId, type])` | Speeds up filtering DMs vs Groups inside a workspace sidebar. |
| `ConversationMember` | `@@unique([conversationId, userId])` | Prevents a user from joining the same conversation twice. |
| `ConversationMember` | `@@index([userId, conversationId, lastReadSequence])` | Optimizes real-time unread badge calculation across thousands of threads. |
| `Message` | `@@unique([conversationId, sequence])` | Enforces linear sequence allocation without duplicate sequence numbers. |
| `Message` | `@@unique([senderId, clientMessageId])` | Enforces message send idempotency. |
| `Message` | `@@index([conversationId, sequence(sort: Desc)])` | Powers fast cursor pagination when scrolling chat history. |

