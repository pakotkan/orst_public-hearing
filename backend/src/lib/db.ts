import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const

/** What other visitors may see about a comment or post author. */
export const authorSelect = { id: true, firstName: true, lastName: true } as const
