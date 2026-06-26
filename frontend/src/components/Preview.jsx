import { useState, useEffect, useRef } from "react"
import { getDocumentText } from "../hooks/useAPI"

export default function Preview({ source, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const closeRef = useRef(null)

  useEffect(() => {
    if (!source?.doc_id) return
    setLoading(true)
    getDocumentText(source.doc_id)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
    closeRef.current?.focus()
  }, [source])

  if (!source) return null

  return (
    <aside className="w-96 shrink-0 border-l border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-surface-dark flex flex-col animate-slide-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700/50">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{source.doc_name}</h2>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            Chunk {source.chunk_index} · <span className="font-mono">{Math.round(Math.abs(source.similarity) * 100)}%</span> match
          </p>
        </div>
        <button
          ref={closeRef}
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 ml-2 transition-colors"
          aria-label="Close preview"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-2">
                <div className="h-3 skeleton rounded flex-1" />
                <div className="h-3 skeleton rounded w-1/4" />
              </div>
            ))}
          </div>
        )}
        {!loading && data && (
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {data.chunks.map((c, i) => {
              const isHighlighted = c.index === source.chunk_index
              return (
                <span
                  key={i}
                  className={isHighlighted ? "bg-yellow-100 dark:bg-yellow-900/30 rounded-sm px-0.5 ring-1 ring-yellow-200 dark:ring-yellow-700/30" : ""}
                >
                  {c.text}
                  {i < data.chunks.length - 1 && "\n\n"}
                </span>
              )
            })}
          </div>
        )}
        {!loading && !data && (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center mt-12">Document text unavailable</p>
        )}
      </div>
    </aside>
  )
}
