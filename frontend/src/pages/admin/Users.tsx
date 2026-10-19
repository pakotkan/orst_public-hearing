import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage, formatDate, fullName, PHONE_PATTERN, qs, type AdminUser, type Paged, type Role, type UserStatus } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { ErrorBanner, Pagination } from '../../components/ui'

type Draft = {
  id?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  role: Role
  status: UserStatus
}

const EMPTY_DRAFT: Draft = { firstName: '', lastName: '', email: '', phone: '', password: '', role: 'USER', status: 'ACTIVE' }

/** `/admin/users`: add, edit and deactivate user accounts (deleting is a soft delete). */
export function Users() {
  const currentUserId = useAuth().user?.id
  const [query, setQuery] = useState({ q: '', page: 1 })
  const [search, setSearch] = useState('')
  const [data, setData] = useState<Paged<'users', AdminUser> | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')

  const load = useCallback(() => {
    api<Paged<'users', AdminUser>>(`/admin/users${qs(query)}`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [query])

  useEffect(load, [load])

  function edit(u: AdminUser) {
    setFormError('')
    setDraft({ id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone, password: '', role: u.role, status: u.status })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!draft) return
    setFormError('')
    const { id, password, ...fields } = draft
    try {
      if (id) {
        await api(`/admin/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...fields, ...(password ? { password } : {}) }),
        })
      } else {
        const { status: _, ...createFields } = fields
        await api('/admin/users', { method: 'POST', body: JSON.stringify({ ...createFields, password }) })
      }
      setDraft(null)
      load()
    } catch (err) {
      setFormError(errorMessage(err))
    }
  }

  async function remove(id: string) {
    setError('')
    setConfirmDelete(null)
    try {
      await api(`/admin/users/${id}`, { method: 'DELETE' })
      load()
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  const editingSelf = draft?.id === currentUserId

  return (
    <>
      <div className="page-header">
        <h1>ผู้ใช้งาน</h1>
        <button
          className="btn"
          onClick={() => {
            setFormError('')
            setDraft(EMPTY_DRAFT)
          }}
        >
          + เพิ่มผู้ใช้งาน
        </button>
      </div>

      {draft && (
        <form className="card form" onSubmit={save}>
          <h2>{draft.id ? 'แก้ไขผู้ใช้งาน' : 'เพิ่มผู้ใช้งาน'}</h2>
          <div className="form-row">
            <label>
              ชื่อ
              <input
                value={draft.firstName}
                onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
                required
                maxLength={100}
              />
            </label>
            <label>
              นามสกุล
              <input
                value={draft.lastName}
                onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
                required
                maxLength={100}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              อีเมล
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                required
                maxLength={255}
              />
            </label>
            <label>
              {draft.id ? 'รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)' : 'รหัสผ่าน'}
              <input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                required={!draft.id}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              เบอร์โทรศัพท์
              <input
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                required
                maxLength={20}
                pattern={PHONE_PATTERN}
              />
            </label>
            <label>
              บทบาท
              <select
                value={draft.role}
                disabled={editingSelf}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}
              >
                <option value="USER">ผู้ใช้งานทั่วไป</option>
                <option value="ADMIN">ผู้ดูแลระบบ</option>
              </select>
            </label>
            {draft.id && (
              <label>
                สถานะ
                <select
                  value={draft.status}
                  disabled={editingSelf}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as UserStatus })}
                >
                  <option value="ACTIVE">ใช้งานได้</option>
                  <option value="INACTIVE">ปิดการใช้งาน (เข้าสู่ระบบไม่ได้)</option>
                </select>
              </label>
            )}
          </div>
          <ErrorBanner message={formError} />
          <div className="row">
            <button className="btn">{draft.id ? 'บันทึกการแก้ไข' : 'เพิ่มผู้ใช้งาน'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <form
        className="filters"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery({ q: search, page: 1 })
        }}
      >
        <input placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทรศัพท์…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn">ค้นหา</button>
      </form>
      <ErrorBanner message={error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ชื่อ-นามสกุล</th>
              <th>อีเมล</th>
              <th>เบอร์โทรศัพท์</th>
              <th>บทบาท</th>
              <th>สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.users.map((u) => {
              const isSelf = u.id === currentUserId
              return (
                <tr key={u.id}>
                  <td>
                    {fullName(u)} {isSelf && <span className="muted small">(คุณ)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td className="nowrap">{u.phone || <span className="muted">-</span>}</td>
                  <td>
                    <span className={`pill ${u.role === 'ADMIN' ? 'pill-blue' : 'pill-grey'}`}>{u.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งานทั่วไป'}</span>
                  </td>
                  <td>
                    <span className={`pill ${u.status === 'ACTIVE' ? 'pill-green' : 'pill-red'}`}>
                      {u.status === 'ACTIVE' ? 'ใช้งานได้' : 'ปิดการใช้งาน'}
                    </span>
                  </td>
                  <td className="actions">
                    <div className="action-buttons">
                      <button className="btn btn-sm" onClick={() => edit(u)}>
                        แก้ไข
                      </button>
                      {!isSelf && u.status === 'ACTIVE' &&
                        (confirmDelete === u.id ? (
                          <>
                            <button className="btn btn-sm btn-danger" onClick={() => remove(u.id)}>
                              ยืนยันการลบ
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => setConfirmDelete(null)}>
                              ยกเลิก
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-sm btn-ghost-danger" onClick={() => setConfirmDelete(u.id)}>
                            ลบ
                          </button>
                        ))}
                    </div>
                  </td>
                </tr>
              )
            })}
            {data?.users.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  ไม่พบผู้ใช้งาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={(page) => setQuery({ ...query, page })}
        />
      )}
    </>
  )
}
