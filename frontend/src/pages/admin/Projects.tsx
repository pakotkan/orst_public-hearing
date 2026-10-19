import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage, formatDate, fullName, PROJECT_STATUS_LABEL, type AdminProjectRow, type ProjectStatus } from '../../lib/api'
import { ErrorBanner } from '../../components/ui'

const STATUS_PILL: Record<ProjectStatus, string> = { DRAFT: 'pill-grey', OPEN: 'pill-green', CLOSED: 'pill-red' }

/** `/admin/projects`: every project (draft, open and closed) with links to edit, responses and delete. */
export function Projects() {
  const [projects, setProjects] = useState<AdminProjectRow[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api<{ projects: AdminProjectRow[] }>('/admin/projects')
      .then((d) => setProjects(d.projects))
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
        <Link to="/admin/projects/new" className="btn">
          + สร้างเรื่องใหม่
        </Link>
      </div>
      <ErrorBanner message={error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อเรื่อง</th>
              <th>สถานะ</th>
              <th>วันที่สร้าง</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {projects?.map((p) => (
              <tr key={p.id}>
                <td>
                  {/* Drafts have no public page yet, so only open and closed titles link to it. */}
                  {p.status !== 'DRAFT' ? (
                    <Link to={`/projects/${p.id}`}>
                      <strong>{p.title}</strong>
                    </Link>
                  ) : (
                    <strong>{p.title}</strong>
                  )}
                  <div className="muted small">โดย {fullName(p.createdBy)}</div>
                </td>
                <td>
                  <span className={`pill ${STATUS_PILL[p.status]}`}>{PROJECT_STATUS_LABEL[p.status]}</span>
                </td>
                <td className="nowrap">{formatDate(p.createdAt)}</td>
                <td className="actions">
                  <div className="action-buttons">
                    <Link to={`/admin/projects/${p.id}/edit`} className="btn btn-sm">
                      แก้ไข
                    </Link>
                    <Link to={`/admin/projects/${p.id}/responses`} className="btn btn-sm btn-ghost">
                      คำตอบ ({p._count.responses})
                    </Link>
                    {confirmDelete === p.id ? (
                      <>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            setConfirmDelete(null)
                            run(() => api(`/admin/projects/${p.id}`, { method: 'DELETE' }))
                          }}
                        >
                          ยืนยันการลบ
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn btn-sm btn-ghost-danger"
                        title={p._count.responses ? `จะลบคำตอบทั้งหมด ${p._count.responses} รายการด้วย` : undefined}
                        onClick={() => setConfirmDelete(p.id)}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {projects?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted center">
                  ยังไม่มีเรื่อง <Link to="/admin/projects/new">สร้างเรื่องแรก</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
