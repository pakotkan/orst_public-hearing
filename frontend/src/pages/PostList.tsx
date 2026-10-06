import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatLongDate, fullName, type PostSummary } from '../lib/api'
import { useAuth } from '../lib/auth'
import { BookIcon, ErrorBanner, Loading } from '../components/ui'

/** Landing page (`/`): banner with search, then the list of published posts. No login required. */
export function PostList() {
  const [posts, setPosts] = useState<PostSummary[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const { user, loading: authLoading } = useAuth()

  // Comment counts depend on who is viewing (admin: all, user: own, guest: hidden), so refetch on login/logout.
  useEffect(() => {
    if (authLoading) return
    api<{ posts: PostSummary[] }>('/posts')
      .then((d) => setPosts(d.posts))
      .catch((e: Error) => setError(e.message))
  }, [authLoading, user?.id])

  const term = search.trim().toLowerCase()
  const shown = term
    ? posts?.filter((p) => p.title.toLowerCase().includes(term) || p.excerpt.toLowerCase().includes(term))
    : posts

  return (
    <>
      <section className="hero-banner">
        <div className="container">
          <span className="hero-eyebrow">รับฟังความคิดเห็นของประชาชน</span>
          <h1>ประชาพิจารณ์ สมุดปกขาว (White Paper)</h1>
          <p>อ่านร่างสมุดปกขาวและร่วมแสดงความคิดเห็น เพื่อนำไปใช้ประกอบการพิจารณาปรับปรุงให้สมบูรณ์ยิ่งขึ้น</p>
          <form className="search-box" role="search" onSubmit={(e) => e.preventDefault()}>
            <input
              type="search"
              placeholder="ค้นหาเรื่องที่รับฟังความคิดเห็น…"
              aria-label="ค้นหา"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn">ค้นหา</button>
          </form>
        </div>
      </section>

      <main className="container main main-overlap">
        <div className="list-panel">
          <div className="section-head">
            <h2>เรื่องที่เปิดรับฟังความคิดเห็น</h2>
            {shown && <span className="muted">ทั้งหมด {shown.length.toLocaleString('th-TH')} รายการ</span>}
          </div>

          <ErrorBanner message={error} />
          {!posts && !error && <Loading />}
          {posts?.length === 0 && <p className="empty-state">ยังไม่มีเรื่องที่เปิดรับฟังความคิดเห็น</p>}
          {posts && posts.length > 0 && shown?.length === 0 && (
            <p className="empty-state">ไม่พบเรื่องที่ตรงกับ “{search.trim()}”</p>
          )}

          <ul className="hearing-list">
            {shown?.map((post) => (
              <li key={post.id}>
                <Link to={`/posts/${post.id}`} className="hearing-card">
                  {post.coverImage ? (
                    <img src={post.coverImage} alt="" className="hearing-thumb" />
                  ) : (
                    <div className="hearing-thumb hearing-thumb-placeholder">
                      <BookIcon color="currentColor" />
                    </div>
                  )}
                  <div className="hearing-body">
                    <span className="status status-open">เปิดรับฟังความคิดเห็น</span>
                    <h3>{post.title}</h3>
                    {post.excerpt && <p className="clamp">{post.excerpt}</p>}
                    <div className="hearing-meta">
                      <span>📅 เผยแพร่ {formatLongDate(post.createdAt)}</span>
                    </div>
                    <div className="hearing-footer">
                      <div className="hearing-meta"></div>
                      <span className="hearing-cta">อ่านและแสดงความคิดเห็น →</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  )
}
