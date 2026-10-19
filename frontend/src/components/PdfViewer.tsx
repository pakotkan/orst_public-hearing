/**
 * Shows the project's PDF inline with the browser's built-in viewer.
 * Some mobile browsers can't render PDFs in a frame, so open and download links are always shown.
 */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  return (
    <figure className="pdf-viewer">
      <figcaption className="pdf-toolbar">
        <span className="pdf-name">
          <span aria-hidden>📄</span> เอกสารประกอบ
        </span>
        <span className="row">
          <a href={url} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
            เปิดในแท็บใหม่
          </a>
          <a href={url} download={`${title}.pdf`} className="btn btn-sm">
            ดาวน์โหลด
          </a>
        </span>
      </figcaption>
      <iframe src={`${url}#view=FitH`} title={title} className="pdf-frame" />
    </figure>
  )
}
