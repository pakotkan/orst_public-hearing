import { Elysia, t } from 'elysia'
import type { Prisma } from '@prisma/client'
import { authorSelect, prisma } from '../lib/db'
import { authPlugin, requireAdmin } from '../lib/auth'
import { HttpError } from '../lib/errors'
import { sanitizeRichText } from '../lib/html'
import { ATTACHMENT_FOLDER, deleteFile, saveFile, withUrl } from '../lib/uploads'
import { emailField, nameField, passwordField } from './auth'

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
  role: true,
  isBanned: true,
  createdAt: true,
  _count: { select: { comments: true } },
} as const

const roleField = t.Union([t.Literal('USER'), t.Literal('ADMIN')])

async function findPost(id: string) {
  const post = await prisma.post.findUnique({ where: { id }, select: { id: true } })
  if (!post) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
  return post
}

function cleanContent(html: string) {
  if (html.length > MAX_CONTENT_LENGTH) throw new HttpError(422, 'เนื้อหายาวเกินกำหนด')
  return sanitizeRichText(html)
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

  // ---- Posts ----
  .get('/posts', async () => {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        isPublished: true,
        createdAt: true,
        updatedAt: true,
        author: { select: authorSelect },
        _count: { select: { comments: true, attachments: true } },
      },
    })
    return { posts }
  })
  .get('/posts/:id', async ({ params }) => {
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
    })
    if (!post) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
    return { post: { ...post, attachments: post.attachments.map(withUrl) } }
  })
  .post(
    '/posts',
    async ({ body, user, set }) => {
      const admin = requireAdmin(user)
      const post = await prisma.post.create({
        data: {
          title: body.title.trim(),
          content: cleanContent(body.content),
          isPublished: body.isPublished ?? true,
          authorId: admin.id,
        },
      })
      set.status = 201
      return { post }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        content: t.String(),
        isPublished: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    '/posts/:id',
    async ({ params, body }) => {
      await findPost(params.id)
      const post = await prisma.post.update({
        where: { id: params.id },
        data: {
          title: body.title?.trim(),
          content: body.content === undefined ? undefined : cleanContent(body.content),
          isPublished: body.isPublished,
        },
      })
      return { post }
    },
    {
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        content: t.Optional(t.String()),
        isPublished: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete('/posts/:id', async ({ params }) => {
    await findPost(params.id)
    const attachments = await prisma.attachment.findMany({ where: { postId: params.id } })
    await prisma.post.delete({ where: { id: params.id } })
    await Promise.all(attachments.map((a) => deleteFile(a.storedName, ATTACHMENT_FOLDER)))
    return { ok: true }
  })

  // ---- Attachments ----
  .post(
    '/posts/:id/attachments',
    async ({ params, body, set }) => {
      await findPost(params.id)
      const saved = await saveFile(body.file, ATTACHMENT_FOLDER)
      const attachment = await prisma.attachment.create({ data: { ...saved, postId: params.id } })
      set.status = 201
      return { attachment: withUrl(attachment) }
    },
    { body: t.Object({ file: t.File() }) },
  )
  .delete('/attachments/:id', async ({ params }) => {
    const attachment = await prisma.attachment.findUnique({ where: { id: params.id } })
    if (!attachment) throw new HttpError(404, 'ไม่พบไฟล์แนบ')
    await prisma.attachment.delete({ where: { id: params.id } })
    await deleteFile(attachment.storedName, ATTACHMENT_FOLDER)
    return { ok: true }
  })

  // ---- Comments (per post) ----
  .get(
    '/posts/:id/comments',
    async ({ params, query }) => {
      await findPost(params.id)
      const page = Math.max(1, query.page ?? 1)
      const where: Prisma.CommentWhereInput = { postId: params.id }
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
      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: { id: true, content: true, createdAt: true, user: { select: authorSelect } },
        }),
        prisma.comment.count({ where }),
      ])
      return { comments, total, page, pageSize: PAGE_SIZE }
    },
    {
      query: t.Object({
        ...pageQuery,
        from: t.Optional(t.String({ format: 'date-time' })),
        to: t.Optional(t.String({ format: 'date-time' })),
      }),
    },
  )
  .delete('/comments/:id', async ({ params }) => {
    const existing = await prisma.comment.findUnique({ where: { id: params.id } })
    if (!existing) throw new HttpError(404, 'ไม่พบความคิดเห็น')
    await prisma.comment.delete({ where: { id: params.id } })
    return { ok: true }
  })

  // ---- Users ----
  .get(
    '/users',
    async ({ query }) => {
      const page = Math.max(1, query.page ?? 1)
      const where: Prisma.UserWhereInput = query.q
        ? {
            OR: [
              { firstName: { contains: query.q, mode: 'insensitive' } },
              { lastName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
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
      if (isSelf && (body.role === 'USER' || body.isBanned === true)) {
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
          role: body.role,
          isBanned: body.isBanned,
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
        password: t.Optional(passwordField),
        role: t.Optional(roleField),
        isBanned: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete('/users/:id', async ({ params, user }) => {
    const admin = requireAdmin(user)
    if (params.id === admin.id) throw new HttpError(400, 'ไม่สามารถลบบัญชีของตนเองได้')
    const existing = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!existing) throw new HttpError(404, 'ไม่พบผู้ใช้งาน')
    // Their comments are removed (cascade); posts they wrote stay, with no author.
    await prisma.user.delete({ where: { id: params.id } })
    return { ok: true }
  })
