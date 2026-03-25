import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { displayStatus, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profileData) notFound()
  const profile = profileData as any

  // Get tournament history
  const { data: participations } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20) as { data: any[] | null }

  // Fetch tournament details for participations
  const tournamentIds = [...new Set((participations ?? []).map(p => p.tournament_id))]
  const { data: tournamentsData } = tournamentIds.length > 0
    ? await supabase.from('tournaments').select('id, name, format, status, created_at').in('id', tournamentIds).neq('status', 'cancelled')
    : { data: [] as any[] }
  const tournamentsMap = new Map((tournamentsData ?? []).map((t: any) => [t.id, t]))

  // Get ELO history
  const { data: eloHistory } = await supabase
    .from('elo_history')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20) as { data: any[] | null }

  // Fetch tournament names for elo history
  const eloTournamentIds = [...new Set((eloHistory ?? []).map(e => e.tournament_id))]
  const { data: eloTournamentsData } = eloTournamentIds.length > 0
    ? await supabase.from('tournaments').select('id, name').in('id', eloTournamentIds)
    : { data: [] as any[] }
  const eloTournamentsMap = new Map((eloTournamentsData ?? []).map((t: any) => [t.id, t]))

  const totalGames = profile.total_wins + profile.total_losses + profile.total_draws
  const winRate = totalGames > 0 ? ((profile.total_wins / totalGames) * 100).toFixed(1) : '0.0'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="card mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-accent overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              profile.username[0].toUpperCase()
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold">
              {profile.first_name && profile.last_name
                ? `${profile.first_name} ${profile.last_name}`
                : profile.username}
            </h1>
            {profile.first_name && <div className="text-sm text-muted">@{profile.username}</div>}
            {profile.bio && <p className="text-muted mt-1 max-w-lg">{profile.bio}</p>}
            <div className="text-sm text-muted mt-1">Member since {new Date(profile.created_at).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'ELO Rating', value: profile.elo_rating, color: 'text-accent' },
          { label: 'Wins', value: profile.total_wins, color: 'text-success' },
          { label: 'Losses', value: profile.total_losses, color: 'text-danger' },
          { label: 'Draws', value: profile.total_draws, color: 'text-warning' },
          { label: 'Win Rate', value: `${winRate}%`, color: 'text-foreground' },
        ].map((stat) => (
          <div key={stat.label} className="card text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ELO History */}
      {eloHistory && eloHistory.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Recent ELO Changes</h2>
          <div className="space-y-2">
            {eloHistory.map((e, i) => {
              const diff = e.elo_after - e.elo_before
              return (
                <div key={i} className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-2 text-sm">
                  <span className="text-muted">{eloTournamentsMap.get(e.tournament_id)?.name ?? 'Unknown'}</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span>{e.elo_before}</span>
                    <span className="text-muted">&rarr;</span>
                    <span>{e.elo_after}</span>
                    <span className={diff >= 0 ? 'text-success' : 'text-danger'}>
                      ({diff >= 0 ? '+' : ''}{diff})
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tournament History */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Tournament History</h2>
        {(!participations || participations.length === 0) ? (
          <div className="text-muted text-center py-4">No tournaments yet.</div>
        ) : (
          <div className="space-y-2">
            {participations.filter((p: any) => tournamentsMap.has(p.tournament_id)).map((p: any) => {
              const t = tournamentsMap.get(p.tournament_id)
              return (
              <Link
                key={p.id}
                href={`/tournaments/${p.tournament_id}`}
                className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-3 hover:bg-card-hover transition-colors"
              >
                <div>
                  <div className="font-bold">{t?.name ?? 'Unknown'}</div>
                  <div className="text-xs text-muted flex gap-2">
                    <span className={`badge badge-${t?.format}`}>{t?.format}</span>
                    <span>{t ? new Date(t.created_at).toLocaleDateString() : ''}</span>
                  </div>
                </div>
                <div className="text-right">
                  {p.final_standing ? (
                    <div className="font-bold text-accent">#{p.final_standing}</div>
                  ) : (
                    <span className={`badge ${statusBadgeClass(p.status)}`}>{displayStatus(p.status)}</span>
                  )}
                </div>
              </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
