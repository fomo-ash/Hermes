# Prisma Database Documentation

This document explains how Prisma is integrated into the Hermes monorepo workspace and details the standard commands and workflows for working with the database.

---

## 📂 File Architecture

* **Prisma Schema:** Located at `apps/api/prisma/schema.prisma`
* **Prisma CLI Config:** Located at `apps/api/prisma.config.ts`
* **Runtime Client:** Located at `apps/api/src/lib/prisma.ts`
* **Environment Variables:** Located at `apps/api/.env`
* **Migrations Directory:** Located at `apps/api/prisma/migrations/`

---

## 🛠️ Monorepo Operations (`--filter`)

Since this repository is structured as a **pnpm monorepo workspace**, running workspace commands from the root directory requires targeting the target package.

We use the `--filter` (or `-F`) flag to tell `pnpm` exactly which application to run the command in:
* `pnpm --filter api <command>` runs `<command>` inside `apps/api`.

> [!TIP]
> Alternatively, you can always `cd apps/api` and run the command directly as `pnpm prisma <command>`.

---

## 🚀 Common Commands

### 1. Generate Prisma Client
Whenever the schema is modified, or after doing a `git pull` that introduces schema changes, the TypeScript types for the Prisma client must be updated.

* **From Root:**
  ```bash
  pnpm --filter api prisma generate
  ```
* **From `apps/api`:**
  ```bash
  pnpm prisma generate
  ```

### 2. Apply Existing Migrations (`migrate deploy`)
Applies committed migrations without generating new SQL. Run this against a deployed database:

```bash
pnpm --filter api prisma migrate deploy
```

The CLI uses a direct Neon URL over TCP port 5432. Run it from a network that permits that connection; the API's WebSocket adapter does not change the CLI's network requirement.

### 3. Create Migrations (`migrate dev`)
Use only against a development database or Neon development branch. This command may ask to reset a database if it finds schema drift.

* **From Root:**
  ```bash
  pnpm --filter api prisma migrate dev
  ```
* **From `apps/api`:**
  ```bash
  pnpm prisma migrate dev
  ```

### 4. Open Prisma Studio
Launches a local graphical interface to view, edit, and query database records directly in your browser.

* **From Root:**
  ```bash
  pnpm --filter api prisma studio
  ```
* **From `apps/api`:**
  ```bash
  pnpm prisma studio
  ```

---

## 💡 Concept Deep-Dives

### Why use `pnpm --filter api`?
Instead of forcing you to navigate folders repeatedly (`cd apps/api` -> run command -> `cd ../..`), `pnpm` handles execution inside the workspace scope automatically. Using `--filter api` saves context-switching time and keeps your terminal prompt in the project root.

### What does `prisma migrate dev` do?
`prisma migrate dev` is a development-mode command that:
1. **Compares Schema State:** Scans `schema.prisma` for changes relative to the database state and local history.
2. **Generates SQL Script:** Creates a new folder inside `prisma/migrations/` with a timestamped `migration.sql` detailing the changes.
3. **Executes SQL:** Runs the SQL script against the direct URL selected by `prisma.config.ts` (`DATABASE_URL_UNPOOLED`, or the direct host derived from `DATABASE_URL`).
4. **Triggers Generate:** Automatically executes `prisma generate` to update the type definitions for code autocompletion.

## Neon connections

The API uses the pooled `DATABASE_URL` through `@prisma/adapter-neon` and Neon's WebSocket driver. Prisma CLI commands use `DATABASE_URL_UNPOOLED` when provided, or derive a direct URL by removing `-pooler` from the hostname. The CLI uses PostgreSQL TCP; Prisma 6's Neon adapter cannot reliably run migrations through WebSockets. Keep these URLs server-side; never put them in `NEXT_PUBLIC_` variables.
