'use client'

import { useEffect, useState } from 'react'

export function RoundTimer({ endsAt }: { endsAt: string | null }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!endsAt) return

    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      setRemainingMs(diff)
      return diff <= 0
    }

    if (update()) return
    const interval = setInterval(() => {
      if (update()) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [endsAt])

  if (!endsAt) return null

  if (remainingMs === null) return <div className="font-mono text-2xl font-bold text-muted">--:--</div>
  const isUrgent = remainingMs > 0 && remainingMs < 5 * 60 * 1000
  const timeLeft = remainingMs <= 0
    ? 'Time!'
    : `${Math.floor(remainingMs / 60000)}:${Math.floor((remainingMs % 60000) / 1000).toString().padStart(2, '0')}`

  return (
    <div
      className={`font-mono text-2xl font-bold ${
        isUrgent ? 'text-danger animate-pulse' : remainingMs <= 0 ? 'text-danger' : 'text-accent'
      }`}
    >
      {timeLeft}
    </div>
  )
}
