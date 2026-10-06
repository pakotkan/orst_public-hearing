import { mkdir, unlink } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from './env'
import { HttpError } from './errors'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ATTACHMENT_FOLDER = 'posts'

/** Allowed attachment extensions and the MIME type we record for each. HTML/SVG are excluded on purpose. */
const ALLOWED: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
}

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED)

const uploadRoot = resolve(env.UPLOAD_DIR)

export type SavedFile = { originalName: string; storedName: string; mimeType: string; size: number }

/** Saves an uploaded file under UPLOAD_DIR/<folder>/ with a random name. */
export async function saveFile(file: File, folder: string): Promise<SavedFile> {
  const originalName = basename(file.name || 'file').slice(0, 255)
  const ext = extname(originalName).slice(1).toLowerCase()
  const mimeType = ALLOWED[ext]
  if (!mimeType) throw new HttpError(400, `ไม่รองรับไฟล์ประเภทนี้ ประเภทที่รองรับ: ${ALLOWED_EXTENSIONS.join(', ')}`)
  if (file.size === 0) throw new HttpError(400, 'ไฟล์ว่างเปล่า')
  if (file.size > MAX_ATTACHMENT_BYTES) throw new HttpError(400, 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB')

  const dir = join(uploadRoot, folder)
  await mkdir(dir, { recursive: true })
  const storedName = `${randomUUID()}.${ext}`
  await Bun.write(join(dir, storedName), file)
  return { originalName, storedName, mimeType, size: file.size }
}

export async function deleteFile(storedName: string, folder: string) {
  await unlink(join(uploadRoot, folder, basename(storedName))).catch(() => {})
}

export function publicUrl(storedName: string, folder: string) {
  return `/uploads/${folder}/${storedName}`
}

/** Adds the public download URL to an attachment row. */
export function withUrl<T extends { storedName: string }>(attachment: T) {
  const { storedName, ...rest } = attachment
  return { ...rest, url: publicUrl(storedName, ATTACHMENT_FOLDER) }
}

/** Resolves a /uploads/* request path to a file on disk, refusing path traversal. */
export function resolveUploadPath(relative: string): string | null {
  const full = resolve(uploadRoot, relative)
  return full.startsWith(uploadRoot + '/') || full.startsWith(uploadRoot + '\\') ? full : null
}
