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

/** Site logo image (public/favicon.png), also used as the thumbnail on project cards. */
export function BookIcon() {
  return <img src="/favicon.png" alt="" aria-hidden style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
