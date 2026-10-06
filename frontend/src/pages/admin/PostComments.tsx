import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, errorMessage, formatDate, fullName, qs, type AdminComment, type AdminPost, type Paged } from '../../lib/api'
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

/** `/admin/posts/:id/comments`: every comment on one post, shown as cards, searchable by name and date range. */
export function PostComments() {
  const { id = '' } = useParams()
  const [post, setPost] = useState<AdminPost | null>(null)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<Filters>(emptyFilters)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const isFiltered = !!(filters.q || filters.from || filters.to)
  const [data, setData] = useState<Paged<'comments', AdminComment> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ post: AdminPost }>(`/admin/posts/${id}`)
      .then((d) => setPost(d.post))
      .catch((e: Error) => setError(e.message))
  }, [id])

  const load = useCallback(() => {
    // The "to" date is inclusive, so the server gets the start of the following day.
    const params = { page, q: filters.q.trim(), from: localDayStart(filters.from), to: localDayStart(filters.to, 1) }
    api<Paged<'comments', AdminComment>>(`/admin/posts/${id}/comments${qs(params)}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [id, page, filters])

  useEffect(load, [load])

  async function remove(commentId: string) {
    setConfirmDelete(null)
    setError('')
    try {
      await api(`/admin/comments/${commentId}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>ความคิดเห็น{data && ` (${data.total.toLocaleString('th-TH')})`}</h1>
          {post && <div className="muted">ในเรื่อง “{post.title}”</div>}
        </div>
        <div className="row">
          <Link to="/admin/posts" className="btn btn-ghost">
            ← เรื่องทั้งหมด
          </Link>
        </div>
      </div>
      <form
        className="filters comment-filters"
        onSubmit={(e) => {
          e.preventDefault()
          setFilters(form)
          setPage(1)
        }}
      >
        <input
          placeholder="ค้นหาชื่อผู้แสดงความคิดเห็น…"
          value={form.q}
          onChange={(e) => setForm({ ...form, q: e.target.value })}
        />
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
        {data?.comments.map((c) => (
          <li key={c.id} className="card admin-comment">
            <p className="comment-body">{c.content}</p>
            <div className="admin-comment-footer">
              <div className="admin-comment-author">
                <span className="avatar" aria-hidden>
                  {c.user.firstName.charAt(0)}
                </span>
                <div>
                  <strong>{fullName(c.user)}</strong>
                  <div className="muted small">{formatDate(c.createdAt)}</div>
                </div>
              </div>
              <div className="action-buttons">
                {confirmDelete === c.id ? (
                  <>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(c.id)}>
                      ยืนยันการลบ
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                      ยกเลิก
                    </button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-ghost-danger" onClick={() => setConfirmDelete(c.id)}>
                    ลบ
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data?.comments.length === 0 && (
        <p className="empty-state">{isFiltered ? 'ไม่พบความคิดเห็นที่ตรงกับเงื่อนไข' : 'ยังไม่มีความคิดเห็นในเรื่องนี้'}</p>
      )}

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </>
  )
}
