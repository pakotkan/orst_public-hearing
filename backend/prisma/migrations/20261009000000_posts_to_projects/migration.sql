-- Move posts and comments onto the hearing models:
--   Post       -> Project (same id, so links and attachment folders keep working)
--   (new)      -> one TEXT Question per project, id 'q_' || project id
--   Comment    -> Response + Answer; a user's comments on one post are merged
--                 into one answer, oldest first, separated by a blank line
--   Attachment -> re-linked from postId to projectId (files stay on disk)
-- Prisma runs this file in a single transaction, so a failure leaves the data untouched.

-- Posts without an author are given to the oldest admin. If there are such posts and
-- no admin exists, the INSERT below fails on Project.createdById NOT NULL.
INSERT INTO "Project" ("id", "title", "description", "status", "createdById", "createdAt", "updatedAt")
SELECT
    p."id",
    p."title",
    NULLIF(p."content", ''),
    (CASE WHEN p."isPublished" THEN 'OPEN' ELSE 'DRAFT' END)::"ProjectStatus",
    COALESCE(p."authorId", (SELECT u."id" FROM "User" u WHERE u."role" = 'ADMIN' ORDER BY u."createdAt" LIMIT 1)),
    p."createdAt",
    p."updatedAt"
FROM "Post" p;

INSERT INTO "Question" ("id", "projectId", "question", "type", "order", "createdAt", "updatedAt")
SELECT 'q_' || p."id", p."id", 'ความคิดเห็นต่อเรื่องนี้', 'TEXT', 1, p."createdAt", p."createdAt"
FROM "Post" p;

INSERT INTO "Response" ("id", "projectId", "userId", "createdAt")
SELECT 'r_' || md5(c."postId" || ':' || c."userId"), c."postId", c."userId", MIN(c."createdAt")
FROM "Comment" c
GROUP BY c."postId", c."userId";

INSERT INTO "Answer" ("id", "responseId", "questionId", "textValue", "createdAt")
SELECT
    'a_' || md5(c."postId" || ':' || c."userId"),
    'r_' || md5(c."postId" || ':' || c."userId"),
    'q_' || c."postId",
    string_agg(c."content", E'\n\n' ORDER BY c."createdAt"),
    MIN(c."createdAt")
FROM "Comment" c
GROUP BY c."postId", c."userId";

-- Re-link attachments. Project ids equal the old post ids.
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_postId_fkey";
DROP INDEX "Attachment_postId_idx";
ALTER TABLE "Attachment" RENAME COLUMN "postId" TO "projectId";
CREATE INDEX "Attachment_projectId_idx" ON "Attachment"("projectId");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Attachments replace the single pdfUrl.
ALTER TABLE "Project" DROP COLUMN "pdfUrl";

CREATE INDEX "Project_status_createdAt_idx" ON "Project"("status", "createdAt");

DROP TABLE "Comment";
DROP TABLE "Post";
