import { prisma } from './db'
import { env } from './env'

/** Ensures the admin account from ADMIN_EMAIL / ADMIN_PASSWORD exists. */
export async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return
  const email = env.ADMIN_EMAIL.trim().toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'ADMIN' || existing.status !== 'ACTIVE') {
      await prisma.user.update({ where: { email }, data: { role: 'ADMIN', status: 'ACTIVE' } })
    }
    return
  }

  await prisma.user.create({
    data: {
      firstName: env.ADMIN_FIRST_NAME,
      lastName: env.ADMIN_LAST_NAME,
      email,
      passwordHash: await Bun.password.hash(env.ADMIN_PASSWORD),
      // The seeded admin has no phone number; it can be added on the admin users page.
      phone: '',
      role: 'ADMIN',
    },
  })
  console.log(`Created admin account ${email}`)
}
