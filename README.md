# 🏛️ Hermes Monorepo

Welcome to the **Hermes** monorepo—a collaborative workspace platform inspired by Discord, Slack, and Linear.

This repository is structured as a **pnpm workspace** using **Turborepo** for build and development orchestration.

---

## 📍 Local Development Locations

When running the application locally, you can access the frontend, API, and backing services at the following URLs:

### 💻 Applications

| Application | Technology | URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend (Web)** | Next.js, React | [http://localhost:3000](http://localhost:3000) | Landing page, user auth, and dashboard |
| **Backend (API)** | Express, Node.js | [http://localhost:8000](http://localhost:8000) | Main application server & authentication endpoints |

### 🗄️ Infrastructure Services (Docker)

These backing services are spun up using the [docker-compose.yml](file:///Ubuntu/home/ashutosh/projects/Hermes/infra/docker/docker-compose.yml) configuration inside `infra/docker/`.

| Service | Connection/Console URL | Internal Port | External Port | Credentials |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | `localhost:5434` | `5432` | `5434` | `user: hermes` / `pass: hermes` / `db: hermes` |
| **Redis** | `localhost:6380` | `6379` | `6380` | *None* |
| **MinIO API** | [http://localhost:9000](http://localhost:9000) | `9000` | `9000` | `user: admin` / `pass: admin12345` |
| **MinIO Console** | [http://localhost:9001](http://localhost:9001) | `9001` | `9001` | `user: admin` / `pass: admin12345` |

---

## 🛠️ Setup & Running Locally

Follow these steps to spin up the local development environment:

### Prerequisites
* **Node.js:** v22+
* **pnpm:** Workspace package manager
* **Docker Desktop / Engine:** To run postgres, redis, and minio

### 1. Install Dependencies
Run the installation command in the root directory:
```bash
pnpm install
```

### 2. Start backing services (Docker)
Start the containers in detached mode:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### 3. Generate database client & run migrations
Ensure the database schema is up-to-date and generate the Prisma client types:
```bash
# Generate Prisma Client
pnpm --filter api prisma generate

# Apply pending migrations
pnpm --filter api prisma migrate dev
```
For more information, see the [Prisma Database Documentation](file:///Ubuntu/home/ashutosh/projects/Hermes/docs/database/prisma.md).

### 4. Start Development Servers
Run the development command from the root directory:
```bash
pnpm dev
```
This starts both the Next.js frontend (`localhost:3000`) and Express API (`localhost:8000`) concurrently.

---

## 📂 Repository Structure

```text
Hermes/
├── apps/
│   ├── web/          # Next.js frontend application (port 3000)
│   └── api/          # Express backend application (port 8000)
│       └── src/
│           └── modules/
│               ├── auth/            # Google OAuth / Session management
│               ├── workspace/       # Multi-tenant workspace management
│               ├── members/         # Workspace membership & permissions
│               ├── presence/        # Real-time presence (Redis)
│               └── chat/            # Chat Layer Architecture
│                   ├── common/      # Foundational messaging engine (send, history, read state)
│                   ├── dm/          # 1:1 Direct Messages & canonical keys
│                   ├── conversation/# Conversation thread management
│                   ├── group/       # Group chats (planned)
│                   └── socket/      # Socket.IO & Redis coordination (planned)
├── packages/
│   ├── shared/       # Shared business logic and utilities
│   ├── types/        # TypeScript types shared across the monorepo
│   └── ui/           # Shared React UI components
├── infra/
│   └── docker/       # Docker Compose setup for PostgreSQL, Redis, MinIO
└── docs/             # Markdown documentation
    ├── architecture/
    ├── chat/         # Complete chat design, DM guide, and HLD specs
    ├── database/     # Database-specific guides (e.g. prisma.md)
    └── api/
```

---

## 💬 Chat & Messaging Engine Architecture

Hermes uses a **parent-child / common-specialized modular messaging architecture**:

* **PostgreSQL as Single Source of Truth:** Messages, sequence numbers, and member read states are permanently persisted in PostgreSQL. Redis and Socket.IO handle ephemeral presence and real-time coordination.
* **Foundational Messaging Engine (`chat/common/`):**
  * **Atomic Sequence Assignment:** Conversation-scoped monotonic sequence numbers allocated inside serializable transactions (`UPDATE "Conversation" SET "lastSequence" = "lastSequence" + 1 ...`).
  * **Idempotency Guarantee:** Client send retries using `clientMessageId` prevent duplicate messages via unique constraint `@@unique([senderId, clientMessageId])`.
  * **Cursor Pagination:** Stable sequence cursors (`beforeSequence`) prevent item shifting and duplicate entries when scrolling through history.
  * **Monotonic Read Tracking:** Member `lastReadSequence` is advanced using PostgreSQL `GREATEST(...)` to ensure read progress never rolls back.
* **Specialized Layers (`chat/dm/`, `chat/group/`):**
  * **1:1 Direct Messages:** Deterministic canonical DM keys (`wsId:minUser:maxUser`) guarantee exactly one unique thread per user pair per workspace.
  * **Group Chats:** Multi-member conversation rosters, invite handling, and administrative permissions.
* **Full Documentation:** See [docs/chat/dm.md](./docs/chat/dm.md) and [docs/chat/chat-layer-plan.md](./docs/chat/chat-layer-plan.md).
