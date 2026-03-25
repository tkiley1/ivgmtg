'use client'

import { useEffect, useState } from 'react'

export function RoundTimer({ endsAt }: { endsAt: string | null }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    if (!endsAt) return

    const update = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Time!')
        return
      }
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endsAt])

  if (!endsAt) return null

  const diff = new Date(endsAt).getTime() - Date.now()
  const isUrgent = diff > 0 && diff < 5 * 60 * 1000

  return (
    <div
      className={`font-mono text-2xl font-bold ${
        isUrgent ? 'text-danger animate-pulse' : diff <= 0 ? 'text-danger' : 'text-accent'
      }`}
    >
      {timeLeft}
    </div>
  )
}
