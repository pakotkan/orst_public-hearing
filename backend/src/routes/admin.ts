import { Elysia, t } from 'elysia'
import type { Prisma } from '@prisma/client'
import { authorSelect, prisma } from '../lib/db'
import { authPlugin, requireAdmin } from '../lib/auth'
import { HttpError } from '../lib/errors'
import { sanitizeRichText } from '../lib/html'
import { responseSelect, summaryTopicsField, summaryTopicsInclude, syncSummaryTopics } from '../lib/projects'
import { deletePdf, savePdf } from '../lib/uploads'
import { emailField, nameField, normalizePhone, passwordField, phoneField } from './auth'

const PAGE_SIZE = 25
const MAX_CONTENT_LENGTH = 200_000

const pageQuery = {
  page: t.Optional(t.Numeric({ minimum: 1 })),
  q: t.Optional(t.String({ maxLength: 200 })),
}

const adminUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  _count: { select: { responses: true } },
} as const

const roleField = t.Union([t.Literal('USER'), t.Literal('ADMIN')])
const statusField = t.Union([t.Literal('ACTIVE'), t.Literal('INACTIVE')])
const projectStatusField = t.Union([t.Literal('DRAFT'), t.Literal('OPEN'), t.Literal('CLOSED')])

async function findProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, pdfUrl: true } })
  if (!project) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
  return project
}

function cleanDescription(html: string) {
  if (html.length > MAX_CONTENT_LENGTH) throw new HttpError(422, 'เนื้อหายาวเกินกำหนด')
  return sanitizeRichText(html) || null
}

/** A project can only be opened to the public once it has at least one topic. */
async function assertCanOpen(tx: Prisma.TransactionClient, projectId: string) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { status: true, _count: { select: { summaryTopics: true } } },
  })
  if (project.status === 'OPEN' && project._count.summaryTopics === 0) {
    throw new HttpError(422, 'ต้องมีหัวข้ออย่างน้อย 1 หัวข้อก่อนเปิดรับฟังความคิดเห็น')
  }
}

async function getAdminProject(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      pdfUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      summaryTopics: {
        ...summaryTopicsInclude,
        select: { ...summaryTopicsInclude.select, _count: { select: { answers: true } } },
      },
      _count: { select: { responses: true } },
    },
  })
  if (!project) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
  return project
}

async function assertEmailFree(email: string, exceptUserId?: string) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing && existing.id !== exceptUserId) throw new HttpError(409, 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว')
}

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authPlugin)
  .onBeforeHandle(({ user }) => {
    requireAdmin(user)
  })

  // ---- Projects ----
  .get('/projects', async () => {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: authorSelect },
        _count: { select: { summaryTopics: true, responses: true } },
      },
    })
    return { projects }
  })
  .get('/projects/:id', async ({ params }) => ({ project: await getAdminProject(params.id) }))
  .post(
    '/projects',
    async ({ body, user, set }) => {
      const admin = requireAdmin(user)
      const id = await prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            title: body.title.trim(),
            description: cleanDescription(body.description ?? ''),
            status: body.status ?? 'DRAFT',
            createdById: admin.id,
          },
          select: { id: true },
        })
        await syncSummaryTopics(tx, project.id, body.summaryTopics ?? [])
        await assertCanOpen(tx, project.id)
        return project.id
      })
      set.status = 201
      return { project: await getAdminProject(id) }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String()),
        status: t.Optional(projectStatusField),
        summaryTopics: t.Optional(summaryTopicsField),
      }),
    },
  )
  .patch(
    '/projects/:id',
    async ({ params, body }) => {
      await findProject(params.id)
      await prisma.$transaction(async (tx) => {
        await tx.project.update({
          where: { id: params.id },
          data: {
            title: body.title?.trim(),
            description: body.description === undefined ? undefined : cleanDescription(body.description),
            status: body.status,
          },
        })
        if (body.summaryTopics) await syncSummaryTopics(tx, params.id, body.summaryTopics)
        await assertCanOpen(tx, params.id)
      })
      return { project: await getAdminProject(params.id) }
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        description: t.Optional(t.String()),
        status: t.Optional(projectStatusField),
        summaryTopics: t.Optional(summaryTopicsField),
      }),
    },
  )
  .delete('/projects/:id', async ({ params }) => {
    const project = await findProject(params.id)
    // Topics, responses and answers are removed with it (cascade).
    await prisma.project.delete({ where: { id: params.id } })
    await deletePdf(project.pdfUrl)
    return { ok: true }
  })

  // ---- The project's PDF (one per project; uploading again replaces it) ----
  .put(
    '/projects/:id/pdf',
    async ({ params, body }) => {
      const project = await findProject(params.id)
      const pdfUrl = await savePdf(body.file)
      await prisma.project.update({ where: { id: params.id }, data: { pdfUrl } })
      await deletePdf(project.pdfUrl)
      return { pdfUrl }
    },
    { body: t.Object({ file: t.File() }) },
  )
  .delete('/projects/:id/pdf', async ({ params }) => {
    const project = await findProject(params.id)
    await prisma.project.update({ where: { id: params.id }, data: { pdfUrl: null } })
    await deletePdf(project.pdfUrl)
    return { ok: true }
  })

  // ---- Responses (per project) ----
  .get(
    '/projects/:id/responses',
    async ({ params, query }) => {
      await findProject(params.id)
      const page = Math.max(1, query.page ?? 1)
      const where: Prisma.ResponseWhereInput = { projectId: params.id }
      // Every word must match the first or last name, so "Malee Suksai" finds Malee Suksai.
      const words = query.q?.trim().split(/\s+/).filter(Boolean) ?? []
      if (words.length) {
        where.AND = words.map((w) => ({
          user: {
            OR: [
              { firstName: { contains: w, mode: 'insensitive' } },
              { lastName: { contains: w, mode: 'insensitive' } },
            ],
          },
        }))
      }
      // `from` and `to` are instants the browser computed from the admin's local dates (to is exclusive).
      if (query.from || query.to) {
        where.createdAt = {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lt: new Date(query.to) }),
        }
      }
      const [responses, total] = await Promise.all([
        prisma.response.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: { ...responseSelect, user: { select: authorSelect } },
        }),
        prisma.response.count({ where }),
      ])
      return { responses, total, page, pageSize: PAGE_SIZE }
    },
    {
      query: t.Object({
        ...pageQuery,
        from: t.Optional(t.String({ format: 'date-time' })),
        to: t.Optional(t.String({ format: 'date-time' })),
      }),
    },
  )
  .delete('/responses/:id', async ({ params }) => {
    const existing = await prisma.response.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!existing) throw new HttpError(404, 'ไม่พบคำตอบ')
    await prisma.response.delete({ where: { id: params.id } })
    return { ok: true }
  })

  /** Totals per topic: yes and no counts, how many yes answers left a comment, and the agencies named. */
  .get('/projects/:id/summary', async ({ params }) => {
    await findProject(params.id)
    const inProject = { summaryTopic: { projectId: params.id } }
    const [topics, totalResponses, votes, comments, agencies] = await Promise.all([
      prisma.summaryTopic.findMany({ where: { projectId: params.id }, select: { id: true } }),
      prisma.response.count({ where: { projectId: params.id } }),
      prisma.topicAnswer.groupBy({ by: ['summaryTopicId', 'agreement'], where: inProject, _count: { _all: true } }),
      prisma.topicAnswer.groupBy({
        by: ['summaryTopicId'],
        where: { ...inProject, additionalComment: { not: null } },
        _count: { _all: true },
      }),
      prisma.topicAnswer.groupBy({
        by: ['summaryTopicId', 'relatedAgency'],
        where: { ...inProject, relatedAgency: { not: null } },
        _count: { _all: true },
      }),
    ])
    const count = (topicId: string, agreement: boolean) =>
      votes.find((v) => v.summaryTopicId === topicId && v.agreement === agreement)?._count._all ?? 0
    const commentsBy = new Map(comments.map((c) => [c.summaryTopicId, c._count._all]))

    return {
      totalResponses,
      topics: Object.fromEntries(
        topics.map((topic) => [
          topic.id,
          {
            yes: count(topic.id, true),
            no: count(topic.id, false),
            withComment: commentsBy.get(topic.id) ?? 0,
            // Most-named agencies first.
            agencies: agencies
              .filter((a) => a.summaryTopicId === topic.id)
              .map((a) => ({ name: a.relatedAgency!, count: a._count._all }))
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th')),
          },
        ]),
      ),
    }
  })

  // ---- Users ----
  .get(
    '/users',
    async ({ query }) => {
      const page = Math.max(1, query.page ?? 1)
      const phone = query.q && /\d/.test(query.q) ? normalizePhone(query.q) : ''
      const where: Prisma.UserWhereInput = query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              ...(phone ? [{ phone: { contains: phone } }] : []),
            ],
          }
        : {}
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: adminUserSelect,
        }),
        prisma.user.count({ where }),
      ])
      return { users, total, page, pageSize: PAGE_SIZE }
    },
    { query: t.Object(pageQuery) },
  )
  .post(
    '/users',
    async ({ body, set }) => {
      const email = body.email.trim().toLowerCase()
      await assertEmailFree(email)
      const user = await prisma.user.create({
        data: {
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          email,
          phone: normalizePhone(body.phone),
          passwordHash: await Bun.password.hash(body.password),
          role: body.role ?? 'USER',
        },
        select: adminUserSelect,
      })
      set.status = 201
      return { user }
    },
    {
      body: t.Object({
        firstName: nameField,
        lastName: nameField,
        email: emailField,
        phone: phoneField,
        password: passwordField,
        role: t.Optional(roleField),
      }),
    },
  )
  .patch(
    '/users/:id',
    async ({ params, body, user }) => {
      const admin = requireAdmin(user)
      const isSelf = params.id === admin.id
      if (isSelf && (body.role === 'USER' || body.status === 'INACTIVE')) {
        throw new HttpError(400, 'ไม่สามารถยกเลิกสิทธิ์ผู้ดูแลระบบหรือระงับบัญชีของตนเองได้')
      }
      const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } })
      if (!existing) throw new HttpError(404, 'ไม่พบผู้ใช้งาน')

      const email = body.email?.trim().toLowerCase()
      if (email) await assertEmailFree(email, params.id)

      const updated = await prisma.user.update({
        where: { id: params.id },
        data: {
          firstName: body.firstName?.trim(),
          lastName: body.lastName?.trim(),
          email,
          phone: body.phone === undefined ? undefined : normalizePhone(body.phone),
          role: body.role,
          status: body.status,
          passwordHash: body.password ? await Bun.password.hash(body.password) : undefined,
        },
        select: adminUserSelect,
      })
      return { user: updated }
    },
    {
      body: t.Object({
        firstName: t.Optional(nameField),
        lastName: t.Optional(nameField),
        email: t.Optional(emailField),
        phone: t.Optional(phoneField),
        password: t.Optional(passwordField),
        role: t.Optional(roleField),
        status: t.Optional(statusField),
      }),
    },
  )
  .delete('/users/:id', async ({ params, user }) => {
    const admin = requireAdmin(user)
    if (params.id === admin.id) throw new HttpError(400, 'ไม่สามารถลบบัญชีของตนเองได้')
    const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!existing) throw new HttpError(404, 'ไม่พบผู้ใช้งาน')
    // Soft delete: the account can no longer log in, but its projects and responses are kept.
    // An admin can restore it by setting status back to ACTIVE.
    await prisma.user.update({ where: { id: params.id }, data: { status: 'INACTIVE' } })
    return { ok: true }
  })
