import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'

type ToolbarButton = {
  label: string
  title: string
  isActive?: (e: Editor) => boolean
  run: (e: Editor) => void
}

const BUTTONS: ToolbarButton[] = [
  { label: 'B', title: 'ตัวหนา', isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', title: 'ตัวเอียง', isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'U', title: 'ขีดเส้นใต้', isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { label: 'S', title: 'ขีดฆ่า', isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  { label: 'H2', title: 'หัวข้อ', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: 'หัวข้อย่อย', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: '• รายการ', title: 'รายการสัญลักษณ์', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1. รายการ', title: 'รายการลำดับเลข', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '❝', title: 'ข้อความอ้างอิง', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
  {
    label: 'ลิงก์',
    title: 'เพิ่มหรือลบลิงก์',
    isActive: (e) => e.isActive('link'),
    run: (e) => {
      if (e.isActive('link')) return void e.chain().focus().unsetLink().run()
      const href = window.prompt('ที่อยู่ลิงก์ (https://…)')
      if (href) e.chain().focus().extendMarkRange('link').setLink({ href }).run()
    },
  },
  { label: '―', title: 'เส้นคั่น', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: '↶', title: 'เลิกทำ', run: (e) => e.chain().focus().undo().run() },
  { label: '↷', title: 'ทำซ้ำ', run: (e) => e.chain().focus().redo().run() },
]

/** TipTap editor producing HTML. The backend sanitizes whatever this sends. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  // The last HTML this editor reported, so we can tell our own updates apart from new content passed in.
  const lastEmitted = useRef(value)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'] },
      }),
    ],
    content: value,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => {
      lastEmitted.current = editor.isEmpty ? '' : editor.getHTML()
      onChange(lastEmitted.current)
    },
  })

  // Load content that arrives after the editor was created (e.g. when editing an existing project).
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastEmitted.current) return
    lastEmitted.current = value
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  return (
    <div className="editor">
      <div className="editor-toolbar" role="toolbar">
        {BUTTONS.map((b) => (
          <button
            key={b.title}
            type="button"
            title={b.title}
            className={editor && b.isActive?.(editor) ? 'active' : undefined}
            disabled={!editor}
            // Keep focus and the text selection in the editor while clicking toolbar buttons.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && b.run(editor)}
          >
            {b.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="prose editor-content" />
    </div>
  )
}
