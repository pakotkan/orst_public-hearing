import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AGREE_LABEL,
  api,
  errorMessage,
  formatDate,
  fullName,
  qs,
  type AdminProject,
  type AdminResponse,
  type Paged,
  type ResponseSummary,
} from '../../lib/api'
import { ErrorBanner, Pagination } from '../../components/ui'

type Filters = { q: string; from: string; to: string }
const emptyFilters: Filters = { q: '', from: '', to: '' }

/** Local "YYYY-MM-DD" to an ISO instant at local midnight, shifted by `addDays`. */
function localDayStart(day: string, addDays = 0) {
  if (!day) return undefined
  const d = new Date(`${day}T00:00`)
  d.setDate(d.getDate() + addDays)
  return d.toISOString()
}

const percent = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

function Bar({ label, count, total, tone }: { label: string; count: number; total: number; tone: 'yes' | 'no' }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill bar-${tone}`} style={{ width: `${percent(count, total)}%` }} />
      </span>
      <span className="bar-value">
        {count.toLocaleString('th-TH')} ({percent(count, total)}%)
      </span>
    </div>
  )
}

/** Yes / no totals for each topic as bars, how many yes answers left a comment, and the agencies named. */
function Summary({ project, summary }: { project: AdminProject; summary: ResponseSummary }) {
  return (
    <section className="card summary">
      <h2>สรุปผล · ผู้ตอบทั้งหมด {summary.totalResponses.toLocaleString('th-TH')} คน</h2>
      {project.summaryTopics.map((topic, i) => {
        const t = summary.topics[topic.id]
        if (!t) return null
        const answered = t.yes + t.no
        return (
          <div key={topic.id} className="summary-question">
            <div className="summary-question-head">
              <strong>
                {i + 1}. {topic.title}
              </strong>
              <span className="muted small">
                ตอบ {answered.toLocaleString('th-TH')} คน · แสดงความเห็นเพิ่มเติม {t.withComment.toLocaleString('th-TH')} คน
              </span>
            </div>
            <Bar label={AGREE_LABEL.yes} count={t.yes} total={answered} tone="yes" />
            <Bar label={AGREE_LABEL.no} count={t.no} total={answered} tone="no" />
            {t.agencies.length > 0 && (
              <div className="agency-summary">
                <span className="small muted">หน่วยงานที่ผู้ตอบคิดว่าเกี่ยวข้อง</span>
                <ul>
                  {t.agencies.map((a) => (
                    <li key={a.name}>
                      {a.name} <span className="muted">({a.count.toLocaleString('th-TH')})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** `/admin/projects/:id/responses`: totals per topic, then every response, searchable by name and date range. */
export function ProjectResponses() {
  const { id = '' } = useParams()
  const [project, setProject] = useState<AdminProject | null>(null)
  const [summary, setSummary] = useState<ResponseSummary | null>(null)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<Filters>(emptyFilters)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const isFiltered = !!(filters.q || filters.from || filters.to)
  const [data, setData] = useState<Paged<'responses', AdminResponse> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ project: AdminProject }>(`/admin/projects/${id}`)
      .then((d) => setProject(d.project))
      .catch((e: Error) => setError(e.message))
  }, [id])

  const loadSummary = useCallback(() => {
    api<ResponseSummary>(`/admin/projects/${id}/summary`)
      .then(setSummary)
      .catch((e: Error) => setError(e.message))
  }, [id])

  useEffect(loadSummary, [loadSummary])

  const load = useCallback(() => {
    // The "to" date is inclusive, so the server gets the start of the following day.
    const params = { page, q: filters.q.trim(), from: localDayStart(filters.from), to: localDayStart(filters.to, 1) }
    api<Paged<'responses', AdminResponse>>(`/admin/projects/${id}/responses${qs(params)}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [id, page, filters])

  useEffect(load, [load])

  async function remove(responseId: string) {
    setConfirmDelete(null)
    setError('')
    try {
      await api(`/admin/responses/${responseId}`, { method: 'DELETE' })
      load()
      loadSummary()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const topicsById = new Map(project?.summaryTopics.map((t, i) => [t.id, { topic: t, number: i + 1 }]))

  return (
    <>
      <div className="page-header">
        <div>
          <h1>คำตอบ{data && ` (${data.total.toLocaleString('th-TH')})`}</h1>
          {project && <div className="muted">ในเรื่อง “{project.title}”</div>}
        </div>
        <div className="row">
          {project && (
            <Link to={`/admin/projects/${project.id}/edit`} className="btn btn-ghost">
              แก้ไขเรื่อง
            </Link>
          )}
          <Link to="/admin/projects" className="btn btn-ghost">
            ← เรื่องทั้งหมด
          </Link>
        </div>
      </div>

      {project && summary && summary.totalResponses > 0 && <Summary project={project} summary={summary} />}

      <form
        className="filters comment-filters"
        onSubmit={(e) => {
          e.preventDefault()
          setFilters(form)
          setPage(1)
        }}
      >
        <input placeholder="ค้นหาชื่อผู้ตอบ…" value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
        <label className="date-field">
          ตั้งแต่
          <input
            type="date"
            value={form.from}
            max={form.to || undefined}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
          />
        </label>
        <label className="date-field">
          ถึง
          <input
            type="date"
            value={form.to}
            min={form.from || undefined}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
          />
        </label>
        <button className="btn">ค้นหา</button>
        {(isFiltered || form.q || form.from || form.to) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setForm(emptyFilters)
              setFilters(emptyFilters)
              setPage(1)
            }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </form>
      <ErrorBanner message={error} />

      <ul className="admin-comment-list">
        {data?.responses.map((r) => (
          <li key={r.id} className="card admin-comment">
            <dl className="answer-list">
              {[...r.topicAnswers]
                .filter((a) => topicsById.has(a.summaryTopicId))
                .sort((a, b) => topicsById.get(a.summaryTopicId)!.number - topicsById.get(b.summaryTopicId)!.number)
                .map((a) => {
                  const { topic, number } = topicsById.get(a.summaryTopicId)!
                  return (
                    <div key={a.summaryTopicId}>
                      <dt>
                        {number}. {topic.title}
                      </dt>
                      <dd>
                        <span className={`pill ${a.agreement ? 'pill-green' : 'pill-red'}`}>
                          {a.agreement ? AGREE_LABEL.yes : AGREE_LABEL.no}
                        </span>
                        {a.relatedAgency && <span className="muted small"> · หน่วยงาน: {a.relatedAgency}</span>}
                        {a.additionalComment && <p className="comment-body">{a.additionalComment}</p>}
                      </dd>
                    </div>
                  )
                })}
            </dl>
            <div className="admin-comment-footer">
              <div className="admin-comment-author">
                <span className="avatar" aria-hidden>
                  {r.user.firstName.charAt(0)}
                </span>
                <div>
                  <strong>{fullName(r.user)}</strong>{' '}
                  {r.isAnonymous && (
                    <span className="pill pill-grey" title="ผู้ตอบขอไม่ให้เปิดเผยชื่อเมื่อเผยแพร่ผล">
                      ไม่ประสงค์ออกนาม
                    </span>
                  )}
                  <div className="muted small">{formatDate(r.createdAt)}</div>
                </div>
              </div>
              <div className="action-buttons">
                {confirmDelete === r.id ? (
                  <>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}>
                      ยืนยันการลบ
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-ghost-danger" onClick={() => setConfirmDelete(r.id)}>
                    ลบ
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data?.responses.length === 0 && (
        <p className="empty-state">{isFiltered ? 'ไม่พบคำตอบที่ตรงกับเงื่อนไข' : 'ยังไม่มีผู้ตอบในเรื่องนี้'}</p>
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
