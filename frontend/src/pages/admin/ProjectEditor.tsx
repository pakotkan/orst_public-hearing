import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  api,
  AGREE_LABEL,
  DEFAULT_TOPIC_COUNT,
  errorMessage,
  PROJECT_STATUS_LABEL,
  type AdminProject,
  type ProjectStatus,
} from '../../lib/api'
import { RichTextEditor } from '../../components/RichTextEditor'
import { ErrorBanner, Loading } from '../../components/ui'

/** `key` is a stable React key; `id` is set once the server has saved the topic. */
type QuestionDraft = { key: string; id?: string; question: string; answers: number }

let nextKey = 0
const blankQuestion = (): QuestionDraft => ({ key: `new-${++nextKey}`, question: '', answers: 0 })

function toDrafts(project: AdminProject): QuestionDraft[] {
  return project.summaryTopics.map((t) => ({ key: t.id, id: t.id, question: t.title, answers: t._count.answers }))
}

/** `/admin/projects/new` and `/admin/projects/:id/edit`. The PDF can be picked before the first save. */
export function ProjectEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('DRAFT')
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    isNew ? Array.from({ length: DEFAULT_TOPIC_COUNT }, blankQuestion) : [],
  )
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pendingPdf, setPendingPdf] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  function load(project: AdminProject) {
    setTitle(project.title)
    setDescription(project.description ?? '')
    setStatus(project.status)
    setQuestions(toDrafts(project))
    setPdfUrl(project.pdfUrl)
  }

  useEffect(() => {
    if (isNew) return
    api<{ project: AdminProject }>(`/admin/projects/${id}`)
      .then(({ project }) => load(project))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // ---- Topics ----
  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q) => (q.key === key ? { ...q, ...patch } : q)))
  }

  function moveQuestion(index: number, by: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev]
      const [q] = next.splice(index, 1)
      next.splice(index + by, 0, q)
      return next
    })
  }

  function removeQuestion(key: string) {
    setConfirmRemove(null)
    setQuestions((prev) => prev.filter((q) => q.key !== key))
  }

  // ---- PDF (one per project; uploading again replaces it) ----
  async function uploadPdf(projectId: string, file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api<{ pdfUrl: string }>(`/admin/projects/${projectId}/pdf`, { method: 'PUT', body: form })
      setPdfUrl(res.pdfUrl)
      return true
    } catch (e) {
      setError(`อัปโหลด PDF ไม่สำเร็จ: ${errorMessage(e)}`)
      return false
    } finally {
      setUploading(false)
    }
  }

  function onPickPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (isNew) setPendingPdf(file)
    else uploadPdf(id!, file)
  }

  async function removePdf() {
    setError('')
    try {
      await api(`/admin/projects/${id}/pdf`, { method: 'DELETE' })
      setPdfUrl(null)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  // ---- Save ----
  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const body = JSON.stringify({
        title,
        description,
        status,
        summaryTopics: questions.map((q) => ({ id: q.id, title: q.question })),
      })
      if (isNew) {
        const { project } = await api<{ project: AdminProject }>('/admin/projects', { method: 'POST', body })
        if (pendingPdf) await uploadPdf(project.id, pendingPdf)
        setPendingPdf(null)
        navigate(`/admin/projects/${project.id}/edit`, { replace: true })
      } else {
        // Reload from the response so newly created topics get their ids (otherwise the next save would duplicate them).
        const { project } = await api<{ project: AdminProject }>(`/admin/projects/${id}`, { method: 'PATCH', body })
        load(project)
      }
      setMessage('บันทึกเรียบร้อยแล้ว')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <>
      <div className="page-header">
        <h1>{isNew ? 'สร้างเรื่องใหม่' : 'แก้ไขเรื่อง'}</h1>
        <div className="row">
          {!isNew && (
            <Link to={`/admin/projects/${id}/responses`} className="btn btn-ghost">
              ดูคำตอบ
            </Link>
          )}
          <Link to="/admin/projects" className="btn btn-ghost">
            ← เรื่องทั้งหมด
          </Link>
        </div>
      </div>

      <form className="card form" onSubmit={onSave}>
        <label>
          ชื่อเรื่อง
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>

        <div className="field">
          <span className="field-label">รายละเอียด</span>
          <RichTextEditor value={description} onChange={setDescription} />
        </div>

        <div className="field">
          <span className="field-label">เอกสาร PDF</span>
          {pdfUrl ? (
            <ul className="file-list">
              <li>
                <span className="file-icon" aria-hidden>
                  📄
                </span>
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  เปิดดูเอกสาร
                </a>
                <button type="button" className="btn-link small" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  เปลี่ยนไฟล์
                </button>
                <button type="button" className="btn-link danger small" onClick={removePdf}>
                  ลบ
                </button>
              </li>
            </ul>
          ) : pendingPdf ? (
            <ul className="file-list">
              <li>
                <span className="file-icon">⏳</span>
                {pendingPdf.name}
                <span className="muted small">จะอัปโหลดเมื่อกดบันทึก</span>
                <button type="button" className="btn-link danger small" onClick={() => setPendingPdf(null)}>
                  ลบ
                </button>
              </li>
            </ul>
          ) : (
            <div>
              <button type="button" className="btn btn-ghost" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? 'กำลังอัปโหลด…' : '+ เลือกไฟล์ PDF'}
              </button>
              <small className="muted"> 1 ไฟล์ ขนาดไม่เกิน 10 MB</small>
            </div>
          )}
          <input ref={fileInput} type="file" accept=".pdf,application/pdf" hidden onChange={onPickPdf} />
        </div>

        <div className="field">
          <span className="field-label">หัวข้อรับฟังความคิดเห็น ({questions.length})</span>
          <small className="muted">
            ผู้ตอบต้องเลือก “{AGREE_LABEL.yes}” หรือ “{AGREE_LABEL.no}” ทุกหัวข้อ เมื่อเลือก “{AGREE_LABEL.yes}” จะแสดงความเห็นเพิ่มเติมและเลือกหน่วยงานที่เกี่ยวข้องได้
          </small>
          <ol className="question-editor-list">
            {questions.map((q, i) => (
              <li key={q.key} className="question-editor">
                <div className="question-editor-head">
                  <strong>หัวข้อที่ {i + 1}</strong>
                  {q.answers > 0 && <span className="pill pill-blue">ตอบแล้ว {q.answers} คน</span>}
                  <div className="action-buttons">
                    <button type="button" className="btn btn-sm btn-ghost" disabled={i === 0} onClick={() => moveQuestion(i, -1)} aria-label="เลื่อนขึ้น">
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={i === questions.length - 1}
                      onClick={() => moveQuestion(i, 1)}
                      aria-label="เลื่อนลง"
                    >
                      ↓
                    </button>
                    {confirmRemove === q.key ? (
                      <>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => removeQuestion(q.key)}>
                          {q.answers > 0 ? `ยืนยัน (คำตอบ ${q.answers} รายการจะถูกลบเมื่อบันทึก)` : 'ยืนยันการลบ'}
                        </button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmRemove(null)}>
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost-danger"
                        disabled={questions.length <= 1}
                        title={questions.length <= 1 ? 'ต้องมีอย่างน้อย 1 หัวข้อ' : undefined}
                        onClick={() => setConfirmRemove(q.key)}
                      >
                        ลบหัวข้อ
                      </button>
                    )}
                  </div>
                </div>
                <input
                  value={q.question}
                  onChange={(e) => updateQuestion(q.key, { question: e.target.value })}
                  required
                  maxLength={1000}
                  placeholder="เช่น เห็นด้วยกับแนวทางในบทที่ 1 หรือไม่"
                  aria-label={`หัวข้อที่ ${i + 1}`}
                />
              </li>
            ))}
          </ol>
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}>
              + เพิ่มหัวข้อ
            </button>
          </div>
        </div>

        <label className="status-select">
          สถานะ
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <small className="muted">ฉบับร่าง: ไม่แสดงบนหน้าเว็บไซต์ · เปิด: รับคำตอบ · ปิด: แสดงเรื่องแต่ไม่รับคำตอบเพิ่ม</small>
        </label>

        <ErrorBanner message={error} />
        {message && <p className="success">{message}</p>}
        <div className="row">
          <button className="btn" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : isNew ? 'สร้างเรื่อง' : 'บันทึกการแก้ไข'}
          </button>
          {!isNew && status !== 'DRAFT' && (
            <Link to={`/projects/${id}`} target="_blank">
              ดูบนหน้าเว็บไซต์ ↗
            </Link>
          )}
        </div>
      </form>
    </>
  )
}
