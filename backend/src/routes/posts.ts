import { Elysia, t } from 'elysia'
import { authorSelect, prisma } from '../lib/db'
import { authPlugin, requireUser, type AuthUser } from '../lib/auth'
import { HttpError } from '../lib/errors'
import { excerpt } from '../lib/html'
import { withUrl } from '../lib/uploads'

const COMMENTS_PAGE_SIZE = 20

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  user: { select: authorSelect },
} as const

const attachmentSelect = {
  id: true,
  originalName: true,
  storedName: true,
  mimeType: true,
  size: true,
} as const

/**
 * Comments are private: admins see every comment, users only their own, guests none (null).
 */
function visibleComments(user: AuthUser | null) {
  if (!user) return null
  return user.role === 'ADMIN' ? {} : { userId: user.id }
}

async function getPublishedPost(id: string) {
  const post = await prisma.post.findFirst({ where: { id, isPublished: true }, select: { id: true } })
  if (!post) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
  return post
}

/** Public endpoints: anyone can read published posts; commenting requires login. */
export const postRoutes = new Elysia()
  .use(authPlugin)
  .get('/posts', async ({ user }) => {
    // Guests get a filter that matches nothing; the frontend doesn't show them a count.
    const commentWhere = visibleComments(user) ?? { id: '' }
    const posts = await prisma.post.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: { select: authorSelect },
        attachments: {
          where: { mimeType: { startsWith: 'image/' } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: attachmentSelect,
        },
        _count: { select: { comments: { where: commentWhere }, attachments: true } },
      },
    })
    return {
      posts: posts.map(({ content, attachments, ...post }) => ({
        ...post,
        excerpt: excerpt(content),
        coverImage: attachments[0] ? withUrl(attachments[0]).url : null,
      })),
    }
  })
  .get('/posts/:id', async ({ params }) => {
    const post = await prisma.post.findFirst({
      where: { id: params.id, isPublished: true },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        author: { select: authorSelect },
        attachments: { orderBy: { createdAt: 'asc' }, select: attachmentSelect },
      },
    })
    if (!post) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
    return { post: { ...post, attachments: post.attachments.map(withUrl) } }
  })
  .get(
    '/posts/:id/comments',
    async ({ params, query, user }) => {
      await getPublishedPost(params.id)
      const page = Math.max(1, query.page ?? 1)
      const visible = visibleComments(user)
      if (!visible) return { comments: [], total: 0, page, pageSize: COMMENTS_PAGE_SIZE }
      const where = { postId: params.id, ...visible }
      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * COMMENTS_PAGE_SIZE,
          take: COMMENTS_PAGE_SIZE,
          select: commentSelect,
        }),
        prisma.comment.count({ where }),
      ])
      return { comments, total, page, pageSize: COMMENTS_PAGE_SIZE }
    },
    { query: t.Object({ page: t.Optional(t.Numeric({ minimum: 1 })) }) },
  )
  .post(
    '/posts/:id/comments',
    async ({ params, body, user, set }) => {
      const author = requireUser(user)
      await getPublishedPost(params.id)
      const content = body.content.trim()
      if (!content) throw new HttpError(422, 'กรุณาพิมพ์ความคิดเห็น')

      const comment = await prisma.comment.create({
        data: { content, postId: params.id, userId: author.id },
        select: commentSelect,
      })
      set.status = 201
      return { comment }
    },
    { body: t.Object({ content: t.String({ minLength: 1, maxLength: 2000 }) }) },
  )
  .delete('/comments/:id', async ({ params, user }) => {
    const actor = requireUser(user)
    const comment = await prisma.comment.findUnique({ where: { id: params.id } })
    if (!comment) throw new HttpError(404, 'ไม่พบความคิดเห็น')
    if (comment.userId !== actor.id && actor.role !== 'ADMIN') {
      throw new HttpError(403, 'คุณลบได้เฉพาะความคิดเห็นของตนเองเท่านั้น')
    }
    await prisma.comment.delete({ where: { id: params.id } })
    return { ok: true }
  })
