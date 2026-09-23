import { useCallback, useRef, useState } from 'react'
import { FileText, UploadCloud } from 'lucide-react'

const ACCEPT = '.txt,.text,.md,.markdown,text/plain'
const PLANNED = {
  '.pdf': 'PDF support is on the roadmap — export or copy the text as .txt for now.',
  '.docx': 'Word (.docx) support is on the roadmap — save the file as .txt for now.',
  '.doc': 'Legacy Word (.doc) support is on the roadmap — save the file as .txt for now.',
  '.rtf': 'RTF files aren’t supported yet — save the file as .txt first.',
}

export default function FileDrop({ onFile, busy, error }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    (files) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a text file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-laurel-600 ${
          dragging ? 'border-laurel-600 bg-laurel-50' : 'border-rule-strong bg-paper/60 hover:bg-paper-deep/60'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        {busy ? (
          <>
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-laurel-700" aria-hidden />
            <p className="mt-4 text-sm font-medium text-ink-700">Extracting text…</p>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-md border border-rule bg-white">
              <UploadCloud size={22} className="text-ink-500" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-medium text-ink-800">
              Drop a .txt file here, or <span className="text-laurel-800 underline underline-offset-2">browse</span>
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500">
              <FileText size={12} aria-hidden /> Plain text up to 512 KB — .txt, .md
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-attention-high-border bg-attention-high-bg px-3.5 py-2.5 text-[13px] leading-5 text-attention-high" role="alert">
          {error.message || 'The file could not be read.'}
        </p>
      )}
    </div>
  )
}

export { PLANNED as PLANNED_FORMATS }
