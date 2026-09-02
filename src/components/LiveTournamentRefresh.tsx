'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function LiveTournamentRefresh({ enabled, intervalMs = 5_000 }: { enabled: boolean; intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const interval = window.setInterval(refreshWhenVisible, intervalMs)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [enabled, intervalMs, router])

  return null
}
