import { useEffect, useId, useRef, useState } from 'react'

/** Dependency-free responsive line chart. points: [ 'YYYY-MM', value ][] in chronological order. */
export function LineChart({ title, points, unit = 'entries', note, className = '', initialWidth = 0 }: {
  title: string; points: [string, number][]; unit?: string; note?: string; className?: string; initialWidth?: number
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(initialWidth)
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el); setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const n = points.length
  const max = Math.max(0, ...points.map(([, v]) => v))
  const raw = Math.max(max, 1) / 4, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag)
  const top = Math.max(step * 2, Math.ceil(max / step) * step)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)

  const W = Math.max(w, 280), H = W < 520 ? 240 : 300
  const m = { l: 36, r: 18, t: 28, b: 46 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const x = (i: number) => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1))
  const y = (v: number) => m.t + ph * (1 - v / top)

  const monthShort = (k: string) => new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleString('en', { month: 'short' })
  const monthLong = (k: string) => new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
  const line = points.map(([, v], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = n ? `${line} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z` : ''
  const peak = points.reduce((b, p, i) => (p[1] > points[b][1] ? i : b), 0)
  const showValues = W >= 640

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    setHover(Math.min(n - 1, Math.max(0, Math.round(((px - m.l) / pw) * (n - 1)))))
  }

  return (
    <section aria-label={title} className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div ref={wrap} className="relative mt-3 w-full overflow-hidden" style={{ minHeight: H }}>
        {w > 0 && n > 0 && (
          <>
            <svg width={W} height={H} aria-hidden="true" onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-pan-y">
              <defs>
                <linearGradient id={`s${gid}`} gradientUnits="userSpaceOnUse" x1={m.l} x2={W - m.r} y1="0" y2="0">
                  <stop offset="0" style={{ stopColor: 'var(--color-primary)' }} /><stop offset="1" style={{ stopColor: 'var(--color-secondary)' }} />
                </linearGradient>
                <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: 'var(--color-secondary)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} style={{ stroke: 'var(--color-border)' }} />
                  <text x={m.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" style={{ fill: 'var(--color-text-secondary)' }}>{t}</text>
                </g>
              ))}
              <path d={area} fill={`url(#a${gid})`} />
              <path d={line} fill="none" stroke={`url(#s${gid})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
              {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={y(0)} strokeDasharray="4 4" style={{ stroke: 'var(--color-text-secondary)', strokeOpacity: 0.5 }} />}
              {points.map(([k, v], i) => (
                <g key={k}>
                  <circle cx={x(i)} cy={y(v)} r={hover === i ? 6 : 4} strokeWidth="2.5" style={{ fill: 'var(--color-surface)', stroke: 'var(--color-primary)' }} />
                  {showValues && <text x={x(i)} y={y(v) - 12} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: 'var(--color-text-primary)' }}>{v}</text>}
                  <text x={x(i)} y={H - 24} textAnchor="middle" fontSize="11" style={{ fill: 'var(--color-text-secondary)' }}>{monthShort(k)}</text>
                  {(i === 0 || k.endsWith('-01')) && <text x={x(i)} y={H - 9} textAnchor="middle" fontSize="11" fontWeight="600" style={{ fill: 'var(--color-text-secondary)' }}>{k.slice(0, 4)}</text>}
                </g>
              ))}
            </svg>
            {hover !== null && (
              <div role="status" className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line bg-background px-3 py-1.5 text-xs shadow-lg"
                style={{ left: Math.min(Math.max(x(hover), 70), W - 70), top: Math.max(y(points[hover][1]) - 12, 40) }}>
                <span className="text-muted">{monthLong(points[hover][0])}</span> · <span className="font-bold">{points[hover][1]} {unit}</span>
              </div>
            )}
          </>
        )}
      </div>
      {/* Screen-reader version of the same data */}
      <div className="sr-only"><table><caption>{title}</caption><thead><tr><th>Month</th><th>{unit}</th></tr></thead>
        <tbody>{points.map(([k, v]) => <tr key={k}><td>{monthLong(k)}</td><td>{v}</td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-muted">
        {max > 0 ? `Busiest month: ${monthLong(points[peak][0])} (${points[peak][1]} ${unit}). ` : ''}{note}
      </p>
    </section>
  )
}
