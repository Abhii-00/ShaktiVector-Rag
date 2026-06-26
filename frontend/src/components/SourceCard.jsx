import { memo } from "react"

function SourceCard({ source, onClick }) {
  const score = source.similarity
  const pct = Math.round(Math.abs(score) * 100)
  const barColor =
    pct >= 80 ? "bg-emerald-500" :
    pct >= 60 ? "bg-amber-500" :
    "bg-rose-500"

  const ext = (source.doc_name || "").split(".").pop().toLowerCase()
  const badgeColors = {
    pdf: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-600 dark:text-rose-400", label: "PDF" },
    docx: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400", label: "DOC" },
    txt: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", label: "TXT" },
  }
  const badge = badgeColors[ext] || badgeColors.txt

  return (
    <div
      onClick={() => onClick?.(source)}
      className="border border-gray-100 dark:border-gray-700/50 rounded-xl p-3 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer bg-white dark:bg-gray-800/30"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className={`w-5 h-5 rounded ${badge.bg} flex items-center justify-center text-[8px] font-semibold ${badge.text} shrink-0`}>
            {badge.label}
          </div>
          <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate">{source.doc_name}</span>
          <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0">ch.{source.chunk_index}</span>
        </div>
        <span className="text-xs font-semibold font-mono text-gray-500 dark:text-gray-400 ml-2">{pct}%</span>
      </div>
      <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-1.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">{source.snippet || ""}</p>
    </div>
  )
}

export default memo(SourceCard)
