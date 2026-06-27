# Prisma Database Documentation

This document explains how Prisma is integrated into the Hermes monorepo workspace and details the standard commands and workflows for working with the database.

---

## 📂 File Architecture

* **Prisma Schema:** Located at [schema.prisma](file:///Ubuntu/home/ashutosh/projects/Hermes/apps/api/prisma/schema.prisma) (`apps/api/prisma/schema.prisma`)
* **Environment Variables:** Located at [apps/api/.env](file:///Ubuntu/home/ashutosh/projects/Hermes/apps/api/.env)
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

### 2. Apply and Create Migrations (`migrate dev`)
Updates the database schema to match `schema.prisma` and creates/applies SQL migration records.

* **From Root:**
  ```bash
  pnpm --filter api prisma migrate dev
  ```
* **From `apps/api`:**
  ```bash
  pnpm prisma migrate dev
  ```

### 3. Open Prisma Studio
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
3. **Executes SQL:** Runs the SQL script against the database target defined in `DATABASE_URL`.
4. **Triggers Generate:** Automatically executes `prisma generate` to update the type definitions for code autocompletion.
