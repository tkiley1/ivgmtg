'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StandingsTable } from '@/components/StandingsTable'
import { RoundTimer } from '@/components/RoundTimer'
import Link from 'next/link'
import { displayStatus, statusBadgeClass } from '@/lib/utils'

function playerName(p: any) {
  if (!p) return 'Unknown'
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`
  return p.username
}

export default function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const [tournament, setTournament] = useState<any>(null)
  const [participants, setParticipants] = useState<any[]>([])
  const [rounds, setRounds] = useState<any[]>([])
  const [pairings, setPairings] = useState<any[]>([])
  const [standings, setStandings] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [commanderGames, setCommanderGames] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [isParticipant, setIsParticipant] = useState(false)
  const [joining, setJoining] = useState(false)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id ?? null)

    const { data: t } = await supabase.from('tournaments').select('*').eq('id', id).single()
    setTournament(t)

    const { data: parts } = await supabase
      .from('tournament_participants')
      .select('*, profiles(username, elo_rating, first_name, last_name)')
      .eq('tournament_id', id)
    setParticipants(parts ?? [])

    const { data: rnds } = await supabase
      .from('rounds')
      .select('*')
      .eq('tournament_id', id)
      .order('round_number', { ascending: true })
    setRounds(rnds ?? [])

    const { data: pairs } = await supabase
      .from('pairings')
      .select('*, player1:profiles!pairings_player1_id_fkey(username, first_name, last_name), player2:profiles!pairings_player2_id_fkey(username, first_name, last_name)')
      .eq('tournament_id', id)
      .order('created_at', { ascending: true })
    setPairings(pairs ?? [])

    if (t && t.status !== 'pending') {
      const { data: s } = await supabase.rpc('calculate_standings', { t_id: id })
      setStandings(s ?? [])
    }

    // Load commander games
    if (t && t.format === 'commander') {
      const { data: cg } = await supabase
        .from('commander_games')
        .select('*, winner:profiles!commander_games_winner_id_fkey(username, first_name, last_name)')
        .eq('tournament_id', id)
        .order('game_number', { ascending: true })
      setCommanderGames(cg ?? [])
    }

    if (user) {
      const { data: admin } = await supabase
        .from('tournament_admins')
        .select('id')
        .eq('tournament_id', id)
        .eq('user_id', user.id)
        .single()
      setIsAdmin(!!admin)

      const p = (parts ?? []).find((p: any) => p.user_id === user.id)
      setIsParticipant(!!p && p.status !== 'dropped')
    }
  }

  useEffect(() => {
    load()

    // Realtime subscriptions
    const channel = supabase
      .channel(`tournament-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pairings', filter: `tournament_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `tournament_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commander_games', filter: `tournament_id=eq.${id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${id}` }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  const handleJoin = async () => {
    setJoining(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }

    const { data: profile } = await supabase.from('profiles').select('elo_rating').eq('id', user.id).single()
    await supabase.from('tournament_participants').insert({
      tournament_id: id,
      user_id: user.id,
      seed_elo: profile?.elo_rating ?? 1200,
    })
    setJoining(false)
    load()
  }

  const handleDrop = async () => {
    if (!confirm('Are you sure you want to drop from this tournament?')) return
    await supabase.rpc('drop_from_tournament', { p_tournament_id: id })
    load()
  }

  if (!tournament) return <div className="max-w-7xl mx-auto px-4 py-8 text-muted">Loading...</div>

  const activeRound = rounds.find(r => r.status === 'active')
  const currentRoundPairings = activeRound
    ? pairings.filter(p => p.round_id === activeRound.id)
    : []

  const myMatch = currentRoundPairings.find(
    p => p.player1_id === currentUser || p.player2_id === currentUser
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold">{tournament.name}</h1>
            <span className={`badge badge-${tournament.format}`}>{tournament.format}</span>
            <span className={`badge ${statusBadgeClass(tournament.status)}`}>{displayStatus(tournament.status)}</span>
          </div>
          {tournament.description && <p className="text-muted">{tournament.description}</p>}
          <div className="text-sm text-muted mt-2 flex gap-4">
            {tournament.format !== 'commander' && <span>{tournament.rounds_count} rounds</span>}
            <span>{tournament.format === 'commander' ? `${tournament.games_per_round} games` : `Best of ${tournament.games_per_round}`}</span>
            {tournament.format !== 'commander' && <span>{tournament.round_time_limit_minutes} min/round</span>}
            {tournament.top_cut && <span>Top {tournament.top_cut} cut</span>}
            <span>{participants.filter((p: any) => p.status !== 'dropped').length} players</span>
          </div>
          {tournament.access_key && isAdmin && (
            <div className="text-sm text-muted mt-1">
              Access Key: <span className="font-mono text-accent">{tournament.access_key}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link href={`/tournaments/${id}/manage`} className="btn-primary">Manage</Link>
          )}
          {!isParticipant && tournament.status === 'pending' && (
            <button onClick={handleJoin} disabled={joining} className="btn-primary">
              {joining ? 'Joining...' : 'Join Tournament'}
            </button>
          )}
          {isParticipant && tournament.status !== 'completed' && (
            <button onClick={handleDrop} className="btn-danger">Drop</button>
          )}
        </div>
      </div>

      {/* Commander View */}
      {tournament.format === 'commander' && tournament.status !== 'pending' && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">
            Games ({commanderGames.length} / {tournament.games_per_round})
          </h2>

          {/* Commander Leaderboard */}
          {(() => {
            const activeParts = participants.filter((p: any) => p.status !== 'dropped')
            const winCounts = new Map<string, number>()
            activeParts.forEach((p: any) => winCounts.set(p.user_id, 0))
            commanderGames.forEach((g: any) => {
              if (g.winner_id) winCounts.set(g.winner_id, (winCounts.get(g.winner_id) ?? 0) + 1)
            })
            const sorted = activeParts
              .map((p: any) => ({ ...p, wins: winCounts.get(p.user_id) ?? 0 }))
              .sort((a: any, b: any) => b.wins - a.wins)

            return (
              <div className="mb-6">
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Standings</h3>
                <div className="space-y-1">
                  {sorted.map((p: any, i: number) => (
                    <div key={p.user_id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-3">
                        <span className="text-muted font-mono w-6">{i + 1}</span>
                        <Link href={`/profile/${p.profiles?.username}`} className="text-accent hover:underline">
                          {p.profiles?.first_name && p.profiles?.last_name
                            ? `${p.profiles.first_name} ${p.profiles.last_name}`
                            : p.profiles?.username}
                        </Link>
                      </div>
                      <span className="font-bold font-mono">{p.wins} {p.wins === 1 ? 'win' : 'wins'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Game Log */}
          {commanderGames.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Game Log</h3>
              <div className="space-y-1">
                {commanderGames.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2 text-sm">
                    <span className="text-muted">Game {g.game_number}</span>
                    <span className="text-success font-bold">
                      {g.winner ? playerName(g.winner) : 'No winner recorded'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tournament.status === 'completed' && (
            <div className="bg-success/10 border border-success/30 text-success rounded-lg p-3 text-center mt-4">
              Tournament completed!
            </div>
          )}
        </div>
      )}

      {/* Active Round (non-commander) */}
      {tournament.format !== 'commander' && activeRound && (
        <div className="card mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              {activeRound.is_top_cut ? 'Top Cut' : `Round ${activeRound.round_number}`}
            </h2>
            <RoundTimer endsAt={activeRound.ends_at} />
          </div>

          {myMatch && (
            <Link
              href={`/tournaments/${id}/match/${myMatch.id}`}
              className="block bg-primary/10 border border-primary/30 rounded-lg p-4 mb-4 hover:bg-primary/20 transition-colors"
            >
              <div className="text-sm text-muted mb-1">Your Match</div>
              <div className="text-lg font-bold">
                {playerName(myMatch.player1)} vs {myMatch.is_bye ? 'BYE' : playerName(myMatch.player2)}
              </div>
              {myMatch.status === 'completed' ? (
                <div className="text-sm text-success mt-1">
                  {myMatch.player1_games_won} - {myMatch.player2_games_won}
                  {myMatch.games_drawn > 0 && ` (${myMatch.games_drawn} draws)`}
                </div>
              ) : (
                <div className="text-sm text-accent mt-1">Click to report score</div>
              )}
            </Link>
          )}

          <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">Pairings</h3>
          <div className="space-y-2">
            {currentRoundPairings.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={p.winner_id === p.player1_id ? 'font-bold text-success' : ''}>
                    {playerName(p.player1)}
                  </span>
                  <span className="text-muted">vs</span>
                  <span className={p.winner_id === p.player2_id ? 'font-bold text-success' : ''}>
                    {p.is_bye ? 'BYE' : playerName(p.player2)}
                  </span>
                </div>
                <div className="text-sm font-mono">
                  {p.status === 'completed' ? (
                    <span className="text-success">
                      {p.player1_games_won}-{p.player2_games_won}
                      {p.games_drawn > 0 && `-${p.games_drawn}`}
                    </span>
                  ) : (
                    <span className="text-muted">pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standings (non-commander) */}
      {tournament.format !== 'commander' && standings.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Standings</h2>
          <StandingsTable standings={standings} />
        </div>
      )}

      {/* Participants (pending tournaments) */}
      {tournament.status === 'pending' && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">
            Registered Players ({participants.filter((p: any) => p.status !== 'dropped').length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {participants
              .filter((p: any) => p.status !== 'dropped')
              .map((p: any) => (
                <Link
                  key={p.id}
                  href={`/profile/${p.profiles?.username}`}
                  className="bg-background/50 rounded-lg px-3 py-2 text-sm hover:bg-card-hover"
                >
                  <span className="text-accent">{p.profiles?.username}</span>
                  <span className="text-muted ml-2">{p.seed_elo} ELO</span>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Round History */}
      {rounds.filter(r => r.status === 'completed').length > 0 && (
        <div className="card mt-8">
          <h2 className="text-xl font-bold mb-4">Round History</h2>
          {rounds.filter(r => r.status === 'completed').map(r => {
            const roundPairings = pairings.filter(p => p.round_id === r.id)
            return (
              <div key={r.id} className="mb-6 last:mb-0">
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-2">
                  {r.is_top_cut ? 'Top Cut' : `Round ${r.round_number}`}
                </h3>
                <div className="space-y-1">
                  {roundPairings.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2 text-sm">
                      <div>
                        <span className={p.winner_id === p.player1_id ? 'font-bold text-success' : ''}>{p.player1?.username}</span>
                        <span className="text-muted mx-2">vs</span>
                        <span className={p.winner_id === p.player2_id ? 'font-bold text-success' : ''}>{p.is_bye ? 'BYE' : p.player2?.username}</span>
                      </div>
                      <span className="font-mono">{p.player1_games_won}-{p.player2_games_won}{p.games_drawn > 0 && `-${p.games_drawn}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
