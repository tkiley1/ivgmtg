'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ManageTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const [tournament, setTournament] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [pairings, setPairings] = useState<any[]>([])
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editFormat, setEditFormat] = useState('commander')
  const [editRounds, setEditRounds] = useState(4)
  const [editGames, setEditGames] = useState(3)
  const [editTime, setEditTime] = useState(50)
  const [editTopCut, setEditTopCut] = useState<number | null>(null)
  const [editPublic, setEditPublic] = useState(false)
  const [commanderGames, setCommanderGames] = useState<any[]>([])
  const [selectedWinner, setSelectedWinner] = useState('')

  const load = async () => {
    const { data: t } = await supabase.from('tournaments').select('*').eq('id', id).single()
    setTournament(t)
    if (t) {
      setEditName(t.name)
      setEditDesc(t.description ?? '')
      setEditFormat(t.format)
      setEditRounds(t.rounds_count)
      setEditGames(t.games_per_round)
      setEditTime(t.round_time_limit_minutes)
      setEditTopCut(t.top_cut)
      setEditPublic(t.is_public)
    }

    const { data: parts } = await supabase
      .from('tournament_participants')
      .select('*, profiles(username, elo_rating)')
      .eq('tournament_id', id)
    setParticipants(parts ?? [])

    // Load commander games
    if (t && t.format === 'commander') {
      const { data: cg } = await supabase
        .from('commander_games')
        .select('*, winner:profiles!commander_games_winner_id_fkey(username, first_name, last_name)')
        .eq('tournament_id', id)
        .order('game_number', { ascending: true })
      setCommanderGames(cg ?? [])
    }

    const { data: pairs } = await supabase
      .from('pairings')
      .select('*, player1:profiles!pairings_player1_id_fkey(username), player2:profiles!pairings_player2_id_fkey(username)')
      .eq('tournament_id', id)
    setPairings(pairs ?? [])
  }

  useEffect(() => { load() }, [id])

  // Poll for updates during active rounds
  useEffect(() => {
    if (tournament?.status !== 'round_active') return
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [tournament?.status])

  // Auto-start next round when all matches complete and more rounds remain
  useEffect(() => {
    if (
      tournament?.status === 'between_rounds' &&
      tournament.current_round < tournament.rounds_count &&
      !loading
    ) {
      callAction('start_next_round')
    }
  }, [tournament?.status, tournament?.current_round])

  const callAction = async (action: string) => {
    setLoading(action)
    setError('')
    setSuccess('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Not logged in'); setLoading(''); return }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pairings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tournament_id: id, action }),
      }
    )

    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Something went wrong')
    } else {
      setSuccess(`${action.replace(/_/g, ' ')} completed successfully`)
      load()
    }
    setLoading('')
  }

  const handleOverride = async (pairingId: string, p1: number, p2: number, drawn: number) => {
    setError('')
    const { error: err } = await (supabase.rpc as any)('admin_override_score', {
      p_pairing_id: pairingId,
      p_player1_games: p1,
      p_player2_games: p2,
      p_games_drawn: drawn,
    })
    if (err) setError(err.message)
    else load()
  }

  const handleRecordCommanderWin = async () => {
    if (!selectedWinner) return
    setError('')
    setSuccess('')

    const nextGameNumber = commanderGames.length + 1
    const { error: err } = await supabase
      .from('commander_games')
      .insert({
        tournament_id: id,
        game_number: nextGameNumber,
        winner_id: selectedWinner,
      })

    if (err) {
      setError(err.message)
    } else {
      setSelectedWinner('')
      setSuccess(`Game ${nextGameNumber} winner recorded!`)
      load()
    }
  }

  const handleUndoLastGame = async () => {
    if (commanderGames.length === 0) return
    const lastGame = commanderGames[commanderGames.length - 1]
    await supabase.from('commander_games').delete().eq('id', lastGame.id)
    load()
  }

  const handleRemovePlayer = async (userId: string, username: string) => {
    if (!confirm(`Remove ${username} from this tournament?`)) return
    setError('')

    if (tournament.status === 'pending') {
      // Before tournament starts, fully delete the participant
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', id)
        .eq('user_id', userId)
    } else {
      // During tournament, mark as dropped
      await supabase
        .from('tournament_participants')
        .update({ status: 'dropped' })
        .eq('tournament_id', id)
        .eq('user_id', userId)
    }
    load()
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this tournament? This cannot be undone.')) return
    setLoading('cancel')
    setError('')
    const { error: err } = await supabase
      .from('tournaments')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (err) setError(err.message)
    else { setSuccess('Tournament cancelled.'); load() }
    setLoading('')
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading('save_settings')
    setError('')
    setSuccess('')

    const { error: err } = await supabase
      .from('tournaments')
      .update({
        name: editName,
        description: editDesc || null,
        format: editFormat,
        rounds_count: editRounds,
        games_per_round: editGames,
        round_time_limit_minutes: editTime,
        top_cut: editTopCut,
        is_public: editPublic,
      })
      .eq('id', id)

    if (err) setError(err.message)
    else { setSuccess('Settings saved!'); load() }
    setLoading('')
  }

  if (!tournament) return <div className="max-w-7xl mx-auto px-4 py-8 text-muted">Loading...</div>

  const activePairings = pairings.filter(p => p.status !== 'completed')

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/tournaments/${id}`} className="text-muted hover:text-foreground">&larr; Back</Link>
        <h1 className="text-3xl font-bold">Manage: {tournament.name}</h1>
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm mb-4">{error}</div>}
      {success && <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm mb-4">{success}</div>}

      {/* Actions */}
      <div className="card mb-8">
        <h2 className="text-xl font-bold mb-4">Tournament Actions</h2>
        <div className="flex flex-wrap gap-3">
          {tournament.status === 'pending' && (
            <button
              onClick={() => callAction('start_tournament')}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === 'start_tournament' ? 'Starting...' : 'Start Tournament'}
            </button>
          )}

          {tournament.status === 'round_active' && (
            <button
              onClick={() => callAction('end_current_round')}
              disabled={!!loading}
              className="btn-danger"
            >
              {loading === 'end_current_round' ? 'Ending...' : 'End Current Round'}
            </button>
          )}

          {tournament.status === 'between_rounds' && tournament.current_round < tournament.rounds_count && (
            <button
              onClick={() => callAction('start_next_round')}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === 'start_next_round' ? 'Starting...' : `Start Round ${tournament.current_round + 1}`}
            </button>
          )}

          {tournament.status === 'between_rounds' && tournament.current_round >= tournament.rounds_count && tournament.top_cut && (
            <button
              onClick={() => callAction('start_top_cut')}
              disabled={!!loading}
              className="btn-primary"
            >
              {loading === 'start_top_cut' ? 'Starting...' : 'Start Top Cut'}
            </button>
          )}

          {tournament.status !== 'completed' && tournament.status !== 'cancelled' && (
            <button
              onClick={handleCancel}
              disabled={!!loading}
              className="btn-danger"
            >
              Cancel Tournament
            </button>
          )}
        </div>

        <div className="mt-4 text-sm text-muted">
          Status: <span className="font-bold text-foreground">{tournament.status}</span> |
          {tournament.format !== 'commander' && <>Round: <span className="font-bold text-foreground">{tournament.current_round}/{tournament.rounds_count}</span> |</>}
          {tournament.format === 'commander' && <>Games: <span className="font-bold text-foreground">{commanderGames.length}/{tournament.games_per_round}</span> |</>}
          Players: <span className="font-bold text-foreground">{participants.filter(p => p.status !== 'dropped').length}</span>
        </div>
      </div>

      {/* Commander: Record Game Winners */}
      {tournament.format === 'commander' && tournament.status === 'round_active' && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Record Game Winner</h2>
          <p className="text-sm text-muted mb-4">
            Game {commanderGames.length + 1} of {tournament.games_per_round}
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm text-muted mb-1">Winner</label>
              <select value={selectedWinner} onChange={e => setSelectedWinner(e.target.value)} className="input">
                <option value="">Select winner...</option>
                {participants.filter(p => p.status !== 'dropped').map((p: any) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.profiles?.first_name && p.profiles?.last_name
                      ? `${p.profiles.first_name} ${p.profiles.last_name} (${p.profiles.username})`
                      : p.profiles?.username}
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleRecordCommanderWin} disabled={!selectedWinner} className="btn-primary">
              Record Win
            </button>
            {commanderGames.length > 0 && (
              <button onClick={handleUndoLastGame} className="btn-secondary">
                Undo Last
              </button>
            )}
          </div>

          {/* Game history */}
          {commanderGames.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Game History</h3>
              <div className="space-y-1">
                {commanderGames.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2 text-sm">
                    <span className="text-muted">Game {g.game_number}</span>
                    <span className="text-success font-bold">
                      {g.winner?.first_name && g.winner?.last_name
                        ? `${g.winner.first_name} ${g.winner.last_name}`
                        : g.winner?.username ?? 'Unknown'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {commanderGames.length >= tournament.games_per_round && (
            <div className="bg-accent/10 border border-accent/30 text-accent rounded-lg p-3 text-center mt-4">
              All {tournament.games_per_round} games recorded. You can end the tournament.
            </div>
          )}
        </div>
      )}

      {/* Edit Settings (only when pending) */}
      {tournament.status === 'pending' && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Tournament Settings</h2>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="input" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-muted mb-1">Format</label>
                <select value={editFormat} onChange={e => setEditFormat(e.target.value)} className="input">
                  <option value="commander">Commander</option>
                  <option value="draft">Draft</option>
                  <option value="sealed">Sealed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Rounds</label>
                <input type="number" value={editRounds} onChange={e => setEditRounds(Number(e.target.value))} className="input" min={1} max={20} />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Best of</label>
                <input type="number" value={editGames} onChange={e => setEditGames(Number(e.target.value))} className="input" min={1} max={7} />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Time Limit (min)</label>
                <input type="number" value={editTime} onChange={e => setEditTime(Number(e.target.value))} className="input" min={10} max={180} />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Top Cut</label>
                <input type="number" value={editTopCut ?? ''} onChange={e => setEditTopCut(e.target.value ? Number(e.target.value) : null)} className="input" min={2} max={64} placeholder="None" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <span className="text-sm">Public</span>
                </label>
              </div>
            </div>
            <button type="submit" disabled={loading === 'save_settings'} className="btn-primary">
              {loading === 'save_settings' ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* Active Matches (for override) - non-commander only */}
      {tournament.format !== 'commander' && activePairings.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Active Matches ({activePairings.length})</h2>
          <div className="space-y-3">
            {activePairings.map((p: any) => (
              <div key={p.id} className="bg-background/50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span>{p.player1?.username} vs {p.is_bye ? 'BYE' : p.player2?.username}</span>
                  <div className="flex items-center gap-2">
                    {p.player1_confirmed && <span className="text-xs text-success">P1 confirmed</span>}
                    {p.player2_confirmed && <span className="text-xs text-success">P2 confirmed</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">Override:</span>
                  {[
                    { label: '2-0', p1: 2, p2: 0, d: 0 },
                    { label: '2-1', p1: 2, p2: 1, d: 0 },
                    { label: '1-1-1', p1: 1, p2: 1, d: 1 },
                    { label: '0-2', p1: 0, p2: 2, d: 0 },
                    { label: '1-2', p1: 1, p2: 2, d: 0 },
                  ].map(s => (
                    <button
                      key={s.label}
                      onClick={() => handleOverride(p.id, s.p1, s.p2, s.d)}
                      className="btn-secondary text-xs px-2 py-1"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Participants</h2>
        <div className="space-y-1">
          {participants.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2 text-sm">
              <span className={p.status === 'dropped' ? 'line-through text-muted' : ''}>
                {p.profiles?.first_name && p.profiles?.last_name
                  ? `${p.profiles.first_name} ${p.profiles.last_name} (${p.profiles.username})`
                  : p.profiles?.username}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-muted">{p.seed_elo} ELO</span>
                <span className={`badge badge-${p.status === 'dropped' ? 'danger' : 'active'}`}>{p.status}</span>
                {p.status !== 'dropped' && (
                  <button
                    onClick={() => handleRemovePlayer(p.user_id, p.profiles?.username)}
                    className="text-xs text-danger hover:text-danger/80 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
