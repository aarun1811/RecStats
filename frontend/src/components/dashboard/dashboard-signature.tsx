import { useMemo } from 'react'

import { cn } from '@/lib/utils'

interface DashboardSignatureProps {
  /** Dashboard ID — deterministic seed for the signature shape */
  id: string
  className?: string
}

/**
 * Premium ambient hero visual for dashboard cards.
 * Each dashboard gets a unique flowing bezier "signature" shape derived from
 * its ID hash — like album art for a dashboard. Same refined aesthetic across
 * all cards, unique fingerprint per card.
 *
 * Design: single elegant area curve + soft radial ambient + subtle grain.
 * No literal layout preview. Restrained, generous negative space.
 */
export function DashboardSignature({ id, className }: DashboardSignatureProps) {
  const curve = useMemo(() => buildCurve(id), [id])

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden', className)}
    >
      {/* Ambient background — two soft radials for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at ${curve.glowX}% ${curve.glowY}%, hsl(var(--primary) / 0.18), transparent 70%),
            radial-gradient(ellipse 60% 80% at ${100 - curve.glowX}% ${100 - curve.glowY}%, hsl(var(--primary) / 0.08), transparent 65%)
          `,
        }}
      />

      {/* Signature curve — the hero shape */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`sig-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
            <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`sig-stroke-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.75" />
          </linearGradient>
          {/* Soft glow for the curve */}
          <filter id={`sig-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Soft horizontal grid lines — subtle "chart axes" for context */}
        <line x1="0" y1="50" x2="400" y2="50" stroke="hsl(var(--primary))" strokeOpacity="0.06" strokeWidth="1" />
        <line x1="0" y1="100" x2="400" y2="100" stroke="hsl(var(--primary))" strokeOpacity="0.06" strokeWidth="1" />
        <line x1="0" y1="150" x2="400" y2="150" stroke="hsl(var(--primary))" strokeOpacity="0.06" strokeWidth="1" />

        {/* Area fill */}
        <path d={curve.areaPath} fill={`url(#sig-fill-${id})`} />

        {/* Curve glow underlayer — creates soft halo */}
        <path
          d={curve.linePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.4"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#sig-glow-${id})`}
        />

        {/* Curve line — crisp */}
        <path
          d={curve.linePath}
          fill="none"
          stroke={`url(#sig-stroke-${id})`}
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points — visible dots at curve inflection points */}
        {curve.points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth="1.75"
          />
        ))}
      </svg>

      {/* Very subtle grain for premium texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  )
}

interface CurveData {
  linePath: string
  areaPath: string
  points: Array<{ x: number; y: number }>
  glowX: number
  glowY: number
}

/** Deterministic string hash (simple, stable). */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/**
 * Build a smooth bezier curve from an ID hash.
 * Returns 5 anchor points across a 400x200 viewbox — the curve rises from a
 * low-right starting position and generally trends upward (like a positive
 * growth chart) but with unique undulations per dashboard.
 */
function buildCurve(id: string): CurveData {
  const hash = hashString(id)

  // Sample 5 deterministic y-values from the hash. Keep them in the lower 2/3
  // of the viewbox (y: 60-170) so the curve stays readable and generally
  // trending from "higher y" (bottom of chart) toward "lower y" (top).
  const y = [
    140 + ((hash >> 0) & 0xff) % 30,       // 140-170
    120 + ((hash >> 8) & 0xff) % 40,       // 120-160
    90 + ((hash >> 16) & 0xff) % 50,       // 90-140
    70 + ((hash >> 24) & 0xff) % 50,       // 70-120
    50 + (((hash * 31) >>> 0) & 0xff) % 40, // 50-90
  ]

  const x = [20, 110, 200, 290, 380]
  const points = x.map((xv, i) => ({ x: xv, y: y[i] }))

  // Build a smooth SVG path using cubic beziers with control points at the
  // midpoints — creates natural flowing curves without sharp corners.
  const linePath = buildSmoothPath(points)
  // Close the area path back along the bottom
  const areaPath = `${linePath} L ${x[x.length - 1]} 200 L ${x[0]} 200 Z`

  // Ambient glow position — derived from hash for variety
  const glowX = 25 + (((hash >> 4) & 0xff) % 50)
  const glowY = 20 + (((hash >> 12) & 0xff) % 40)

  return { linePath, areaPath, points, glowX, glowY }
}

/**
 * Build a smooth cubic bezier path through a list of points.
 * Uses the Catmull-Rom-to-bezier technique for natural curvature.
 */
function buildSmoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`

  const segments: string[] = [`M ${pts[0].x} ${pts[0].y}`]
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2

    const tension = 0.18
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension

    segments.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`)
  }
  return segments.join(' ')
}
