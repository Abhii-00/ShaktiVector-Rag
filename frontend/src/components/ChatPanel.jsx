import { useState, useRef, useEffect, useCallback } from "react"
import MessageBubble from "./MessageBubble"
import SourceCard from "./SourceCard"
import PipelineView from "./PipelineView"
import { askDebug, askStream } from "../hooks/useAPI"

function exportChat(messages) {
  let md = "# ShaktiVector RAG — Chat Export\n\n"
  md += `*Exported ${new Date().toISOString().split("T")[0]}*\n\n---\n\n`
  for (const m of messages) {
    const role = m.role === "user" ? "**You**" : "**ShaktiVector**"
    md += `### ${role}\n\n${m.content}\n\n`
    if (m.sources?.length) {
      md += `*Sources: ${m.sources.map((s) => `${s.doc_name} (${Math.round(s.similarity * 100)}%)`).join(", ")}*\n\n`
    }
    md += `---\n\n`
  }
  const blob = new Blob([md], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `shaktivector-chat-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export default function ChatPanel({ onSourceClick, showToast, pipelineMode, suggestions }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const chatRef = useRef(null)

  const scrollToBottom = useCallback((force) => {
    if (force) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      return
    }
    if (!showScrollBtn) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [showScrollBtn])

  useEffect(() => { scrollToBottom() }, [messages, streamingContent, scrollToBottom])

  const handleScroll = () => {
    const el = chatRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    setShowScrollBtn(!atBottom)
  }

  const handleSend = async (query) => {
    const q = query || input.trim()
    if (!q || loading) return

    setMessages((prev) => [...prev, { role: "user", content: q }])
    setInput("")
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
    }
    setLoading(true)
    setStreamingContent("")

    if (pipelineMode) {
      try {
        const res = await askDebug(q)
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.answer, sources: res.sources, debug: res.debug, type: "pipeline" },
        ])
      } catch (e) {
        showToast?.(e.message, "error")
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Sorry, I encountered an error. Please try again.", sources: [] },
        ])
      } finally {
        setLoading(false)
      }
      return
    }

    let content = ""
    let finalSources = []

    askStream(q, {
      onToken: (token) => {
        content += token
        setStreamingContent(content)
      },
      onDone: (sources) => {
        finalSources = sources || []
      },
      onError: (e) => {
        showToast?.(e.message, "error")
      },
    }).then(() => {
      if (content || finalSources.length) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: content || "No response generated.", sources: finalSources },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "No response generated.", sources: [] },
        ])
      }
      setStreamingContent("")
      setLoading(false)
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }

  const handleSuggestionClick = (suggestion) => {
    handleSend(suggestion)
  }

  const allMessages = streamingContent
    ? [...messages, { role: "assistant", content: streamingContent, _streaming: true }]
    : messages

  return (
    <>
      <div
        ref={chatRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
      >
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1 text-xs text-gray-500 dark:text-gray-400 shadow-md hover:shadow-lg transition-shadow"
          >
            ↓ New message
          </button>
        )}

        {messages.length === 0 && !loading && !streamingContent && (
          <div className="flex flex-col items-start px-8 pt-12 text-gray-400 dark:text-gray-500">
            <svg className="w-20 h-20 mb-5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-xl font-semibold text-gray-500 dark:text-gray-400">Upload a document to get started</p>
            <p className="text-[15px] mt-1">Ask questions about your documents and get AI-powered answers</p>

            {suggestions.length > 0 && (
              <div className="mt-8 w-full max-w-lg space-y-2.5">
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">Try asking</p>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left text-[15px] px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-600/50 text-gray-600 dark:text-gray-400 hover:border-primary/50 hover:text-primary dark:hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {allMessages.map((msg, i) => (
          <div key={i} className="space-y-2 animate-[fadeIn_0.3s_ease-out]">
            {msg.type === "pipeline" ? (
              <div className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <PipelineView debugData={{ debug: msg.debug, answer: msg.content, sources: msg.sources }} />
              </div>
            ) : (
              <>
                <MessageBubble role={msg.role}>{msg.content}</MessageBubble>
                {msg.sources && msg.sources.length > 0 && !msg._streaming && (
                  <div className="flex flex-col gap-2 pl-11">
                    {msg.sources.slice(0, 3).map((src, j) => (
                      <SourceCard key={j} source={src} onClick={onSourceClick} />
                    ))}
                    {msg.sources.length > 3 && (
                      <button className="text-xs text-primary hover:underline pl-1 text-left">
                        +{msg.sources.length - 3} more sources
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {loading && !streamingContent && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5 shadow-sm">
              SV
            </div>
            <div className="bg-white dark:bg-surface-dark rounded-2xl rounded-tl-md px-4 py-3 border border-gray-100 dark:border-gray-700/50 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700/50 bg-white dark:bg-surface-dark shrink-0">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => { setInput(e.target.value); handleInput() }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your documents..."
              className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-600/50 pl-4 pr-10 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary dark:bg-gray-800/50 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
            />
          </div>
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="px-3.5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => exportChat(messages)}
              className="px-2.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600/50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
              title="Export chat"
              aria-label="Export chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </>
  )
}
