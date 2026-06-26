import { useRef, useEffect } from "react"

export default function VectorSpace({ results }) {
  const canvasRef = useRef(null)
  const completedRef = useRef(false)
  const prevKeyRef = useRef("")

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !results?.length) return

    const key = results.map((r) => `${r.score}|${r.doc_name}|${r.chunk_index}`).join("~")
    if (key === prevKeyRef.current && completedRef.current) return
    prevKeyRef.current = key
    completedRef.current = false

    let animId
    const ctx = canvas.getContext("2d")
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)
    const W = rect.width
    const H = rect.height
    const cx = W / 2
    const cy = H / 2

    const maxScore = Math.max(...results.map((r) => r.score), 0.01)
    const minScore = Math.min(...results.map((r) => r.score), 0)
    const range = maxScore - minScore || 1

    const positions = results.map((r, i) => {
      const angle = (i / results.length) * Math.PI * 2 + 0.1
      const normScore = (r.score - minScore) / range
      const radius = Math.max(10, (1 - normScore) * 140)
      const color = i < 3
        ? `hsl(${Math.round(220 - normScore * 40)}, 80%, ${Math.round(50 + normScore * 20)}%)`
        : `hsl(220, 15%, ${Math.round(45 + normScore * 15)}%)`
      return {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        score: r.score,
        label: r.doc_name.replace(".pdf", "").slice(0, 10),
        color,
        normScore,
        isTop: i < 3,
      }
    })

    let startTime = null
    const duration = 2000

    function draw(timestamp) {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const p = Math.min(elapsed / duration, 1)

      ctx.clearRect(0, 0, W, H)

      ctx.fillStyle = "#0B1120"
      ctx.beginPath()
      ctx.roundRect(0, 0, W, H, 8)
      ctx.fill()

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180)
      grad.addColorStop(0, "rgba(79, 70, 229, 0.12)")
      grad.addColorStop(0.5, "rgba(79, 70, 229, 0.04)")
      grad.addColorStop(1, "rgba(79, 70, 229, 0)")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = "rgba(79, 70, 229, 0.08)"
      ctx.lineWidth = 1
      for (let r = 40; r <= 160; r += 40) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.strokeStyle = "rgba(148, 163, 184, 0.06)"
      ctx.lineWidth = 1
      for (let a = 0; a < 6; a++) {
        const angle = (a / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(angle) * 160, cy + Math.sin(angle) * 160)
        ctx.stroke()
      }

      positions.forEach((pos, i) => {
        const appearP = Math.min(1, Math.max(0, (p - i * 0.03) * 3))
        if (appearP <= 0) return
        const size = pos.isTop ? 4 + pos.normScore * 4 : 2 + pos.normScore * 2

        ctx.globalAlpha = appearP * (pos.isTop ? 0.9 : 0.4)
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, size * appearP, 0, Math.PI * 2)
        ctx.fillStyle = pos.color
        ctx.fill()

        if (pos.isTop && appearP > 0.5) {
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, size * 3 * appearP, 0, Math.PI * 2)
          ctx.strokeStyle = pos.color
          ctx.lineWidth = 1
          ctx.globalAlpha = appearP * 0.2
          ctx.stroke()
        }

        if (appearP > 0.9 && pos.isTop) {
          ctx.globalAlpha = 0.6
          ctx.font = "10px 'SF Mono', Monaco, 'Cascadia Code', monospace"
          ctx.fillStyle = "#94A3B8"
          ctx.textAlign = "center"
          ctx.fillText(pos.label, pos.x, pos.y - size - 6)
        }
      })

      ctx.globalAlpha = Math.min(1, p * 2)
      const pulse = 1 + Math.sin(timestamp / 400) * 0.1
      ctx.shadowColor = "rgba(79, 70, 229, 0.5)"
      ctx.shadowBlur = 15 * pulse
      ctx.beginPath()
      ctx.arc(cx, cy, 5 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = "#4F46E5"
      ctx.fill()
      ctx.shadowBlur = 0

      ctx.beginPath()
      ctx.arc(cx, cy, 10 * pulse, 0, Math.PI * 2)
      ctx.strokeStyle = "rgba(79, 70, 229, 0.3)"
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.globalAlpha = 0.5
      ctx.font = "10px 'SF Mono', Monaco, 'Cascadia Code', monospace"
      ctx.fillStyle = "#64748B"
      ctx.textAlign = "center"
      ctx.fillText("QUERY", cx, cy + 20)

      if (p >= 1) {
        completedRef.current = true
      } else {
        animId = requestAnimationFrame(draw)
      }
    }

    animId = requestAnimationFrame(draw)
    return () => { if (animId) cancelAnimationFrame(animId) }
  }, [results])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-52 rounded-lg"
    />
  )
}
