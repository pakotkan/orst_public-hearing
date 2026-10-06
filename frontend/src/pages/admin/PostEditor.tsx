import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, errorMessage, type AdminPost, type Attachment } from '../../lib/api'
import { AttachmentList } from '../../components/AttachmentList'
import { RichTextEditor } from '../../components/RichTextEditor'
import { ErrorBanner, Loading } from '../../components/ui'

const ACCEPT = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip'

/** `/admin/posts/new` and `/admin/posts/:id/edit`. Files can be picked before the first save. */
export function PostEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPublished, setIsPublished] = useState(true)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew) return
    api<{ post: AdminPost }>(`/admin/posts/${id}`)
      .then(({ post }) => {
        setTitle(post.title)
        setContent(post.content)
        setIsPublished(post.isPublished)
        setAttachments(post.attachments)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id, isNew])

  async function uploadFiles(postId: string, files: File[]) {
    const failed: string[] = []
    for (const file of files) {
      const form = new FormData()
      form.append('file', file)
      try {
        const { attachment } = await api<{ attachment: Attachment }>(`/admin/posts/${postId}/attachments`, {
          method: 'POST',
          body: form,
        })
        setAttachments((prev) => [...prev, attachment])
      } catch (e) {
        failed.push(`${file.name}: ${errorMessage(e)}`)
      }
    }
    if (failed.length) setError(`อัปโหลดไฟล์บางรายการไม่สำเร็จ: ${failed.join('; ')}`)
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setError('')
    if (isNew) setPendingFiles((prev) => [...prev, ...files])
    else uploadFiles(id!, files)
  }

  async function removeAttachment(a: Attachment) {
    setError('')
    try {
      await api(`/admin/attachments/${a.id}`, { method: 'DELETE' })
      setAttachments((prev) => prev.filter((x) => x.id !== a.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setSaving(true)
    try {
      const body = JSON.stringify({ title, content, isPublished })
      if (isNew) {
        const { post } = await api<{ post: { id: string } }>('/admin/posts', { method: 'POST', body })
        await uploadFiles(post.id, pendingFiles)
        setPendingFiles([])
        navigate(`/admin/posts/${post.id}/edit`, { replace: true })
      } else {
        await api(`/admin/posts/${id}`, { method: 'PATCH', body })
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
            <Link to={`/admin/posts/${id}/comments`} className="btn btn-ghost">
              ดูความคิดเห็น
            </Link>
          )}
          <Link to="/admin/posts" className="btn btn-ghost">
            ← เรื่องทั้งหมด
          </Link>
        </div>
      </div>

      <form className="card form" onSubmit={onSave}>
        <label>
          หัวข้อ
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
        </label>

        <div className="field">
          <span className="field-label">รายละเอียด</span>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        <div className="field">
          <span className="field-label">เอกสารแนบ</span>
          <AttachmentList attachments={attachments} onDelete={removeAttachment} />
          {pendingFiles.length > 0 && (
            <ul className="file-list">
              {pendingFiles.map((f, i) => (
                <li key={`${f.name}-${i}`}>
                  <span className="file-icon">⏳</span>
                  {f.name}
                  <span className="muted small">จะอัปโหลดเมื่อกดบันทึก</span>
                  <button
                    type="button"
                    className="btn-link danger small"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => fileInput.current?.click()}>
              + เพิ่มไฟล์
            </button>
            <input ref={fileInput} type="file" multiple accept={ACCEPT} hidden onChange={onPickFiles} />
            <small className="muted"> รูปภาพ, PDF, ไฟล์ Office, TXT/CSV หรือ ZIP ขนาดไม่เกิน 10 MB ต่อไฟล์</small>
          </div>
        </div>

        <label className="checkbox">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          เผยแพร่ (แสดงบนหน้าแรก)
        </label>

        <ErrorBanner message={error} />
        {message && <p className="success">{message}</p>}
        <div className="row">
          <button className="btn" disabled={saving}>
            {saving ? 'กำลังบันทึก…' : isNew ? 'สร้างเรื่อง' : 'บันทึกการแก้ไข'}
          </button>
          {!isNew && isPublished && (
            <Link to={`/posts/${id}`} target="_blank">
              ดูบนหน้าเว็บไซต์ ↗
            </Link>
          )}
        </div>
      </form>
    </>
  )
}
