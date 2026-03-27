'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function CreateTournamentPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState('commander')
  const [roundsCount, setRoundsCount] = useState(4)
  const [gamesPerRound, setGamesPerRound] = useState(3)
  const [timeLimit, setTimeLimit] = useState(50)
  const [topCut, setTopCut] = useState<number | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const isCommander = format === 'commander'

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat)
    if (newFormat === 'commander') {
      setRoundsCount(1)
      setTopCut(null)
      setTimeLimit(50)
    } else {
      if (roundsCount === 1) setRoundsCount(4)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('create_tournament', {
      p_name: name,
      p_description: description || undefined,
      p_format: format,
      p_rounds_count: isCommander ? 1 : roundsCount,
      p_games_per_round: gamesPerRound,
      p_round_time_limit: isCommander ? 999 : timeLimit,
      p_top_cut: isCommander ? undefined : (topCut ?? undefined),
      p_is_public: isPublic,
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      if (scheduledDate && data) {
        const dt = scheduledTime
          ? new Date(`${scheduledDate}T${scheduledTime}`)
          : new Date(`${scheduledDate}T00:00`)
        await supabase
          .from('tournaments')
          .update({ scheduled_at: dt.toISOString() })
          .eq('id', data)
      }
      router.push(`/tournaments/${data}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create Tournament</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1">Tournament Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={3} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Format</label>
            <select value={format} onChange={(e) => handleFormatChange(e.target.value)} className="input">
              <option value="commander">Commander</option>
              <option value="draft">Draft</option>
              <option value="sealed">Sealed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-muted mb-1">Best of</label>
            <input type="number" value={gamesPerRound} onChange={(e) => setGamesPerRound(Number(e.target.value))} className="input" min={1} max={7} step={2} required />
          </div>

          {!isCommander && (
            <>
              <div>
                <label className="block text-sm text-muted mb-1">Number of Rounds</label>
                <input type="number" value={roundsCount} onChange={(e) => setRoundsCount(Number(e.target.value))} className="input" min={1} max={20} required />
              </div>

              <div>
                <label className="block text-sm text-muted mb-1">Time Limit (minutes)</label>
                <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className="input" min={10} max={180} required />
              </div>
            </>
          )}
        </div>

        {isCommander && (
          <p className="text-sm text-muted -mt-2">
            Commander tournaments are single-round with random pairings.
          </p>
        )}

        {!isCommander && (
          <div>
            <label className="block text-sm text-muted mb-1">Top Cut (leave empty for none)</label>
            <input
              type="number"
              value={topCut ?? ''}
              onChange={(e) => setTopCut(e.target.value ? Number(e.target.value) : null)}
              className="input"
              min={2}
              max={64}
              placeholder="e.g., 8"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Date (optional)</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Time (optional)</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isPublic"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="w-4 h-4 accent-primary"
          />
          <label htmlFor="isPublic" className="text-sm">Make this tournament public (visible on browse page)</label>
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Creating...' : 'Create Tournament'}
        </button>
      </form>
    </div>
  )
}
