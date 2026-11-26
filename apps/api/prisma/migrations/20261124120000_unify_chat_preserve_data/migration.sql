-- Move the original channel and DM data into the unified chat model.
-- All changes are atomic. Preflight failures leave the old tables untouched.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Conversation" c
    JOIN "WorkspaceMember" a ON a.id = c."memberOneId"
    JOIN "WorkspaceMember" b ON b.id = c."memberTwoId"
    WHERE a."workspaceId" <> b."workspaceId"
       OR (c."workspaceId" IS NOT NULL AND c."workspaceId" <> a."workspaceId")
       OR a."userId" = b."userId"
  ) THEN
    RAISE EXCEPTION 'Cannot migrate invalid legacy DM membership';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Channel" c
    WHERE NOT EXISTS (SELECT 1 FROM "WorkspaceMember" wm WHERE wm."workspaceId" = c."workspaceId")
  ) THEN
    RAISE EXCEPTION 'Cannot migrate a channel without workspace members';
  END IF;
  IF EXISTS (SELECT 1 FROM "Channel" ch JOIN "Conversation" dm ON dm.id = ch.id)
     OR EXISTS (SELECT 1 FROM "Message" ch JOIN "DirectMessage" dm ON dm.id = ch.id) THEN
    RAISE EXCEPTION 'Legacy chat IDs collide across tables';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Message" m
    JOIN "Channel" c ON c.id = m."channelId"
    JOIN "WorkspaceMember" wm ON wm.id = m."memberId"
    WHERE wm."workspaceId" <> c."workspaceId"
  ) OR EXISTS (
    SELECT 1 FROM "DirectMessage" m
    JOIN "Conversation" c ON c.id = m."conversationId"
    WHERE m."memberId" NOT IN (c."memberOneId", c."memberTwoId")
  ) THEN
    RAISE EXCEPTION 'Cannot migrate a message from a non-member';
  END IF;
END $$;

ALTER TABLE "Message" RENAME TO "LegacyChannelMessage";
ALTER TABLE "DirectMessage" RENAME TO "LegacyDirectMessage";
ALTER TABLE "Conversation" RENAME TO "LegacyDirectConversation";
ALTER TABLE "Channel" RENAME TO "LegacyChannel";

CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'SYSTEM', 'MEDIA');
CREATE TYPE "ConversationMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "type" "ConversationType" NOT NULL DEFAULT 'DIRECT',
  "title" TEXT,
  "description" TEXT,
  "iconUrl" TEXT,
  "canonicalDmKey" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "ConversationMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "ConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
  "lastReadSequence" INTEGER NOT NULL DEFAULT 0,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3)
);

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "clientMessageId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "type" "MessageType" NOT NULL DEFAULT 'TEXT',
  "isEdited" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "messageId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Old DM participants are WorkspaceMember IDs; the new model stores User IDs.
INSERT INTO "Conversation" ("id", "workspaceId", "type", "canonicalDmKey", "createdById", "createdAt", "updatedAt")
SELECT c.id, a."workspaceId", 'DIRECT',
       a."workspaceId" || ':' || LEAST(a."userId", b."userId") || ':' || GREATEST(a."userId", b."userId"),
       a."userId", COALESCE(d.first_message, CURRENT_TIMESTAMP), COALESCE(d.last_message, CURRENT_TIMESTAMP)
FROM "LegacyDirectConversation" c
JOIN "WorkspaceMember" a ON a.id = c."memberOneId"
JOIN "WorkspaceMember" b ON b.id = c."memberTwoId"
LEFT JOIN LATERAL (
  SELECT MIN("createdAt") AS first_message, MAX("updatedAt") AS last_message
  FROM "LegacyDirectMessage" WHERE "conversationId" = c.id
) d ON true;

-- A legacy channel was workspace-wide, so all current workspace members retain access.
INSERT INTO "Conversation" ("id", "workspaceId", "type", "title", "createdById", "createdAt", "updatedAt")
SELECT c.id, c."workspaceId", 'GROUP', c.name,
       owner."userId", c."createdAt", c."updatedAt"
FROM "LegacyChannel" c
JOIN LATERAL (
  SELECT wm."userId" FROM "WorkspaceMember" wm
  WHERE wm."workspaceId" = c."workspaceId"
  ORDER BY CASE WHEN wm.role = 'OWNER' THEN 0 ELSE 1 END, wm."createdAt", wm.id LIMIT 1
) owner ON true;

INSERT INTO "ConversationMember" ("id", "conversationId", "userId", "role")
SELECT gen_random_uuid()::text, c.id, wm."userId", 'MEMBER'
FROM "LegacyDirectConversation" c
JOIN "WorkspaceMember" wm ON wm.id IN (c."memberOneId", c."memberTwoId");

INSERT INTO "ConversationMember" ("id", "conversationId", "userId", "role")
SELECT gen_random_uuid()::text, c.id, wm."userId",
       CASE WHEN wm."userId" = uc."createdById" THEN 'OWNER' ELSE 'MEMBER' END::"ConversationMemberRole"
FROM "LegacyChannel" c
JOIN "WorkspaceMember" wm ON wm."workspaceId" = c."workspaceId"
JOIN "Conversation" uc ON uc.id = c.id;

-- Preserve original message IDs and order messages by timestamp, then ID.
WITH legacy AS (
  SELECT m.id, m."channelId" AS conversation_id, wm."userId" AS sender_id,
         m.content, m."deleted", m."createdAt", m."updatedAt"
  FROM "LegacyChannelMessage" m JOIN "WorkspaceMember" wm ON wm.id = m."memberId"
  UNION ALL
  SELECT m.id, m."conversationId", wm."userId", m.content, m."deleted", m."createdAt", m."updatedAt"
  FROM "LegacyDirectMessage" m JOIN "WorkspaceMember" wm ON wm.id = m."memberId"
)
INSERT INTO "Message" ("id", "conversationId", "senderId", "clientMessageId", "sequence", "content", "deletedAt", "createdAt", "updatedAt")
SELECT id, conversation_id, sender_id, id,
       ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY "createdAt", id)::integer,
       content, CASE WHEN "deleted" THEN "updatedAt" ELSE NULL END, "createdAt", "updatedAt"
FROM legacy;

-- Legacy attachments only stored URLs. Keep the URL and mark missing metadata explicitly.
INSERT INTO "MessageAttachment" ("id", "messageId", "storageKey", "fileName", "fileUrl", "mimeType", "sizeBytes", "metadata")
SELECT gen_random_uuid()::text, id, "fileUrl", COALESCE(NULLIF(split_part("fileUrl", '/', -1), ''), 'legacy-file'),
       "fileUrl", 'application/octet-stream', 0, '{"legacy":true}'::jsonb
FROM (
  SELECT id, "fileUrl" FROM "LegacyChannelMessage" WHERE "fileUrl" IS NOT NULL
  UNION ALL
  SELECT id, "fileUrl" FROM "LegacyDirectMessage" WHERE "fileUrl" IS NOT NULL
) attachments;

UPDATE "Conversation" c SET "lastSequence" = counts.total,
  "updatedAt" = GREATEST(c."updatedAt", counts.latest)
FROM (SELECT "conversationId", COUNT(*)::integer AS total, MAX("updatedAt") AS latest
      FROM "Message" GROUP BY "conversationId") counts
WHERE c.id = counts."conversationId";

CREATE UNIQUE INDEX "Conversation_canonicalDmKey_key" ON "Conversation"("canonicalDmKey");
CREATE INDEX "Conversation_workspaceId_idx" ON "Conversation"("workspaceId");
CREATE INDEX "Conversation_workspaceId_type_idx" ON "Conversation"("workspaceId", "type");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt" DESC);
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");
CREATE INDEX "ConversationMember_conversationId_idx" ON "ConversationMember"("conversationId");
CREATE INDEX "ConversationMember_userId_conversationId_lastReadSequence_idx" ON "ConversationMember"("userId", "conversationId", "lastReadSequence");
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");
CREATE INDEX "Message_conversationId_sequence_idx" ON "Message"("conversationId", "sequence" DESC);
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE UNIQUE INDEX "Message_conversationId_sequence_key" ON "Message"("conversationId", "sequence");
CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key" ON "Message"("senderId", "clientMessageId");
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Retain legacy tables as a rollback reference until the migrated data is verified.
COMMIT;
