import { useState, useEffect, useRef } from "react"
import VectorSpace from "./VectorSpace"

const STEPS = [
  { id: "query", label: "Query" },
  { id: "embed", label: "Embedding" },
  { id: "search", label: "Vector Search" },
  { id: "rank", label: "Ranked Results" },
  { id: "prompt", label: "Prompt" },
  { id: "answer", label: "Answer" },
]

function EmbeddingPreview({ vector, dimensions }) {
  if (!vector?.length) return null
  const maxVal = Math.max(...vector.map(Math.abs), 0.01)
  return (
    <div className="mt-2">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {dimensions}-dimensional embedding — first {vector.length} values:
      </div>
      <div className="flex items-end gap-[3px] h-14">
        {vector.map((v, i) => {
          const pct = (v / maxVal) * 100
          return (
            <div key={i} className="flex flex-col items-center flex-1 min-w-0">
              <span className="text-[9px] text-gray-400 font-mono mb-[2px]">{v >= 0 ? "+" : ""}{v.toFixed(2)}</span>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-t-sm" style={{ height: `${Math.abs(pct)}%`, minHeight: 4, backgroundColor: v >= 0 ? "#4F46E5" : "#E11D48" }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
        <span>dim 0</span>
        <span>dim {vector.length - 1}</span>
      </div>
    </div>
  )
}

function ScoreTable({ results, selectedCount }) {
  const maxScore = results.length > 0 ? Math.max(...results.map((r) => r.score)) : 1
  return (
    <div className="mt-1">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Top {selectedCount} of {results.length} chunks selected for LLM context
      </div>
      <div className="space-y-0.5">
        {results.slice(0, 10).map((r, i) => {
          const pct = (r.score / maxScore) * 100
          const isSelected = i < selectedCount
          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${
                isSelected ? "bg-primary/5 dark:bg-primary/10" : ""
              }`}
            >
              <span className="w-4 text-right text-gray-400 font-mono">{i + 1}</span>
              <span className="flex-1 truncate text-gray-700 dark:text-gray-300">
                {r.doc_name.replace(".pdf", "")} · ch.{r.chunk_index}
              </span>
              <div className="w-20 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    isSelected ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`w-14 text-right font-mono ${isSelected ? "text-primary font-medium" : "text-gray-400"}`}>
                {r.score.toFixed(4)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PipelineView({ debugData }) {
  const [activeStep, setActiveStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [answerText, setAnswerText] = useState("")
  const [showPrompt, setShowPrompt] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [copied, setCopied] = useState(false)
  const advanceTimerRef = useRef(null)
  const prevDataKeyRef = useRef(null)

  const dataKey = debugData ? `v1|${debugData.sources?.length}` : null

  useEffect(() => {
    if (dataKey === prevDataKeyRef.current) return
    prevDataKeyRef.current = dataKey
    setActiveStep(0)
    setCompletedSteps(new Set())
    setAnswerText("")
    setShowPrompt(false)
    setShowAllResults(false)
  }, [dataKey])

  const advance = useRef(null)
  advance.current = () => {
    setCompletedSteps((prev) => {
      const next = new Set(prev)
      next.add(activeStep)
      return next
    })
    if (activeStep < STEPS.length - 1) {
      setActiveStep((s) => s + 1)
    }
  }
  const advanceFn = (...args) => advance.current?.(...args)

  useEffect(() => {
    if (activeStep === 0 && dataKey) {
      advanceTimerRef.current = setTimeout(advanceFn, 1000)
      return () => clearTimeout(advanceTimerRef.current)
    }
  }, [activeStep, dataKey])

  useEffect(() => {
    if (activeStep === 1) {
      advanceTimerRef.current = setTimeout(advanceFn, 1600)
      return () => clearTimeout(advanceTimerRef.current)
    }
  }, [activeStep])

  useEffect(() => {
    if (activeStep === 2) {
      advanceTimerRef.current = setTimeout(advanceFn, 2600)
      return () => clearTimeout(advanceTimerRef.current)
    }
  }, [activeStep])

  useEffect(() => {
    if (activeStep === 3) {
      advanceTimerRef.current = setTimeout(advanceFn, 1000)
      return () => clearTimeout(advanceTimerRef.current)
    }
  }, [activeStep])

  useEffect(() => {
    if (activeStep === 4) {
      advanceTimerRef.current = setTimeout(advanceFn, 1200)
      return () => clearTimeout(advanceTimerRef.current)
    }
  }, [activeStep])

  useEffect(() => {
    if (activeStep === 5 && dataKey) {
      const fullText = debugData?.answer
      if (!fullText) return
      let i = answerText.length
      const interval = setInterval(() => {
        i++
        setAnswerText(fullText.slice(0, i))
        if (i >= fullText.length) {
          clearInterval(interval)
        }
      }, 12)
      return () => clearInterval(interval)
    }
  }, [activeStep, dataKey])

  if (!debugData) {
    return (
      <div className="flex items-center justify-center h-full text-[15px] text-gray-400 dark:text-gray-500">
        Ask a question in Pipeline mode to visualize the RAG flow.
      </div>
    )
  }

  const { debug, answer, sources } = debugData
  const results = debug?.all_results || []

  const totalSteps = STEPS.length
  const progressPct = ((activeStep + (activeStep >= totalSteps ? 1 : 0)) / totalSteps) * 100

  function renderStepContent(id) {
    switch (id) {
      case "query":
        return (
          <div className="text-[15px] bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2.5 font-mono text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700/50 leading-relaxed">
            "{debug.query}"
          </div>
        )
      case "embed":
        return (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              SentenceTransformer <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px]">all-MiniLM-L6-v2</code>
              <span className="mx-1.5">→</span>
              {debug.query_dimensions}D vector
            </div>
            <EmbeddingPreview vector={debug.query_embedding_preview} dimensions={debug.query_dimensions} />
          </>
        )
      case "search":
        return (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Cosine similarity over <span className="font-semibold text-gray-700 dark:text-gray-300">{debug.total_chunks_scored}</span> chunk vectors
              <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
              <span className="font-mono">sim(q, c) = q · c</span>
            </div>
            <VectorSpace results={results} />
          </>
        )
      case "rank":
        return (
          <>
            <ScoreTable results={results} selectedCount={debug.selected_count || 3} />
            {results.length > 10 && (
              <button
                onClick={() => setShowAllResults((v) => !v)}
                className="text-xs text-primary hover:underline mt-1.5"
              >
                {showAllResults ? "Hide" : `Show all ${results.length}`}
              </button>
            )}
          </>
        )
      case "prompt":
        return (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              System prompt with top-{debug.selected_count} chunks as context
            </div>
            <button
              onClick={() => setShowPrompt((v) => !v)}
              className="text-xs text-primary hover:underline mb-1.5"
            >
              {showPrompt ? "Hide" : "Show"} prompt
            </button>
            {showPrompt && (
              <pre className="text-xs bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100 dark:border-gray-700/50">
                {debug.prompt}
              </pre>
            )}
          </>
        )
      case "answer":
        return (
          <>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Ollama processes prompt and generates response
            </div>
            {answerText && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2.5 text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed border border-gray-100 dark:border-gray-700/50">
                {answerText}
                {answerText.length < (answer?.length || 0) && (
                  <span className="inline-block w-[2px] h-[14px] bg-primary ml-0.5 animate-pulse align-text-bottom" />
                )}
              </div>
            )}
            {answerText.length >= (answer?.length || 0) - 1 && sources?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[...new Set(sources.map((s) => s.doc_name))].map((name) => (
                  <span key={name} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {name.replace(".pdf", "")}
                  </span>
                ))}
              </div>
            )}
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="py-5 px-4">
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          Pipeline
        </h3>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                completedSteps.has(i)
                  ? "bg-primary"
                  : i === activeStep
                    ? "bg-primary/60"
                    : "bg-gray-300 dark:bg-gray-600"
              }`}
            />
          ))}
        </div>
        {debugData?.answer && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(debugData.answer)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
            title="Copy answer"
            aria-label="Copy answer"
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        )}
      </div>

        <div className="relative">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-gray-200 dark:bg-gray-700" />

          {STEPS.map((step, idx) => {
            const isActive = activeStep === idx
            const isCompleted = completedSteps.has(idx)
            const isPending = !isActive && !isCompleted
            if (isPending && !isActive) {
              return (
                <div key={step.id} className="flex gap-4 mb-1">
                  <div className="relative shrink-0 w-6 flex items-start pt-2.5">
                    <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-dark" />
                  </div>
                  <div className="flex-1 min-w-0 pb-2" />
                </div>
              )
            }

            return (
              <div
                key={step.id}
                className={`flex gap-4 mb-1 transition-all duration-500 ${
                  isActive || isCompleted ? "opacity-100" : "opacity-30"
                }`}
              >
                <div className="relative shrink-0 w-6 flex items-start pt-2.5">
                  {isCompleted ? (
                    <div className="w-[22px] h-[22px] rounded-full bg-primary flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : (
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors ${
                      isActive
                        ? "border-primary bg-primary text-white"
                        : "border-gray-300 dark:border-gray-600 text-gray-400"
                    }`}>
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className={`flex-1 min-w-0 pb-4 transition-all duration-300 ${
                  isActive ? "" : ""
                }`}>
                  <div className={`text-xs font-semibold mb-1.5 ${
                    isActive ? "text-primary" : isCompleted ? "text-gray-500 dark:text-gray-400" : "text-gray-400"
                  }`}>
                    {step.label}
                  </div>
                  <div className={`transition-all duration-500 ${
                    isActive || isCompleted ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
                  }`}>
                    {renderStepContent(step.id)}
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
