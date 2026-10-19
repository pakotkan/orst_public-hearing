import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatLongDate, PROJECT_STATUS_LABEL, type ProjectCard } from '../lib/api'
import { useAuth } from '../lib/auth'
import { SITE_FULL_NAME } from '../lib/site'
import { BookIcon, ErrorBanner, Loading } from '../components/ui'

/** Landing page (`/`): banner with search, then the list of open and closed projects. No login required. */
export function ProjectList() {
  const [projects, setProjects] = useState<ProjectCard[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const { user, loading: authLoading } = useAuth()

  // "Already answered" depends on who is viewing, so refetch on login/logout.
  useEffect(() => {
    if (authLoading) return
    api<{ projects: ProjectCard[] }>('/projects')
      .then((d) => setProjects(d.projects))
      .catch((e: Error) => setError(e.message))
  }, [authLoading, user?.id])

  const term = search.trim().toLowerCase()
  const shown = term
    ? projects?.filter((p) => p.title.toLowerCase().includes(term) || p.excerpt.toLowerCase().includes(term))
    : projects

  return (
    <>
      <section className="hero-banner">
        <div className="container">
          <span className="hero-eyebrow">รับฟังความคิดเห็นของประชาชน</span>
          <h1>{SITE_FULL_NAME}</h1>
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
          {!projects && !error && <Loading />}
          {projects?.length === 0 && <p className="empty-state">ยังไม่มีเรื่องที่เปิดรับฟังความคิดเห็น</p>}
          {projects && projects.length > 0 && shown?.length === 0 && (
            <p className="empty-state">ไม่พบเรื่องที่ตรงกับ “{search.trim()}”</p>
          )}

          <ul className="hearing-list">
            {shown?.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className="hearing-card">
                  <div className="hearing-thumb hearing-thumb-placeholder">
                    <BookIcon />
                  </div>
                  <div className="hearing-body">
                    <div className="row">
                      <span className={`status ${project.status === 'OPEN' ? 'status-open' : 'status-closed'}`}>
                        {PROJECT_STATUS_LABEL[project.status]}
                      </span>
                      {project.responded && <span className="pill pill-blue">คุณตอบแล้ว</span>}
                    </div>
                    <h3>{project.title}</h3>
                    {project.excerpt && <p className="clamp">{project.excerpt}</p>}
                    <div className="hearing-meta">
                      <span>📅 เผยแพร่ {formatLongDate(project.createdAt)}</span>
                    </div>
                    <div className="hearing-footer">
                      <span className="hearing-cta">
                        {project.status !== 'OPEN' ? 'อ่านรายละเอียด →' : project.responded ? 'ดูหรือแก้ไขคำตอบ →' : 'อ่านและแสดงความคิดเห็น →'}
                      </span>
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
