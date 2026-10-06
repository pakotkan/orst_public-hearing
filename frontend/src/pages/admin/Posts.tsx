import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage, formatDate, fullName, type AdminPostRow } from '../../lib/api'
import { ErrorBanner } from '../../components/ui'

/** `/admin/posts`: every post (published and draft) with links to edit, comments and delete. */
export function Posts() {
  const [posts, setPosts] = useState<AdminPostRow[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<{ posts: AdminPostRow[] }>('/admin/posts')
      .then((d) => setPosts(d.posts))
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(load, [load])

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>เรื่องรับฟังความคิดเห็น</h1>
        <Link to="/admin/posts/new" className="btn">
          + สร้างเรื่องใหม่
        </Link>
      </div>
      <ErrorBanner message={error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>หัวข้อ</th>
              <th>สถานะ</th>
              <th>วันที่สร้าง</th>
              <th/>
            </tr>
          </thead>
          <tbody>
            {posts?.map((p) => (
              <tr key={p.id}>
                <td>
                  {/* Drafts have no public page yet, so only published titles link to it. */}
                  {p.isPublished ? (
                    <Link to={`/posts/${p.id}`}>
                      <strong>{p.title}</strong>
                    </Link>
                  ) : (
                    <strong>{p.title}</strong>
                  )}
                  <div className="muted small">โดย {fullName(p.author)}</div>
                </td>
                <td>
                  <span className={`pill ${p.isPublished ? 'pill-green' : 'pill-grey'}`}>
                    {p.isPublished ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                  </span>
                </td>
                <td className="nowrap">{formatDate(p.createdAt)}</td>
                <td className="actions">
                  <div className="action-buttons">
                    <Link to={`/admin/posts/${p.id}/edit`} className="btn btn-sm">
                      แก้ไข
                    </Link>
                    <Link to={`/admin/posts/${p.id}/comments`} className="btn btn-sm btn-ghost">
                      ความคิดเห็น ({p._count.comments})
                    </Link>
                    {confirmDelete === p.id ? (
                      <>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            setConfirmDelete(null)
                            run(() => api(`/admin/posts/${p.id}`, { method: 'DELETE' }))
                          }}
                        >
                          ยืนยันการลบ
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-sm btn-ghost-danger" onClick={() => setConfirmDelete(p.id)}>
                        ลบ
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {posts?.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  ยังไม่มีเรื่อง <Link to="/admin/posts/new">สร้างเรื่องแรก</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
