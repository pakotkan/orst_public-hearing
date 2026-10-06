import { formatBytes, isImage, type Attachment } from '../lib/api'

/** Images as a gallery, everything else as a download list. Optional `onDelete` for the admin editor. */
export function AttachmentList({
  attachments,
  onDelete,
}: {
  attachments: Attachment[]
  onDelete?: (attachment: Attachment) => void
}) {
  if (attachments.length === 0) return null
  const images = attachments.filter(isImage)
  const files = attachments.filter((a) => !isImage(a))

  return (
    <div className="attachments">
      {images.length > 0 && (
        <div className="gallery">
          {images.map((a) => (
            <figure key={a.id}>
              <a href={a.url} target="_blank" rel="noreferrer">
                <img src={a.url} alt={a.originalName} loading="lazy" />
              </a>
              {onDelete && (
                <button type="button" className="btn-link danger small" onClick={() => onDelete(a)}>
                  ลบ
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((a) => (
            <li key={a.id}>
              <span className="file-icon" aria-hidden>
                📎
              </span>
              <a href={a.url} download={a.originalName}>
                {a.originalName}
              </a>
              <span className="muted small">{formatBytes(a.size)}</span>
              {onDelete && (
                <button type="button" className="btn-link danger small" onClick={() => onDelete(a)}>
                  ลบ
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
