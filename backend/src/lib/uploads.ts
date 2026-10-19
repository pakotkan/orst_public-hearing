import { mkdir, unlink } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from './env'
import { HttpError } from './errors'

const MAX_PDF_BYTES = 10 * 1024 * 1024

/** Project PDFs live in the old `posts` folder, so files uploaded before the move keep their URLs. */
const PDF_FOLDER = 'posts'
const PDF_URL_PREFIX = `/uploads/${PDF_FOLDER}/`

const uploadRoot = resolve(env.UPLOAD_DIR)

/** Saves an uploaded PDF under UPLOAD_DIR/posts/ with a random name and returns its public URL. */
export async function savePdf(file: File): Promise<string> {
  const ext = extname(file.name || '').slice(1).toLowerCase()
  if (ext !== 'pdf') throw new HttpError(400, 'รองรับเฉพาะไฟล์ PDF')
  if (file.size === 0) throw new HttpError(400, 'ไฟล์ว่างเปล่า')
  if (file.size > MAX_PDF_BYTES) throw new HttpError(400, 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB')
  // Check the file really is a PDF, not just named like one.
  const magic = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer())
  if (magic !== '%PDF-') throw new HttpError(400, 'ไฟล์นี้ไม่ใช่ PDF ที่ถูกต้อง')

  const dir = join(uploadRoot, PDF_FOLDER)
  await mkdir(dir, { recursive: true })
  const storedName = `${randomUUID()}.pdf`
  await Bun.write(join(dir, storedName), file)
  return PDF_URL_PREFIX + storedName
}

/** Deletes a PDF previously returned by `savePdf`. URLs that aren't ours are ignored. */
export async function deletePdf(url: string | null | undefined) {
  if (!url?.startsWith(PDF_URL_PREFIX)) return
  await unlink(join(uploadRoot, PDF_FOLDER, basename(url))).catch(() => {})
}

/** Resolves a /uploads/* request path to a file on disk, refusing path traversal. */
export function resolveUploadPath(relative: string): string | null {
  const full = resolve(uploadRoot, relative)
  return full.startsWith(uploadRoot + '/') || full.startsWith(uploadRoot + '\\') ? full : null
}
