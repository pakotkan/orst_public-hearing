import { Elysia, t } from 'elysia'
import { authorSelect, prisma } from '../lib/db'
import { authPlugin, requireUser } from '../lib/auth'
import { HttpError } from '../lib/errors'
import { excerpt } from '../lib/html'
import {
  cleanTopicAnswers,
  PUBLIC_STATUSES,
  responseSelect,
  saveResponse,
  summaryTopicsInclude,
  topicAnswersField,
} from '../lib/projects'

async function getPublicProject(id: string) {
  const project = await prisma.project.findFirst({
    where: { id, status: { in: [...PUBLIC_STATUSES] } },
    select: { id: true, status: true },
  })
  if (!project) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
  return project
}

/**
 * Public endpoints: anyone can read OPEN and CLOSED projects. Responding needs login, and only while OPEN.
 * Responses are private: a user sees only their own; admins use the /admin routes.
 */
export const projectRoutes = new Elysia()
  .use(authPlugin)
  .get('/projects', async ({ user }) => {
    const [projects, mine] = await Promise.all([
      prisma.project.findMany({
        where: { status: { in: [...PUBLIC_STATUSES] } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          createdBy: { select: authorSelect },
          _count: { select: { summaryTopics: true } },
        },
      }),
      user ? prisma.response.findMany({ where: { userId: user.id }, select: { projectId: true } }) : [],
    ])
    const responded = new Set(mine.map((r) => r.projectId))
    return {
      projects: projects.map(({ description, ...project }) => ({
        ...project,
        excerpt: excerpt(description ?? ''),
        responded: responded.has(project.id),
      })),
    }
  })
  .get('/projects/:id', async ({ params }) => {
    const project = await prisma.project.findFirst({
      where: { id: params.id, status: { in: [...PUBLIC_STATUSES] } },
      select: {
        id: true,
        title: true,
        description: true,
        pdfUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: authorSelect },
        summaryTopics: summaryTopicsInclude,
      },
    })
    if (!project) throw new HttpError(404, 'ไม่พบเรื่องที่ต้องการ')
    return { project }
  })

  // ---- The logged-in user's own response ----
  .get('/projects/:id/response', async ({ params, user }) => {
    const me = requireUser(user)
    await getPublicProject(params.id)
    const response = await prisma.response.findUnique({
      where: { projectId_userId: { projectId: params.id, userId: me.id } },
      select: responseSelect,
    })
    return { response }
  })
  .put(
    '/projects/:id/response',
    async ({ params, body, user }) => {
      const me = requireUser(user)
      const project = await getPublicProject(params.id)
      if (project.status !== 'OPEN') throw new HttpError(409, 'เรื่องนี้ปิดรับฟังความคิดเห็นแล้ว')

      const answers = await cleanTopicAnswers(project.id, body.topicAnswers)
      const id = await saveResponse(project.id, me.id, body.isAnonymous ?? false, answers)
      const response = await prisma.response.findUniqueOrThrow({ where: { id }, select: responseSelect })
      return { response }
    },
    { body: t.Object({ isAnonymous: t.Optional(t.Boolean()), topicAnswers: topicAnswersField }) },
  )
  .delete('/projects/:id/response', async ({ params, user }) => {
    const me = requireUser(user)
    const project = await getPublicProject(params.id)
    if (project.status !== 'OPEN') throw new HttpError(409, 'เรื่องนี้ปิดรับฟังความคิดเห็นแล้ว')
    await prisma.response.deleteMany({ where: { projectId: project.id, userId: me.id } })
    return { ok: true }
  })
