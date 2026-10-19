import { Suspense } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { fullName } from '../lib/api'
import { loginUrl, useAuth } from '../lib/auth'
import { Brand, Loading } from './ui'

/** Admin-only shell. Guests go to login; logged-in non-admins are sent back to the landing page. */
export function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const location = useLocation()

  if (loading) return <Loading />
  if (!user) return <Navigate to={loginUrl(location.pathname + location.search)} replace />
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />

  return (
    <div className="layout">
      <aside className="sidebar">
        <Brand to="/admin/projects" />
        <nav>
          <NavLink to="/admin/projects">เรื่องรับฟังความคิดเห็น</NavLink>
          <NavLink to="/admin/users">ผู้ใช้งาน</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="small">{fullName(user)}</div>
          <div className="small">{user.email}</div>
          <Link to="/">← กลับสู่หน้าเว็บไซต์</Link>
          <button className="btn-link" onClick={logout}>
            ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="content">
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
