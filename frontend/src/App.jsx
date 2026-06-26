import { useState, useEffect, useCallback, useRef } from "react"
import Sidebar from "./components/Sidebar"
import ChatPanel from "./components/ChatPanel"
import Preview from "./components/Preview"
import Toast from "./components/Toast"
import SettingsModal from "./components/SettingsModal"
import { getSuggestions } from "./hooks/useAPI"

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [pipelineMode, setPipelineMode] = useState(false)
  const [chatKey, setChatKey] = useState(0)
  const [previewSource, setPreviewSource] = useState(null)
  const [toast, setToast] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const searchRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("theme", dark ? "dark" : "light")
  }, [dark])

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return
      if (e.key === "/") {
        e.preventDefault()
        document.querySelector("textarea")?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "l") {
        e.preventDefault()
        handleNewChat()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
        e.preventDefault()
        setDark((d) => !d)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  useEffect(() => {
    loadSuggestions()
  }, [chatKey])

  const loadSuggestions = async () => {
    try {
      const res = await getSuggestions()
      setSuggestions(res.suggestions || [])
    } catch {
      setSuggestions([])
    }
  }

  const handleNewChat = () => {
    setChatKey((k) => k + 1)
    setPreviewSource(null)
    loadSuggestions()
  }

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-bg-dark">
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-surface-dark shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xs font-bold shadow-sm">
              SV
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">ShaktiVector</h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">RAG · Sovereign Intelligence</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPipelineMode((p) => !p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              pipelineMode
                ? "border-primary bg-primary text-white shadow-sm"
                : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Pipeline
            </span>
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            title="Settings"
            aria-label="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            </svg>
          </button>
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            title="New chat (Ctrl+L)"
            aria-label="New chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setDark((d) => !d)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            title={dark ? "Light mode (Ctrl+Shift+D)" : "Dark mode (Ctrl+Shift+D)"}
          >
            {dark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <div className={`fixed inset-y-0 left-0 z-20 md:relative md:z-auto ${sidebarOpen ? "block animate-fade-in" : "hidden"} md:block`}>
          <Sidebar
            onSelectDoc={(doc) => { setPreviewSource({ doc_name: doc.filename, doc_id: doc.id, chunk_index: 0, similarity: 1 }); setSidebarOpen(false) }}
            showToast={showToast}
            searchRef={searchRef}
          />
        </div>

        <main className="flex-1 flex flex-col min-w-0" key={chatKey}>
          <ChatPanel onSourceClick={setPreviewSource} showToast={showToast} pipelineMode={pipelineMode} suggestions={suggestions} />
        </main>

        {previewSource && (
          <Preview source={previewSource} onClose={() => setPreviewSource(null)} />
        )}
      </div>

      <footer className="px-5 py-1.5 text-[10px] text-gray-400 dark:text-gray-600 border-t border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-surface-dark shrink-0 text-center">
        ShaktiVector RAG · Powered by ShaktiDB &amp; Ollama
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} showToast={showToast} />

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
