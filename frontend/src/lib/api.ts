export type Role = 'USER' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'INACTIVE'

/** Matches the backend `phoneField`: digits with an optional leading +, spaces and dashes allowed. */
export const PHONE_PATTERN = '\\+?[0-9][0-9 \\-]{7,18}'

export type User = { id: string; firstName: string; lastName: string; email: string; role: Role }

export type Person = { id: string; firstName: string; lastName: string }

export type ProjectStatus = 'DRAFT' | 'OPEN' | 'CLOSED'

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  OPEN: 'เปิดรับฟังความคิดเห็น',
  CLOSED: 'ปิดรับฟังความคิดเห็นแล้ว',
}

/** Wording of the two answers to every topic. */
export const AGREE_LABEL = { yes: 'เห็นด้วย', no: 'ไม่เห็นด้วย' }

/** Topics a new project starts with; admins can add more. */
export const DEFAULT_TOPIC_COUNT = 3

/** Must match MAX_COMMENT_LENGTH / MAX_AGENCY_LENGTH in backend/src/lib/projects.ts. */
export const MAX_COMMENT_LENGTH = 5000
export const MAX_AGENCY_LENGTH = 300

/** A yes/no topic in a project. */
export type SummaryTopic = {
  id: string
  title: string
  order: number
}

/** Card on the landing page. `responded` is whether the logged-in user has answered it. */
export type ProjectCard = {
  id: string
  title: string
  excerpt: string
  status: ProjectStatus
  createdAt: string
  createdBy: Person
  responded: boolean
  _count: { summaryTopics: number }
}

/** Full project; `description` is sanitized HTML from the server. */
export type Project = {
  id: string
  title: string
  description: string | null
  pdfUrl: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  createdBy: Person
  summaryTopics: SummaryTopic[]
}

/** `additionalComment` and `relatedAgency` are only ever set when `agreement` is true. */
export type TopicAnswer = {
  summaryTopicId: string
  agreement: boolean
  additionalComment: string | null
  relatedAgency: string | null
}

export type ProjectResponse = {
  id: string
  isAnonymous: boolean
  createdAt: string
  topicAnswers: TopicAnswer[]
}

export type AdminProjectRow = {
  id: string
  title: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  createdBy: Person
  _count: { summaryTopics: number; responses: number }
}

export type AdminProject = {
  id: string
  title: string
  description: string | null
  pdfUrl: string | null
  status: ProjectStatus
  createdAt: string
  updatedAt: string
  summaryTopics: (SummaryTopic & { _count: { answers: number } })[]
  _count: { responses: number }
}

export type AdminResponse = ProjectResponse & { user: Person }

/** Per-topic totals from /admin/projects/:id/summary. `withComment` counts yes answers that left a comment. */
export type ResponseSummary = {
  totalResponses: number
  topics: Record<string, { yes: number; no: number; withComment: number; agencies: { name: string; count: number }[] }>
}

export type AdminUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  role: Role
  status: UserStatus
  createdAt: string
  _count: { responses: number }
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

export const errorMessage = (e: unknown, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง') =>
  e instanceof Error ? e.message : fallback
