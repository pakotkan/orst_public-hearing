import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const

/** What may be shown about another user, e.g. a project's creator or a response's author (to admins). */
export const authorSelect = { id: true, firstName: true, lastName: true } as const
