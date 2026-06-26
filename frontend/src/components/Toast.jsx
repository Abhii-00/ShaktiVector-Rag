import { useEffect, memo } from "react"

function Toast({ message, type = "success", onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  const isSuccess = type === "success"

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-down">
      <div className={`px-4 py-2.5 rounded-xl shadow-lg text-sm flex items-center gap-2.5 backdrop-blur-sm ${
        isSuccess
          ? "bg-emerald-600/95 text-white"
          : "bg-rose-600/95 text-white"
      }`}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/20">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isSuccess
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            }
          </svg>
        </div>
        <span className="font-medium">{message}</span>
      </div>
    </div>
  )
}

export default memo(Toast)
