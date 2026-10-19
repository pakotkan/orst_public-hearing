-- Merge in new_schema.prisma:
--   Role             -> UserRole (same values)
--   User.phone       -> required (existing empty phones become '')
--   Attachment       -> Project.pdfUrl (each project keeps its first PDF; other files are dropped)
--   Question         -> SummaryTopic (question -> title, unique order per project)
--   Answer           -> TopicAnswer (agree -> agreement, reason -> additionalComment,
--                       + relatedAgency, + updatedAt)
-- Tables and columns are renamed rather than recreated, so existing topics and answers are kept.

-- UserRole
ALTER TYPE "Role" RENAME TO "UserRole";

-- Phone is required
UPDATE "User" SET "phone" = '' WHERE "phone" IS NULL;
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;

-- One PDF per project instead of attachments. Files stay on disk under UPLOAD_DIR/posts/.
ALTER TABLE "Project" ADD COLUMN "pdfUrl" TEXT;
UPDATE "Project" p SET "pdfUrl" = '/uploads/posts/' || (
    SELECT a."storedName" FROM "Attachment" a
    WHERE a."projectId" = p."id" AND a."mimeType" = 'application/pdf'
    ORDER BY a."createdAt" LIMIT 1
);
DROP TABLE "Attachment";

-- Question -> SummaryTopic
ALTER TABLE "Question" RENAME TO "SummaryTopic";
ALTER TABLE "SummaryTopic" RENAME COLUMN "question" TO "title";
ALTER TABLE "SummaryTopic" RENAME CONSTRAINT "Question_pkey" TO "SummaryTopic_pkey";
ALTER TABLE "SummaryTopic" RENAME CONSTRAINT "Question_projectId_fkey" TO "SummaryTopic_projectId_fkey";
ALTER INDEX "Question_projectId_idx" RENAME TO "SummaryTopic_projectId_idx";
CREATE UNIQUE INDEX "SummaryTopic_projectId_order_key" ON "SummaryTopic"("projectId", "order");

-- Answer -> TopicAnswer
ALTER TABLE "Answer" RENAME TO "TopicAnswer";
ALTER TABLE "TopicAnswer" RENAME COLUMN "questionId" TO "summaryTopicId";
ALTER TABLE "TopicAnswer" RENAME COLUMN "agree" TO "agreement";
ALTER TABLE "TopicAnswer" RENAME COLUMN "reason" TO "additionalComment";
ALTER TABLE "TopicAnswer" ADD COLUMN "relatedAgency" TEXT;
ALTER TABLE "TopicAnswer" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TopicAnswer" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "TopicAnswer" RENAME CONSTRAINT "Answer_pkey" TO "TopicAnswer_pkey";
ALTER TABLE "TopicAnswer" RENAME CONSTRAINT "Answer_responseId_fkey" TO "TopicAnswer_responseId_fkey";
ALTER TABLE "TopicAnswer" RENAME CONSTRAINT "Answer_questionId_fkey" TO "TopicAnswer_summaryTopicId_fkey";
ALTER INDEX "Answer_responseId_questionId_key" RENAME TO "TopicAnswer_responseId_summaryTopicId_key";
DROP INDEX "Answer_questionId_idx";
CREATE INDEX "TopicAnswer_summaryTopicId_agreement_idx" ON "TopicAnswer"("summaryTopicId", "agreement");

-- A comment and an agency are only allowed with a "yes".
ALTER TABLE "TopicAnswer" DROP CONSTRAINT "Answer_reason_only_when_agree";
ALTER TABLE "TopicAnswer" ADD CONSTRAINT "TopicAnswer_details_only_when_agree"
    CHECK ("agreement" OR ("additionalComment" IS NULL AND "relatedAgency" IS NULL));
