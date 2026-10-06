import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { prisma, publicUserSelect } from './db'
import { env } from './env'
import { HttpError } from './errors'

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export type AuthUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'USER' | 'ADMIN'
}

/** Resolves the logged-in user (or null) from the `token` cookie. */
export const authPlugin = new Elysia({ name: 'auth' })
  .use(jwt({ name: 'jwt', secret: env.JWT_SECRET, exp: '7d' }))
  .derive({ as: 'global' }, async ({ jwt, cookie: { token } }) => {
    const raw = token?.value
    if (typeof raw !== 'string' || !raw) return { user: null as AuthUser | null }

    const payload = await jwt.verify(raw)
    if (!payload || typeof payload.sub !== 'string') return { user: null as AuthUser | null }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { ...publicUserSelect, isBanned: true },
    })
    if (!user || user.isBanned) return { user: null as AuthUser | null }

    const { isBanned: _, ...authUser } = user
    return { user: authUser as AuthUser | null }
  })

export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) throw new HttpError(401, 'กรุณาเข้าสู่ระบบก่อน')
  return user
}

export function requireAdmin(user: AuthUser | null): AuthUser {
  const u = requireUser(user)
  if (u.role !== 'ADMIN') throw new HttpError(403, 'เฉพาะผู้ดูแลระบบเท่านั้น')
  return u
}
