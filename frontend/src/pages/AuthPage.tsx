import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, errorMessage, type User } from '../lib/api'
import { safeNext, useAuth } from '../lib/auth'
import { ErrorBanner } from '../components/ui'

/** Where to go after login: the `?next=` page if given, else the admin posts page for admins, else the landing page. */
function destination(user: User, next: string | null) {
  if (next) return safeNext(next)
  return user.role === 'ADMIN' ? '/admin/posts' : '/'
}

/** `/login` (users and admins) and `/register`. */
export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const next = params.get('next')
  const isRegister = mode === 'register'
  const switchQuery = next ? `?next=${encodeURIComponent(safeNext(next))}` : ''

  if (user) return <Navigate to={destination(user, next)} replace />

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { user } = await api<{ user: User }>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
      })
      setUser(user)
      navigate(destination(user, next), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <main className="container main auth-wrap">
      <div className="auth-card card">
        <h1>{isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</h1>
        <p className="muted auth-intro">
          {next?.startsWith('/posts/')
            ? 'กรุณาเข้าสู่ระบบเพื่อแสดงความคิดเห็น หากยังไม่มีบัญชี สามารถสมัครสมาชิกได้ด้านล่าง'
            : isRegister
              ? 'สร้างบัญชีเพื่อร่วมแสดงความคิดเห็นต่อร่างสมุดปกขาว'
              : 'สำหรับผู้ใช้งานทั่วไปและผู้ดูแลระบบ'}
        </p>
        <form onSubmit={onSubmit} className="form">
          {isRegister && (
            <div className="form-row">
              <label>
                ชื่อ
                <input name="firstName" required maxLength={100} autoComplete="given-name" />
              </label>
              <label>
                นามสกุล
                <input name="lastName" required maxLength={100} autoComplete="family-name" />
              </label>
            </div>
          )}
          <label>
            อีเมล
            <input name="email" type="email" required maxLength={255} autoComplete="email" />
          </label>
          <label>
            รหัสผ่าน
            <input
              name="password"
              type="password"
              required
              minLength={isRegister ? 8 : undefined}
              maxLength={128}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            {isRegister && <small className="muted">อย่างน้อย 8 ตัวอักษร</small>}
          </label>
          <ErrorBanner message={error} />
          <button className="btn" disabled={submitting}>
            {submitting ? 'กรุณารอสักครู่…' : isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <p className="muted center">
          {isRegister ? (
            <>
              มีบัญชีอยู่แล้ว? <Link to={`/login${switchQuery}`}>เข้าสู่ระบบ</Link>
            </>
          ) : (
            <>
              ยังไม่มีบัญชี? <Link to={`/register${switchQuery}`}>สมัครสมาชิก</Link>
            </>
          )}
        </p>
      </div>
    </main>
  )
}
