import { useState, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

function MessageBubble({ role, children }) {
  const [copied, setCopied] = useState(false)
  const isUser = role === "user"

  const handleCopy = () => {
    const text = typeof children === "string" ? children : ""
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const content =
    typeof children === "string" ? (
      isUser ? (
        children
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[13px] font-mono">{children}</code>
            ),
            pre: ({ children }) => (
              <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto text-sm font-mono leading-relaxed my-2">{children}</pre>
            ),
          }}
        >
          {children}
        </ReactMarkdown>
      )
    ) : (
      children
    )

  return (
    <div className={`flex gap-3 group ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5 shadow-sm">
          SV
        </div>
      )}
      <div className="relative max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
            isUser
              ? "bg-primary text-white rounded-tr-md shadow-sm"
              : "bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700/50 shadow-sm rounded-tl-md"
          }`}
        >
          {content}
        </div>
        {!isUser && (
          <button
            onClick={handleCopy}
            className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Copy answer"
            aria-label="Copy answer"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 dark:from-gray-500 dark:to-gray-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5 shadow-sm">
          U
        </div>
      )}
    </div>
  )
}

export default memo(MessageBubble)
