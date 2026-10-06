import { prisma } from './db'
import { env } from './env'

/** Ensures the admin account from ADMIN_EMAIL / ADMIN_PASSWORD exists. */
export async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return
  const email = env.ADMIN_EMAIL.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'ADMIN' || existing.isBanned) {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN', isBanned: false } })
    }
    return
  }

  await prisma.user.create({
    data: {
      firstName: env.ADMIN_FIRST_NAME,
      lastName: env.ADMIN_LAST_NAME,
      email,
      passwordHash: await Bun.password.hash(env.ADMIN_PASSWORD),
      role: 'ADMIN',
    },
  })
  console.log(`Created admin account ${email}`)
}
