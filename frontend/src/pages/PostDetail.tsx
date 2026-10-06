import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, errorMessage, formatDate, formatLongDate, fullName, isPdf, type Comment, type Post } from '../lib/api'
import { loginUrl, useAuth } from '../lib/auth'
import { PdfViewer } from '../components/PdfViewer'
import { ErrorBanner, Loading } from '../components/ui'
import { NotFound } from './NotFound'

type CommentPage = { comments: Comment[]; total: number; page: number; pageSize: number }

const MAX_LENGTH = 2000
const draftKey = (postId: string) => `comment-draft:${postId}`

function readDraft(postId: string) {
  try {
    return sessionStorage.getItem(draftKey(postId)) ?? ''
  } catch {
    return ''
  }
}

function writeDraft(postId: string, value: string) {
  try {
    if (value) sessionStorage.setItem(draftKey(postId), value)
    else sessionStorage.removeItem(draftKey(postId))
  } catch {
    /* storage unavailable */
  }
}

/**
 * `/posts/:id`: anyone can read. Clicking "Comment" as a guest saves the draft and goes to /login;
 * after login/register the user returns here with the draft restored.
 */
export function PostDetail() {
  const { id = '' } = useParams()
  const { user, loading: authLoading } = useAuth()
  const isAdmin = user?.role === 'ADMIN'
  const navigate = useNavigate()
  const formRef = useRef<HTMLTextAreaElement>(null)

  const [post, setPost] = useState<Post | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingComments, setLoadingComments] = useState(true)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPost(null)
    setNotFound(false)
    setContent(readDraft(id))
    api<{ post: Post }>(`/posts/${encodeURIComponent(id)}`)
      .then((d) => setPost(d.post))
      .catch((e) => (e instanceof ApiError && e.status === 404 ? setNotFound(true) : setError(e.message)))
  }, [id])

  // Coming back from login with a saved draft: focus the comment box without scrolling past the header.
  useEffect(() => {
    if (post && user && readDraft(id)) formRef.current?.focus({ preventScroll: true })
  }, [post, user, id])

  // The server returns only the comments this viewer may see (admin: all, user: own, guest: none).
  const loadComments = useCallback(
    async (pageToLoad: number) => {
      if (!user) {
        setComments([])
        setTotal(0)
        setLoadingComments(false)
        return
      }
      setLoadingComments(true)
      try {
        const data = await api<CommentPage>(`/posts/${encodeURIComponent(id)}/comments?page=${pageToLoad}`)
        setComments((prev) => (pageToLoad === 1 ? data.comments : [...prev, ...data.comments]))
        setTotal(data.total)
        setPage(pageToLoad)
      } catch {
        /* post errors are shown above */
      } finally {
        setLoadingComments(false)
      }
    },
    [id, user],
  )

  useEffect(() => {
    if (!authLoading) loadComments(1)
  }, [loadComments, authLoading])

  function goToLogin() {
    writeDraft(id, content)
    navigate(loginUrl(`/posts/${id}`))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return goToLogin()
    if (!content.trim()) return

    setError('')
    setPosting(true)
    try {
      const { comment } = await api<{ comment: Comment }>(`/posts/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      })
      setComments((prev) => [comment, ...prev])
      setTotal((t) => t + 1)
      setContent('')
      writeDraft(id, '')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return goToLogin()
      setError(errorMessage(err, 'ไม่สามารถส่งความคิดเห็นได้'))
    } finally {
      setPosting(false)
    }
  }

  async function onDelete(commentId: string) {
    try {
      await api(`/comments/${commentId}`, { method: 'DELETE' })
      setComments((prev) => prev.filter((c) => c.id !== commentId))
      setTotal((t) => t - 1)
    } catch (err) {
      setError(errorMessage(err, 'ไม่สามารถลบความคิดเห็นได้'))
    }
  }

  if (notFound) return <NotFound />
  if (!post)
    return <main className="container main">{error ? <ErrorBanner message={error} /> : <Loading />}</main>

  const pdfs = post.attachments.filter(isPdf)

  return (
    <main className="container main">
      <nav className="breadcrumb" aria-label="breadcrumb">
        <Link to="/">หน้าแรก</Link>
        <span>›</span>
        <span>เรื่องที่เปิดรับฟังความคิดเห็น</span>
      </nav>

      {/* Top card: title, date and content. PDFs sit below, beside the comment box. */}
      <article className="card post-hero">
        <header className="post-hero-head">
          <h1>{post.title}</h1>
          <div className="muted">เผยแพร่เมื่อ {formatLongDate(post.createdAt)}</div>
        </header>

        {/* Sanitized server-side (backend/src/lib/html.ts) before it is stored. */}
        {post.content && <div className="prose post-body" dangerouslySetInnerHTML={{ __html: post.content }} />}
      </article>

      <div className="post-layout">
        <div className="post-main">
          {pdfs.map((a) => (
            <PdfViewer key={a.id} attachment={a} />
          ))}

          <div className="card">
            <section className="comments" id="comments">
              <h2>
                {isAdmin ? 'ความคิดเห็นทั้งหมด' : user ? 'ความคิดเห็นของคุณ' : 'ความคิดเห็น'}
                {user && ` (${total.toLocaleString('th-TH')})`}
              </h2>

              <ul className="comment-list">
                {comments.map((c) => (
                  <li key={c.id} className="card comment">
                    <span className="avatar" aria-hidden>
                      {c.user.firstName.charAt(0)}
                    </span>
                    <div className="comment-main">
                      <div className="comment-meta">
                        <strong>{fullName(c.user)}</strong>
                        <span className="muted small">{formatDate(c.createdAt)}</span>
                        {user && (user.id === c.user.id || isAdmin) && (
                          <button className="btn-link danger small" onClick={() => onDelete(c.id)}>
                            ลบ
                          </button>
                        )}
                      </div>
                      <p className="comment-body">{c.content}</p>
                    </div>
                  </li>
                ))}
              </ul>

              {!loadingComments && comments.length === 0 && (
                <p className="muted center">
                  {isAdmin ? 'ยังไม่มีความคิดเห็น' : user ? 'คุณยังไม่ได้แสดงความคิดเห็นในเรื่องนี้' : 'ความคิดเห็นจะแสดงเฉพาะเจ้าของความคิดเห็นและผู้ดูแลระบบ'}
                </p>
              )}
              {comments.length < total && (
                <button className="btn btn-ghost" disabled={loadingComments} onClick={() => loadComments(page + 1)}>
                  {loadingComments ? 'กำลังโหลด…' : 'ดูความคิดเห็นเพิ่มเติม'}
                </button>
              )}
            </section>
          </div>
        </div>

        <aside className="card side-card">
          <h2>แสดงความคิดเห็น</h2>
          <form onSubmit={onSubmit} className="form">
            <textarea
              ref={formRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              maxLength={MAX_LENGTH}
              placeholder="พิมพ์ความคิดเห็นของคุณที่นี่…"
              aria-label="ความคิดเห็นของคุณ"
            />
            <small className="muted">
              {user
                ? `${content.length.toLocaleString('th-TH')}/${MAX_LENGTH.toLocaleString('th-TH')} ตัวอักษร`
                : 'กรุณาเข้าสู่ระบบก่อนแสดงความคิดเห็น'}
            </small>
            <button className="btn" disabled={posting || (!!user && !content.trim())}>
              {posting ? 'กำลังส่ง…' : user ? 'ส่งความคิดเห็น' : 'เข้าสู่ระบบเพื่อแสดงความคิดเห็น'}
            </button>
            <ErrorBanner message={error} />
          </form>
          <p className="muted small side-note">ความคิดเห็นของคุณจะเห็นได้เฉพาะคุณและผู้ดูแลระบบ</p>
        </aside>
      </div>
    </main>
  )
}
