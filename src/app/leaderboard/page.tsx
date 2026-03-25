import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const supabase = await createClient()

  const { data: players } = await supabase
    .from('profiles')
    .select('username, first_name, last_name, avatar_url, elo_rating, total_wins, total_losses, total_draws')
    .order('elo_rating', { ascending: false })
    .limit(100)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Leaderboard</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-left">
              <th className="py-3 px-4 w-16">#</th>
              <th className="py-3 px-4">Player</th>
              <th className="py-3 px-4 text-right">ELO</th>
              <th className="py-3 px-4 text-right">W</th>
              <th className="py-3 px-4 text-right">L</th>
              <th className="py-3 px-4 text-right">D</th>
              <th className="py-3 px-4 text-right">Win%</th>
            </tr>
          </thead>
          <tbody>
            {(players ?? []).map((p, i) => {
              const total = p.total_wins + p.total_losses + p.total_draws
              const winPct = total > 0 ? ((p.total_wins / total) * 100).toFixed(1) : '—'
              return (
                <tr key={p.username} className="border-b border-border/50 hover:bg-card-hover">
                  <td className="py-3 px-4 font-mono text-muted">{i + 1}</td>
                  <td className="py-3 px-4">
                    <Link href={`/profile/${p.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-accent overflow-hidden shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.username} className="w-full h-full object-cover" />
                        ) : (
                          (p.first_name?.[0] ?? p.username[0]).toUpperCase()
                        )}
                      </div>
                      <div>
                        <span className="text-accent font-medium">
                          {p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.username}
                        </span>
                        {p.first_name && <span className="text-muted text-xs ml-1.5">@{p.username}</span>}
                      </div>
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-right font-bold font-mono">{p.elo_rating}</td>
                  <td className="py-3 px-4 text-right font-mono text-success">{p.total_wins}</td>
                  <td className="py-3 px-4 text-right font-mono text-danger">{p.total_losses}</td>
                  <td className="py-3 px-4 text-right font-mono text-warning">{p.total_draws}</td>
                  <td className="py-3 px-4 text-right font-mono">{winPct}{winPct !== '—' && '%'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(!players || players.length === 0) && (
          <div className="text-center py-12 text-muted">No players yet. Register to be the first!</div>
        )}
      </div>
    </div>
  )
}
