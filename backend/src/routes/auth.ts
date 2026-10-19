import { Elysia, t } from 'elysia'
import { prisma, publicUserSelect } from '../lib/db'
import { authPlugin, SESSION_MAX_AGE } from '../lib/auth'
import { env } from '../lib/env'
import { HttpError } from '../lib/errors'

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE,
  path: '/',
  maxAge: SESSION_MAX_AGE,
}

export const nameField = t.String({ minLength: 1, maxLength: 100 })
export const emailField = t.String({ format: 'email', maxLength: 255 })
export const passwordField = t.String({ minLength: 8, maxLength: 128 })
/** Digits with an optional leading +; spaces and dashes are allowed and stripped by `normalizePhone`. */
export const phoneField = t.String({ maxLength: 20, pattern: '^\\+?[0-9][0-9 -]{7,18}$' })

export function normalizePhone(phone: string) {
  return phone.replace(/[\s-]/g, '')
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authPlugin)
  .post(
    '/register',
    async ({ body, jwt, cookie: { token } }) => {
      const email = body.email.trim().toLowerCase()
      const firstName = body.firstName.trim()
      const lastName = body.lastName.trim()
      if (!firstName || !lastName) throw new HttpError(422, 'กรุณากรอกชื่อและนามสกุล')

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) throw new HttpError(409, 'อีเมลนี้ถูกใช้สมัครสมาชิกแล้ว')

      const user = await prisma.user.create({
        data: {
          firstName,
          lastName,
          email,
          phone: normalizePhone(body.phone),
          passwordHash: await Bun.password.hash(body.password),
        },
        select: publicUserSelect,
      })
      token.set({ value: await jwt.sign({ sub: user.id }), ...cookieOptions })
      return { user }
    },
    {
      body: t.Object({
        firstName: nameField,
        lastName: nameField,
        email: emailField,
        phone: phoneField,
        password: passwordField,
      }),
    },
  )
  .post(
    '/login',
    async ({ body, jwt, cookie: { token } }) => {
      const email = body.email.trim().toLowerCase()
      const user = await prisma.user.findUnique({ where: { email } })
      const valid = user ? await Bun.password.verify(body.password, user.passwordHash) : false
      if (!user || !valid) throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
      if (user.status !== 'ACTIVE') throw new HttpError(403, 'บัญชีนี้ถูกปิดการใช้งาน')

      token.set({ value: await jwt.sign({ sub: user.id }), ...cookieOptions })
      const { id, firstName, lastName, role } = user
      return { user: { id, firstName, lastName, email: user.email, role } }
    },
    {
      body: t.Object({
        email: t.String({ maxLength: 255 }),
        password: t.String({ maxLength: 128 }),
      }),
    },
  )
  .post('/logout', ({ cookie: { token } }) => {
    token.set({ value: '', ...cookieOptions, maxAge: 0 })
    return { ok: true }
  })
  .get('/me', ({ user }) => ({ user }))
