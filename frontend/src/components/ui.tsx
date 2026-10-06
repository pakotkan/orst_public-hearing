import { Link } from 'react-router-dom'
import { SITE_NAME, SITE_SUBTITLE } from '../lib/site'

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ← ก่อนหน้า
      </button>
      <span className="muted">
        หน้า {page} จาก {pages} · ทั้งหมด {total.toLocaleString('th-TH')} รายการ
      </span>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        ถัดไป →
      </button>
    </div>
  )
}

export function ErrorBanner({ message }: { message: string }) {
  return message ? <p className="error">{message}</p> : null
}

export function Loading() {
  return <p className="muted center">กำลังโหลด…</p>
}

/** Open-book icon used as the site logo and as a placeholder for posts without a cover image. */
export function BookIcon({ color = '#fff' }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 4.5h6a4 4 0 0 1 4 4V20a3 3 0 0 0-3-3H2z" />
      <path d="M22 4.5h-6a4 4 0 0 0-4 4V20a3 3 0 0 1 3-3h7z" />
    </svg>
  )
}

/** Logo mark plus the site name, linking to `to`. */
export function Brand({ to }: { to: string }) {
  return (
    <Link to={to} className="brand">
      <span className="brand-mark">
        <BookIcon />
      </span>
      <span className="brand-text">
        <span className="brand-title">{SITE_NAME}</span>
        <span className="brand-subtitle">{SITE_SUBTITLE}</span>
      </span>
    </Link>
  )
}
