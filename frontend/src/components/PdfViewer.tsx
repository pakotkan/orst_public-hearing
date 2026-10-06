import { formatBytes, type Attachment } from '../lib/api'

/**
 * Shows a PDF attachment inline with the browser's built-in viewer.
 * Some mobile browsers can't render PDFs in a frame, so open and download links are always shown.
 */
export function PdfViewer({ attachment }: { attachment: Attachment }) {
  return (
    <figure className="pdf-viewer">
      <figcaption className="pdf-toolbar">
        <span className="pdf-name">
          <span aria-hidden>📄</span> {attachment.originalName}
          <span className="muted small"> · {formatBytes(attachment.size)}</span>
        </span>
        <span className="row">
          <a href={attachment.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
            เปิดในแท็บใหม่
          </a>
          <a href={attachment.url} download={attachment.originalName} className="btn btn-sm">
            ดาวน์โหลด
          </a>
        </span>
      </figcaption>
      <iframe src={`${attachment.url}#view=FitH`} title={attachment.originalName} className="pdf-frame" />
    </figure>
  )
}
