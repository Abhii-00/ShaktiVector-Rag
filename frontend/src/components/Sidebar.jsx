import { useState, useRef, useEffect } from "react"
import { uploadDocument, getDocuments, deleteDocument } from "../hooks/useAPI"

function FileIcon({ name }) {
  const ext = name.split(".").pop().toLowerCase()
  const colors = {
    pdf: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400", label: "PDF" },
    docx: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", label: "DOC" },
    txt: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", label: "TXT" },
  }
  const c = colors[ext] || colors.txt
  return (
    <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center ${c.text} text-[10px] font-semibold shrink-0`}>
      {c.label}
    </div>
  )
}

export default function Sidebar({ onSelectDoc, showToast, searchRef }) {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const inputRef = useRef(null)

  const loadDocs = () => {
    setLoading(true)
    getDocuments()
      .then(setDocs)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDocs() }, [])

  const handleUpload = async (file) => {
    if (!file || uploading) return
    const allowed = [".pdf", ".docx", ".txt"]
    const ext = "." + file.name.split(".").pop().toLowerCase()
    if (!allowed.includes(ext)) {
      showToast?.("Unsupported file type. Use PDF, DOCX, or TXT.", "error")
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast?.("File too large. Max 10MB.", "error")
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      const res = await uploadDocument(file, setProgress)
      showToast?.(`${res.filename} indexed (${res.chunks} chunk${res.chunks !== 1 ? "s" : ""})`, "success")
      loadDocs()
    } catch (e) {
      showToast?.(e.message, "error")
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleFiles = async (files) => {
    const arr = Array.from(files)
    const results = await Promise.allSettled(arr.map((f) => handleUpload(f)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed > 0 && failed < arr.length) {
      showToast?.(`${arr.length - failed} uploaded, ${failed} failed`, "error")
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteDocument(id)
      showToast?.(`${name} deleted`, "success")
      loadDocs()
    } catch (e) {
      showToast?.(e.message, "error")
    }
  }

  const handleDeleteAll = async () => {
    if (docs.length === 0 || !confirm("Delete all documents?")) return
    const results = await Promise.allSettled(docs.map((d) => deleteDocument(d.id)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed === 0) {
      showToast?.("All documents deleted", "success")
    } else if (failed === docs.length) {
      showToast?.("Failed to delete documents", "error")
    } else {
      showToast?.(`Deleted ${docs.length - failed} documents (${failed} failed)`, "success")
    }
    loadDocs()
  }

  const filtered = search.trim()
    ? docs.filter((d) => d.filename.toLowerCase().includes(search.toLowerCase()))
    : docs

  return (
    <aside className="w-72 shrink-0 border-r border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-surface-dark flex flex-col h-full">
      <div
        className={`p-3 border-b border-gray-100 dark:border-gray-700/50 ${dragOver ? "bg-primary-light dark:bg-indigo-900/20" : ""}`}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        <div
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
            dragOver
              ? "border-primary bg-primary-light dark:bg-indigo-900/20"
              : "border-gray-200 dark:border-gray-600/50 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-800/50"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Uploading... {progress}%</p>
            </div>
          ) : (
            <>
              <svg className="w-7 h-7 mx-auto mb-2 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Drop files or click to upload</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">PDF · DOCX · TXT (max 10MB each)</p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = "" }}
        />
      </div>

      <div className="px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="relative">
          <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="w-full text-xs bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600/50 rounded-lg pl-7 pr-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-700/50">
        <h2 className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Documents</h2>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {search ? `${filtered.length}/${docs.length}` : `${docs.length} file${docs.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2.5 p-2">
                <div className="w-9 h-9 rounded-lg skeleton" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 skeleton rounded w-3/4" />
                  <div className="h-2 skeleton rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <svg className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {search ? "No matching documents" : "No documents yet"}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {search ? "Try a different search term" : "Upload a PDF, DOCX, or TXT file"}
            </p>
          </div>
        )}
        {filtered.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-2.5 p-2.5 mx-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group cursor-pointer transition-colors first:mt-1"
            onClick={() => onSelectDoc?.(doc)}
          >
            <FileIcon name={doc.filename} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate leading-tight">{doc.filename}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{doc.chunks} chunk{doc.chunks !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, doc.filename) }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {docs.length > 0 && (
        <div className="p-2 border-t border-gray-100 dark:border-gray-700/50">
          <button
            onClick={handleDeleteAll}
            className="w-full text-[11px] text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          >
            Delete all ({docs.length})
          </button>
        </div>
      )}
    </aside>
  )
}
