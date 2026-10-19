import { t } from 'elysia'
import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import { HttpError } from './errors'

export const MAX_COMMENT_LENGTH = 5000
export const MAX_AGENCY_LENGTH = 300

/** Statuses the public can see. DRAFT projects exist only in the admin pages. */
export const PUBLIC_STATUSES = ['OPEN', 'CLOSED'] as const

export const summaryTopicsInclude = {
  orderBy: { order: 'asc' },
  select: { id: true, title: true, order: true },
} as const satisfies Prisma.Project$summaryTopicsArgs

// ---- Admin: editing a project's topics ----

/** Topics in display order. Items with an `id` update that topic; items without one are created. */
export const summaryTopicsField = t.Array(
  t.Object({
    id: t.Optional(t.String()),
    title: t.String({ minLength: 1, maxLength: 1000 }),
  }),
  { maxItems: 50 },
)

export type SummaryTopicInput = (typeof summaryTopicsField)['static'][number]

/** Makes the project's topics match `input`, in that order. Topics left out are deleted, with their answers. */
export async function syncSummaryTopics(tx: Prisma.TransactionClient, projectId: string, input: SummaryTopicInput[]) {
  const existing = new Set(
    (await tx.summaryTopic.findMany({ where: { projectId }, select: { id: true } })).map((t) => t.id),
  )
  const keep = new Set<string>()
  for (const topic of input) {
    if (!topic.title.trim()) throw new HttpError(422, 'กรุณากรอกหัวข้อให้ครบ')
    if (topic.id) {
      if (!existing.has(topic.id) || keep.has(topic.id)) throw new HttpError(400, 'ข้อมูลหัวข้อไม่ถูกต้อง')
      keep.add(topic.id)
    }
  }

  await tx.summaryTopic.deleteMany({ where: { projectId, id: { notIn: [...keep] } } })
  // `order` is unique per project, so move the kept topics out of the way (to negative positions) before
  // writing the new order; otherwise swapping two topics would briefly collide.
  await tx.$executeRaw`UPDATE "SummaryTopic" SET "order" = -"order" - 1 WHERE "projectId" = ${projectId}`
  for (const [order, topic] of input.entries()) {
    const data = { title: topic.title.trim(), order }
    if (topic.id) await tx.summaryTopic.update({ where: { id: topic.id }, data })
    else await tx.summaryTopic.create({ data: { ...data, projectId } })
  }
}

// ---- Users: submitting a response ----

export const topicAnswersField = t.Array(
  t.Object({
    summaryTopicId: t.String(),
    agreement: t.Boolean(),
    additionalComment: t.Optional(t.String({ maxLength: MAX_COMMENT_LENGTH })),
    relatedAgency: t.Optional(t.String({ maxLength: MAX_AGENCY_LENGTH })),
  }),
  { maxItems: 50 },
)

export type TopicAnswerInput = (typeof topicAnswersField)['static'][number]
type CleanAnswer = { summaryTopicId: string; agreement: boolean; additionalComment: string | null; relatedAgency: string | null }

/**
 * Every topic must be answered exactly once. The comment and agency are optional and kept only with
 * a "yes"; for a "no" they are dropped, since a "no" can only be submitted as is.
 */
export async function cleanTopicAnswers(projectId: string, input: TopicAnswerInput[]): Promise<CleanAnswer[]> {
  const topicIds = new Set(
    (await prisma.summaryTopic.findMany({ where: { projectId }, select: { id: true } })).map((t) => t.id),
  )
  const answered = new Set<string>()
  const answers: CleanAnswer[] = []
  for (const a of input) {
    if (!topicIds.has(a.summaryTopicId) || answered.has(a.summaryTopicId)) throw new HttpError(400, 'ข้อมูลคำตอบไม่ถูกต้อง')
    answered.add(a.summaryTopicId)
    answers.push({
      summaryTopicId: a.summaryTopicId,
      agreement: a.agreement,
      additionalComment: (a.agreement && a.additionalComment?.trim()) || null,
      relatedAgency: (a.agreement && a.relatedAgency?.trim()) || null,
    })
  }
  if (answered.size !== topicIds.size) throw new HttpError(422, 'กรุณาตอบให้ครบทุกหัวข้อ')
  return answers
}

/** Creates or replaces the user's response to a project. The first submission time is kept. */
export async function saveResponse(projectId: string, userId: string, isAnonymous: boolean, answers: CleanAnswer[]) {
  return prisma.$transaction(async (tx) => {
    const response = await tx.response.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, isAnonymous },
      update: { isAnonymous },
      select: { id: true },
    })
    await tx.topicAnswer.deleteMany({ where: { responseId: response.id } })
    await tx.topicAnswer.createMany({ data: answers.map((a) => ({ ...a, responseId: response.id })) })
    return response.id
  })
}

export const responseSelect = {
  id: true,
  isAnonymous: true,
  createdAt: true,
  topicAnswers: { select: { summaryTopicId: true, agreement: true, additionalComment: true, relatedAgency: true } },
} as const satisfies Prisma.ResponseSelect
