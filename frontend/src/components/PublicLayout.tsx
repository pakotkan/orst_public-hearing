import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { SITE_FULL_NAME } from '../lib/site'
import { Brand } from './ui'

export function PublicLayout() {
  const { user, loading, logout } = useAuth()
  const year = new Date().toLocaleDateString('th-TH', { year: 'numeric' })

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Brand to="/" />
          <nav className="nav">
            <NavLink to="/" end className="nav-link">
              หน้าแรก
            </NavLink>
            {loading ? null : user ? (
              <>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin/posts" className="nav-link">
                    ระบบจัดการ
                  </NavLink>
                )}
                <span className="nav-user">สวัสดี, {user.firstName}</span>
                <button className="btn btn-ghost" onClick={logout}>
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  เข้าสู่ระบบ
                </Link>
                <Link to="/register" className="btn">
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <Outlet />

      <footer className="site-footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <strong>{SITE_FULL_NAME}</strong>
              ช่องทางรับฟังความคิดเห็นของประชาชนต่อร่างสมุดปกขาว
            </div>
            <div>
              <Link to="/">หน้าแรก</Link>
              {!user && (
                <>
                  {' · '}
                  <Link to="/login">เข้าสู่ระบบ</Link>
                  {' · '}
                  <Link to="/register">สมัครสมาชิก</Link>
                </>
              )}
            </div>
          </div>
          <div className="footer-bottom">
            © {year} {SITE_FULL_NAME}
          </div>
        </div>
      </footer>
    </>
  )
}
