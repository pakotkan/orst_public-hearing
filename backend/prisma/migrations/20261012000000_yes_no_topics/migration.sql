-- Every question becomes a yes/no topic with an optional reason on "yes".
-- Question types, options and ratings are removed.
--
-- Existing responses can't be converted, so they are deleted (with their answers).
-- Each existing project gets 3 placeholder topics in place of its old questions, and
-- OPEN projects go back to DRAFT so the placeholders aren't shown publicly until an
-- admin writes the real topics and reopens them.

DELETE FROM "Response";
DELETE FROM "Question";

-- DropForeignKey
ALTER TABLE "QuestionOption" DROP CONSTRAINT "QuestionOption_questionId_fkey";
ALTER TABLE "AnswerOption" DROP CONSTRAINT "AnswerOption_answerId_fkey";
ALTER TABLE "AnswerOption" DROP CONSTRAINT "AnswerOption_questionOptionId_fkey";

-- DropTable
DROP TABLE "QuestionOption";
DROP TABLE "AnswerOption";

-- AlterTable
ALTER TABLE "Question" DROP COLUMN "type";

ALTER TABLE "Answer" DROP COLUMN "numberValue",
DROP COLUMN "textValue",
ADD COLUMN     "agree" BOOLEAN NOT NULL,
ADD COLUMN     "reason" TEXT;

-- A reason is only allowed with a "yes".
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_reason_only_when_agree" CHECK ("agree" OR "reason" IS NULL);

-- DropEnum
DROP TYPE "QuestionType";

INSERT INTO "Question" ("id", "projectId", "question", "order", "createdAt", "updatedAt")
SELECT 'q' || n || '_' || p."id", p."id", 'หัวข้อที่ ' || n, n - 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project" p CROSS JOIN generate_series(1, 3) AS n;

UPDATE "Project" SET "status" = 'DRAFT' WHERE "status" = 'OPEN';
