'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { RoundTimer } from '@/components/RoundTimer'

function playerName(p: any) {
  if (!p) return 'Unknown'
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`
  return p.username
}

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string; matchId: string }>
}) {
  const { id, matchId } = use(params)
  const supabase = createClient()
  const [pairing, setPairing] = useState<any>(null)
  const [round, setRound] = useState<any>(null)
  const [tournament, setTournament] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [myGames, setMyGames] = useState(0)
  const [oppGames, setOppGames] = useState(0)
  const [draws, setDraws] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id ?? null)

    const { data: p } = await supabase
      .from('pairings')
      .select('*, player1:profiles!pairings_player1_id_fkey(username, first_name, last_name, elo_rating), player2:profiles!pairings_player2_id_fkey(username, first_name, last_name, elo_rating)')
      .eq('id', matchId)
      .single()
    setPairing(p)

    if (p) {
      const { data: r } = await supabase.from('rounds').select('*').eq('id', p.round_id).single()
      setRound(r)

      const { data: t } = await supabase.from('tournaments').select('*').eq('id', p.tournament_id).single()
      setTournament(t)
    }
  }

  useEffect(() => {
    load()

    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairings', filter: `id=eq.${matchId}` }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [matchId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { error: err } = await supabase.rpc('submit_match_score', {
      p_pairing_id: matchId,
      p_my_games_won: myGames,
      p_opp_games_won: oppGames,
      p_games_drawn: draws,
    })

    if (err) {
      setError(err.message)
    } else {
      setSuccess('Score submitted! Waiting for opponent confirmation.')
      load()
    }
    setLoading(false)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.rpc('confirm_match_score', { p_pairing_id: matchId })
    if (err) setError(err.message)
    else { setSuccess('Score confirmed!'); load() }
    setLoading(false)
  }

  if (!pairing || !tournament) return <div className="max-w-2xl mx-auto px-4 py-8 text-muted">Loading...</div>

  const isPlayer1 = currentUser === pairing.player1_id
  const isPlayer2 = currentUser === pairing.player2_id
  const myConfirmed = isPlayer1 ? pairing.player1_confirmed : pairing.player2_confirmed
  const oppConfirmed = isPlayer1 ? pairing.player2_confirmed : pairing.player1_confirmed
  const hasAnySubmission = pairing.player1_confirmed || pairing.player2_confirmed

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href={`/tournaments/${id}`} className="text-muted hover:text-foreground text-sm">&larr; Back to Tournament</Link>

      <div className="card mt-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            {round?.is_top_cut ? 'Top Cut' : `Round ${round?.round_number}`}
          </h1>
          <RoundTimer endsAt={round?.ends_at} />
        </div>

        {/* Match Display */}
        <div className="flex items-center justify-center gap-8 mb-8">
          <div className="text-center">
            <div className={`text-2xl font-bold ${pairing.winner_id === pairing.player1_id ? 'text-success' : ''}`}>
              {playerName(pairing.player1)}
            </div>
            <div className="text-sm text-muted">{pairing.player1?.elo_rating} ELO</div>
          </div>
          <div className="text-center">
            {pairing.status === 'completed' ? (
              <div className="text-3xl font-bold font-mono">
                {pairing.player1_games_won} - {pairing.player2_games_won}
                {pairing.games_drawn > 0 && <span className="text-muted text-lg ml-1">({pairing.games_drawn}D)</span>}
              </div>
            ) : (
              <div className="text-3xl font-bold text-muted">vs</div>
            )}
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${pairing.winner_id === pairing.player2_id ? 'text-success' : ''}`}>
              {pairing.is_bye ? 'BYE' : playerName(pairing.player2)}
            </div>
            {!pairing.is_bye && <div className="text-sm text-muted">{pairing.player2?.elo_rating} ELO</div>}
          </div>
        </div>

        {/* Status */}
        {pairing.status === 'completed' && (
          <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-center mb-4">
            Match completed.
            {pairing.is_draw ? ' Result: Draw' : ` Winner: ${pairing.winner_id === pairing.player1_id ? playerName(pairing.player1) : playerName(pairing.player2)}`}
          </div>
        )}

        {/* Confirmation Status */}
        {hasAnySubmission && pairing.status !== 'completed' && (
          <div className="bg-warning/10 border border-warning/30 text-warning rounded-lg p-3 text-sm mb-4">
            Submitted score: {pairing.player1_games_won}-{pairing.player2_games_won}
            {pairing.games_drawn > 0 && ` (${pairing.games_drawn} draws)`}
            <div className="mt-1">
              P1: {pairing.player1_confirmed ? 'Confirmed' : 'Pending'} |
              P2: {pairing.player2_confirmed ? 'Confirmed' : 'Pending'}
            </div>
          </div>
        )}

        {/* Score Input */}
        {(isPlayer1 || isPlayer2) && pairing.status !== 'completed' && !pairing.is_bye && (
          <>
            {!myConfirmed ? (
              <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                {error && <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 text-sm">{error}</div>}
                {success && <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-sm">{success}</div>}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-muted mb-1">My Wins</label>
                    <input type="number" value={myGames} onChange={(e) => setMyGames(Number(e.target.value))} className="input text-center text-xl" min={0} max={tournament.games_per_round} />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Opp Wins</label>
                    <input type="number" value={oppGames} onChange={(e) => setOppGames(Number(e.target.value))} className="input text-center text-xl" min={0} max={tournament.games_per_round} />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Draws</label>
                    <input type="number" value={draws} onChange={(e) => setDraws(Number(e.target.value))} className="input text-center text-xl" min={0} max={tournament.games_per_round} />
                  </div>
                </div>
                <div className="text-xs text-muted">
                  Total must not exceed {tournament.games_per_round} (games per round).
                  Current total: {myGames + oppGames + draws}
                </div>
                <button type="submit" disabled={loading || (myGames + oppGames + draws) > tournament.games_per_round} className="btn-primary w-full justify-center">
                  {loading ? 'Submitting...' : 'Submit Score'}
                </button>
              </form>
            ) : !oppConfirmed ? (
              <div className="text-center py-4 text-muted">
                Waiting for opponent to confirm the score...
              </div>
            ) : null}

            {hasAnySubmission && !myConfirmed && (
              <button onClick={handleConfirm} disabled={loading} className="btn-primary w-full justify-center mt-4">
                {loading ? 'Confirming...' : 'Confirm Score'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
