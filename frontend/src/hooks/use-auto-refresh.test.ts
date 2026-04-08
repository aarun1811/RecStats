// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useAutoRefresh } from './use-auto-refresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns isActive: false when intervalMs is 0', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(0, onRefresh))

    expect(result.current.isActive).toBe(false)
  })

  it('returns isActive: true when intervalMs > 0', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(60_000, onRefresh))

    expect(result.current.isActive).toBe(true)
  })

  it('returns remainingMs equal to intervalMs initially', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(60_000, onRefresh))

    expect(result.current.remainingMs).toBe(60_000)
  })

  it('returns remainingMs as 0 when intervalMs is 0', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(0, onRefresh))

    expect(result.current.remainingMs).toBe(0)
  })

  it('calls onRefresh after intervalMs elapses', () => {
    const onRefresh = vi.fn()
    renderHook(() => useAutoRefresh(60_000, onRefresh))

    expect(onRefresh).not.toHaveBeenCalled()

    // Advance past the interval
    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('resets remainingMs after refresh fires', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(60_000, onRefresh))

    // Advance past the interval
    act(() => {
      vi.advanceTimersByTime(61_000)
    })

    // remainingMs should have reset to approximately intervalMs
    expect(result.current.remainingMs).toBeGreaterThan(50_000)
  })

  it('decrements remainingMs as time passes', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(60_000, onRefresh))

    act(() => {
      vi.advanceTimersByTime(2_000)
    })

    // Should be roughly 58000ms remaining
    expect(result.current.remainingMs).toBeLessThanOrEqual(59_000)
    expect(result.current.remainingMs).toBeGreaterThan(50_000)
  })

  it('resets countdown when intervalMs changes', () => {
    const onRefresh = vi.fn()
    const { result, rerender } = renderHook(
      ({ interval }) => useAutoRefresh(interval, onRefresh),
      { initialProps: { interval: 60_000 } },
    )

    // Advance some time
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    // Change interval
    rerender({ interval: 300_000 })

    // remainingMs should reset to new interval
    expect(result.current.remainingMs).toBe(300_000)
  })

  it('does not call onRefresh when disabled (intervalMs = 0)', () => {
    const onRefresh = vi.fn()
    renderHook(() => useAutoRefresh(0, onRefresh))

    act(() => {
      vi.advanceTimersByTime(120_000)
    })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('cleans up interval on unmount (no memory leak)', () => {
    const onRefresh = vi.fn()
    const { unmount } = renderHook(() => useAutoRefresh(60_000, onRefresh))

    unmount()

    // After unmount, advancing timers should not call onRefresh
    act(() => {
      vi.advanceTimersByTime(120_000)
    })

    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('reset() restarts the countdown', () => {
    const onRefresh = vi.fn()
    const { result } = renderHook(() => useAutoRefresh(60_000, onRefresh))

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    // Reset the timer
    act(() => {
      result.current.reset()
    })

    // remainingMs should be back to intervalMs
    expect(result.current.remainingMs).toBe(60_000)
  })
})
