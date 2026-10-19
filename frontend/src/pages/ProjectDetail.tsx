import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  api,
  ApiError,
  errorMessage,
  formatDate,
  formatLongDate,
  PROJECT_STATUS_LABEL,
  AGREE_LABEL,
  type Project,
  type ProjectResponse,
  type TopicAnswer,
} from '../lib/api'
import { loginUrl, useAuth } from '../lib/auth'
import { PdfViewer } from '../components/PdfViewer'
import { draftAgency, emptyTopicDraft, toTopicDraft, TopicField, type TopicDraft } from '../components/TopicField'
import { ErrorBanner, Loading } from '../components/ui'
import { NotFound } from './NotFound'

type Draft = { answers: TopicDraft[]; isAnonymous: boolean }

const draftKey = (projectId: string) => `response-draft:${projectId}`

function readDraft(projectId: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(projectId))
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function writeDraft(projectId: string, draft: Draft | null) {
  try {
    if (draft) sessionStorage.setItem(draftKey(projectId), JSON.stringify(draft))
    else sessionStorage.removeItem(draftKey(projectId))
  } catch {
    /* storage unavailable */
  }
}

/** One draft per topic, in topic order, from a draft saved before login, else the saved response. */
function draftsFor(project: Project, drafts?: TopicDraft[], saved: TopicAnswer[] = []) {
  return project.summaryTopics.map((t): TopicDraft => {
    // Drafts from an older version of the form have a different shape; treat those as unanswered.
    const draft = drafts?.find((d) => d.summaryTopicId === t.id && typeof d.agencyChoice === 'string')
    if (draft) return draft
    const answer = saved.find((a) => a.summaryTopicId === t.id)
    return answer ? toTopicDraft(answer) : emptyTopicDraft(t.id)
  })
}

/**
 * `/projects/:id`: anyone can read. Submitting as a guest saves the draft and goes to /login;
 * after login/register the user returns here with the draft restored. A user has one response per
 * project, which they can edit or withdraw while the project is open.
 */
export function ProjectDetail() {
  const { id = '' } = useParams()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [saved, setSaved] = useState<ProjectResponse | null>(null)
  const [answers, setAnswers] = useState<TopicDraft[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loadingResponse, setLoadingResponse] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setProject(null)
    setNotFound(false)
    api<{ project: Project }>(`/projects/${encodeURIComponent(id)}`)
      .then((d) => setProject(d.project))
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setNotFound(true) : setError(e.message)))
  }, [id])

  // Fill the form: a draft saved before login wins, then the user's saved response, else blank.
  useEffect(() => {
    if (!project || authLoading) return
    const draft = readDraft(id)
    const apply = (response: ProjectResponse | null) => {
      setSaved(response)
      setAnswers(draftsFor(project, draft?.answers, response?.topicAnswers))
      setIsAnonymous(draft?.isAnonymous ?? response?.isAnonymous ?? false)
      setLoadingResponse(false)
    }
    if (!user) return apply(null)
    setLoadingResponse(true)
    api<{ response: ProjectResponse | null }>(`/projects/${encodeURIComponent(id)}/response`)
      .then((d) => apply(d.response))
      .catch(() => apply(null))
  }, [project, user, authLoading, id])

  function setAnswer(answer: TopicDraft) {
    setMessage('')
    setAnswers((prev) => prev.map((a) => (a.summaryTopicId === answer.summaryTopicId ? answer : a)))
  }

  function goToLogin() {
    writeDraft(id, { answers, isAnonymous })
    navigate(loginUrl(`/projects/${id}`))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return goToLogin()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const { response } = await api<{ response: ProjectResponse }>(`/projects/${encodeURIComponent(id)}/response`, {
        method: 'PUT',
        body: JSON.stringify({
          isAnonymous,
          topicAnswers: answers.map((a) => ({
            summaryTopicId: a.summaryTopicId,
            agreement: a.agreement,
            // A "no" is submitted as is; only a "yes" carries a comment and an agency.
            additionalComment: a.agreement ? a.additionalComment : undefined,
            relatedAgency: a.agreement ? draftAgency(a) : undefined,
          })),
        }),
      })
      setSaved(response)
      writeDraft(id, null)
      setMessage(saved ? 'บันทึกการแก้ไขคำตอบเรียบร้อยแล้ว' : 'ส่งความคิดเห็นเรียบร้อยแล้ว ขอบคุณที่ร่วมแสดงความคิดเห็น')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return goToLogin()
      setError(errorMessage(err, 'ไม่สามารถส่งความคิดเห็นได้'))
    } finally {
      setSubmitting(false)
    }
  }

  async function onWithdraw() {
    setConfirmWithdraw(false)
    setError('')
    setMessage('')
    try {
      await api(`/projects/${encodeURIComponent(id)}/response`, { method: 'DELETE' })
      setSaved(null)
      if (project) setAnswers(draftsFor(project))
      setIsAnonymous(false)
      setMessage('ถอนคำตอบเรียบร้อยแล้ว')
    } catch (err) {
      setError(errorMessage(err, 'ไม่สามารถถอนคำตอบได้'))
    }
  }

  if (notFound) return <NotFound />
  if (!project)
    return <main className="container main">{error ? <ErrorBanner message={error} /> : <Loading />}</main>

  const isOpen = project.status === 'OPEN'
  const answeredCount = answers.filter((a) => a.agreement !== null).length
  const allAnswered = answeredCount === project.summaryTopics.length

  return (
    <main className="container main">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link to="/">หน้าแรก</Link>
        <span>›</span>
        <span>เรื่องที่เปิดรับฟังความคิดเห็น</span>
      </nav>

      <article className="card post-hero">
        <header className="post-hero-head">
          <span className={`status ${isOpen ? 'status-open' : 'status-closed'}`}>{PROJECT_STATUS_LABEL[project.status]}</span>
          <h1>{project.title}</h1>
          <div className="muted">เผยแพร่เมื่อ {formatLongDate(project.createdAt)}</div>
        </header>

        {/* Sanitized server-side (backend/src/lib/html.ts) before it is stored. */}
        {project.description && <div className="prose post-body" dangerouslySetInnerHTML={{ __html: project.description }} />}
      </article>

      <div className="post-main">
        {project.pdfUrl && <PdfViewer url={project.pdfUrl} title={project.title} />}

        <section className="card response-card" id="respond">
          <div className="response-head">
            <h2>แบบรับฟังความคิดเห็น</h2>
            {user?.role === 'ADMIN' && (
              <Link to={`/admin/projects/${project.id}/responses`} className="btn btn-sm btn-ghost">
                ดูคำตอบทั้งหมด (ผู้ดูแลระบบ)
              </Link>
            )}
          </div>

          {saved && (
            <p className="notice">
              คุณตอบแล้วเมื่อ {formatDate(saved.createdAt)}
              {isOpen ? ' แก้ไขคำตอบด้านล่างแล้วกดบันทึก หรือถอนคำตอบได้จนกว่าจะปิดรับฟัง' : ''}
            </p>
          )}
          {!isOpen && (
            <p className="notice">
              เรื่องนี้ปิดรับฟังความคิดเห็นแล้ว{saved ? ' ด้านล่างคือคำตอบของคุณ' : ''}
            </p>
          )}

          {loadingResponse ? (
            <Loading />
          ) : !isOpen && !saved ? null : (
            <form onSubmit={onSubmit} className="form response-form">
              {isOpen && (
                <p className="muted small">
                  กรุณาเลือก “{AGREE_LABEL.yes}” หรือ “{AGREE_LABEL.no}” ให้ครบทุกหัวข้อ หากเห็นด้วย สามารถแสดงความเห็นเพิ่มเติมและเลือกหน่วยงานที่เกี่ยวข้องได้
                </p>
              )}
              {project.summaryTopics.map((t, i) => (
                <TopicField
                  key={t.id}
                  topic={t}
                  number={i + 1}
                  draft={answers[i] ?? emptyTopicDraft(t.id)}
                  disabled={!isOpen}
                  onChange={setAnswer}
                />
              ))}

              {isOpen && (
                <>
                  <label className="checkbox">
                    <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
                    ไม่ประสงค์ให้เปิดเผยชื่อเมื่อเผยแพร่ผลการรับฟังความคิดเห็น
                  </label>

                  <ErrorBanner message={error} />
                  {message && <p className="success">{message}</p>}

                  <div className="row">
                    <button className="btn" disabled={submitting || (!!user && !allAnswered)}>
                      {submitting
                        ? 'กำลังส่ง…'
                        : !user
                          ? 'เข้าสู่ระบบเพื่อส่งความคิดเห็น'
                          : saved
                            ? 'บันทึกการแก้ไข'
                            : 'ส่งความคิดเห็น'}
                    </button>
                    {saved &&
                      (confirmWithdraw ? (
                        <>
                          <button type="button" className="btn btn-danger" onClick={onWithdraw}>
                            ยืนยันการถอนคำตอบ
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => setConfirmWithdraw(false)}>
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-ghost-danger" onClick={() => setConfirmWithdraw(true)}>
                          ถอนคำตอบ
                        </button>
                      ))}
                  </div>
                  <small className="muted">
                    {user
                      ? `ตอบแล้ว ${answeredCount} จาก ${project.summaryTopics.length} หัวข้อ · คำตอบของคุณจะเห็นได้เฉพาะคุณและผู้ดูแลระบบ`
                      : 'กรอกคำตอบได้เลย ระบบจะพาไปเข้าสู่ระบบก่อนส่ง โดยคำตอบที่กรอกไว้จะไม่หายไป'}
                  </small>
                </>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  )
}
