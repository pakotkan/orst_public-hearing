export type Role = 'USER' | 'ADMIN'

export type User = { id: string; firstName: string; lastName: string; email: string; role: Role }

export type Person = { id: string; firstName: string; lastName: string }

export type Attachment = {
  id: string
  originalName: string
  mimeType: string
  size: number
  url: string
}

/** Card on the landing page. */
export type PostSummary = {
  id: string
  title: string
  excerpt: string
  coverImage: string | null
  createdAt: string
  author: Person | null
  _count: { comments: number; attachments: number }
}

/** Full post; `content` is sanitized HTML from the server. */
export type Post = {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  author: Person | null
  attachments: Attachment[]
}

export type Comment = {
  id: string
  content: string
  createdAt: string
  user: Person
}

export type AdminPostRow = {
  id: string
  title: string
  isPublished: boolean
  createdAt: string
  updatedAt: string
  author: Person | null
  _count: { comments: number; attachments: number }
}

export type AdminPost = {
  id: string
  title: string
  content: string
  isPublished: boolean
  attachments: Attachment[]
}

export type AdminComment = {
  id: string
  content: string
  createdAt: string
  user: Person
}

export type AdminUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  role: Role
  isBanned: boolean
  createdAt: string
  _count: { comments: number }
}

export type Paged<K extends string, T> = { [key in K]: T[] } & { total: number; page: number; pageSize: number }

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Same-origin API client; the httpOnly session cookie is sent automatically. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isJson = typeof init.body === 'string'
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: isJson ? { 'Content-Type': 'application/json', ...init.headers } : init.headers,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `เกิดข้อผิดพลาด (${res.status})`)
  return data as T
}

export function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') search.set(k, String(v))
  const s = search.toString()
  return s ? `?${s}` : ''
}

/** Thai date and time with the Buddhist year, e.g. "5 ต.ค. 2569 11:53". */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Thai date only, e.g. "5 ตุลาคม 2569". */
export function formatLongDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { dateStyle: 'long' })
}

export function fullName(person: Pick<Person, 'firstName' | 'lastName'> | null | undefined) {
  return person ? `${person.firstName} ${person.lastName}`.trim() : 'ไม่ระบุ'
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const isImage = (a: Attachment) => a.mimeType.startsWith('image/')
export const isPdf = (a: Attachment) => a.mimeType === 'application/pdf'

export const errorMessage = (e: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') =>
  e instanceof Error ? e.message : fallback
