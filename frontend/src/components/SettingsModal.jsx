import { useState, useEffect } from "react"
import { getConfig, updateConfig } from "../hooks/useAPI"

export default function SettingsModal({ open, onClose, showToast }) {
  const [config, setConfig] = useState({
    llm_provider: "ollama",
    llm_model: "llama3.2",
    groq_api_key: "",
    chunk_size: 512,
    chunk_overlap: 50,
    top_k: 5,
  })
  const [keyDirty, setKeyDirty] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      getConfig()
        .then((res) => {
          setConfig((prev) => ({ ...prev, ...res }))
          setKeyDirty(false)
        })
        .catch(() => {})
    }
  }, [open])

  const handleSave = async () => {
    setLoading(true)
    try {
      const payload = { ...config }
      if (!keyDirty) delete payload.groq_api_key
      await updateConfig(payload)
      showToast?.("Settings saved", "success")
      onClose()
    } catch (e) {
      showToast?.(e.message, "error")
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 animate-[fadeIn_0.2s_ease-out]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">LLM Provider</label>
            <select
              value={config.llm_provider}
              onChange={(e) => setConfig((p) => ({ ...p, llm_provider: e.target.value }))}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600/50 px-3 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            >
              <option value="ollama">Ollama (Local)</option>
              <option value="groq">Groq API</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Model</label>
            <input
              type="text"
              value={config.llm_model}
              onChange={(e) => setConfig((p) => ({ ...p, llm_model: e.target.value }))}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600/50 px-3 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {config.llm_provider === "groq" && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Groq API Key</label>
              <input
                type="password"
                value={config.groq_api_key}
                onChange={(e) => { setConfig((p) => ({ ...p, groq_api_key: e.target.value })); setKeyDirty(true) }}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600/50 px-3 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="Enter your Groq API key"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Chunk Size</label>
              <input
                type="number"
                min={128}
                max={2048}
                value={config.chunk_size}
                onChange={(e) => setConfig((p) => ({ ...p, chunk_size: parseInt(e.target.value) || 512 }))}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600/50 px-3 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Chunk Overlap</label>
              <input
                type="number"
                min={0}
                max={512}
                value={config.chunk_overlap}
                onChange={(e) => setConfig((p) => ({ ...p, chunk_overlap: parseInt(e.target.value) || 50 }))}
                className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600/50 px-3 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">Top-K Results</label>
            <input
              type="number"
              min={1}
              max={20}
              value={config.top_k}
              onChange={(e) => setConfig((p) => ({ ...p, top_k: parseInt(e.target.value) || 5 }))}
              className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-600/50 px-3 py-2 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}
