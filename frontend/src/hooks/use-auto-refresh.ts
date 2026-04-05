import { useCallback, useEffect, useRef, useState } from 'react'

interface UseAutoRefreshReturn {
  /** Milliseconds remaining until next refresh. */
  remainingMs: number
  /** Whether auto-refresh is active (intervalMs > 0). */
  isActive: boolean
  /** Force a reset of the countdown timer. */
  reset: () => void
}

/**
 * Auto-refresh timer hook.
 * Calls `onRefresh` at the specified interval.
 * Uses timestamp-based countdown to avoid timer drift (per research Pitfall 7).
 *
 * @param intervalMs Refresh interval in milliseconds. 0 = disabled.
 * @param onRefresh Callback invoked when the timer fires.
 */
export function useAutoRefresh(
  intervalMs: number,
  onRefresh: () => void,
): UseAutoRefreshReturn {
  const [remainingMs, setRemainingMs] = useState(intervalMs)
  const nextRefreshAtRef = useRef(Date.now() + intervalMs)
  const onRefreshRef = useRef(onRefresh)

  // Keep onRefresh ref stable to avoid re-starting the interval
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  // Reset when interval changes
  useEffect(() => {
    nextRefreshAtRef.current = Date.now() + intervalMs
    setRemainingMs(intervalMs)
  }, [intervalMs])

  // Countdown tick (every 1 second)
  useEffect(() => {
    if (intervalMs <= 0) return

    const tick = () => {
      const now = Date.now()
      const remaining = nextRefreshAtRef.current - now

      if (remaining <= 0) {
        // Fire refresh
        onRefreshRef.current()
        // Reset for next cycle
        nextRefreshAtRef.current = now + intervalMs
        setRemainingMs(intervalMs)
      } else {
        setRemainingMs(remaining)
      }
    }

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [intervalMs])

  const reset = useCallback(() => {
    nextRefreshAtRef.current = Date.now() + intervalMs
    setRemainingMs(intervalMs)
  }, [intervalMs])

  return {
    remainingMs: intervalMs <= 0 ? 0 : remainingMs,
    isActive: intervalMs > 0,
    reset,
  }
}
