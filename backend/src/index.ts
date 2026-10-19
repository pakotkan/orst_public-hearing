import { Elysia } from 'elysia'
import { env } from './lib/env'
import { HttpError } from './lib/errors'
import { resolveUploadPath } from './lib/uploads'
import { ensureAdmin } from './lib/seed'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { adminRoutes } from './routes/admin'

/** Thai names for request fields, used in validation error messages. */
const FIELD_LABELS: Record<string, string> = {
  firstName: 'ชื่อ',
  lastName: 'นามสกุล',
  email: 'อีเมล',
  password: 'รหัสผ่าน',
  phone: 'เบอร์โทรศัพท์',
  role: 'บทบาท',
  status: 'สถานะ',
  title: 'ชื่อเรื่อง',
  description: 'รายละเอียด',
  summaryTopics: 'หัวข้อ',
  topicAnswers: 'คำตอบ',
  file: 'ไฟล์',
  page: 'หน้า',
}

const api = new Elysia({ prefix: '/api' })
  .get('/health', () => ({ ok: true }))
  .use(authRoutes)
  .use(projectRoutes)
  .use(adminRoutes)

const app = new Elysia()
  .onError({ as: 'global' }, ({ code, error, set }) => {
    if (error instanceof HttpError) {
      set.status = error.status
      return { error: error.message }
    }
    if (code === 'VALIDATION') {
      set.status = 422
      // Nested paths like /summaryTopics/0/title are reported by their top-level field.
      const field = error.valueError?.path?.replace(/^\//, '').split('/')[0]
      return { error: field ? `ข้อมูล "${FIELD_LABELS[field] ?? field}" ไม่ถูกต้อง` : 'ข้อมูลไม่ถูกต้อง' }
    }
    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'ไม่พบข้อมูลที่ต้องการ' }
    }
    if (code === 'PARSE') {
      set.status = 400
      return { error: 'รูปแบบข้อมูลที่ส่งมาไม่ถูกต้อง' }
    }
    console.error(error)
    set.status = 500
    return { error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง' }
  })
  // In production Nginx serves /uploads directly; this route is for local development.
  .get('/uploads/*', ({ params }) => {
    const path = resolveUploadPath(params['*'])
    if (!path) throw new HttpError(404, 'ไม่พบไฟล์')
    const file = Bun.file(path)
    return file.size > 0 ? file : new Response('Not found', { status: 404 })
  })
  .use(api)

await ensureAdmin()
app.listen({ port: env.PORT, hostname: '0.0.0.0' })
console.log(`API listening on http://0.0.0.0:${env.PORT}`)
