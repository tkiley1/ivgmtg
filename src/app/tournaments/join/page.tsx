'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function JoinTournamentPage() {
  const [accessKey, setAccessKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data, error: err } = await supabase.rpc('join_tournament_by_key', {
      p_access_key: accessKey.trim().toUpperCase(),
    })

    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      router.push(`/tournaments/${data}`)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <h1 className="text-3xl font-bold mb-8 text-center">Join Tournament</h1>

      <form onSubmit={handleJoin} className="space-y-4">
        {error && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm text-muted mb-1">Access Key</label>
          <input
            type="text"
            value={accessKey}
            onChange={(e) => setAccessKey(e.target.value)}
            className="input text-center font-mono text-lg tracking-wider"
            placeholder="ABCD1234"
            required
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Joining...' : 'Join Tournament'}
        </button>
      </form>
    </div>
  )
}
