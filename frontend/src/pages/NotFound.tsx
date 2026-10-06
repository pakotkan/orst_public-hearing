import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <main className="container main">
      <div className="card notfound">
        <h1>ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="muted">
          หน้านี้อาจถูกลบหรือไม่มีอยู่ในระบบ <Link to="/">กลับสู่หน้าแรก</Link>
        </p>
      </div>
    </main>
  )
}
