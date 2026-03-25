'use client'

import Link from 'next/link'

interface Standing {
  user_id: string
  username: string
  first_name?: string | null
  last_name?: string | null
  match_wins: number
  match_losses: number
  match_draws: number
  match_points: number
  game_wins: number
  game_losses: number
  games_drawn: number
  match_win_pct: number
  game_win_pct: number
  opp_match_win_pct: number
  opp_game_win_pct: number
  rank: number
}

function displayName(s: Standing) {
  if (s.first_name && s.last_name) return `${s.first_name} ${s.last_name}`
  if (s.first_name) return s.first_name
  return s.username
}

export function StandingsTable({ standings }: { standings: Standing[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-left">
            <th className="py-2 px-3">#</th>
            <th className="py-2 px-3">Player</th>
            <th className="py-2 px-3">Pts</th>
            <th className="py-2 px-3">Record</th>
            <th className="py-2 px-3">GW%</th>
            <th className="py-2 px-3">OMW%</th>
            <th className="py-2 px-3">OGW%</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s) => (
            <tr key={s.user_id} className="border-b border-border/50 hover:bg-card-hover">
              <td className="py-2 px-3 font-mono">{s.rank}</td>
              <td className="py-2 px-3">
                <Link href={`/profile/${s.username}`} className="text-accent hover:underline">
                  {displayName(s)}
                </Link>
              </td>
              <td className="py-2 px-3 font-bold">{s.match_points}</td>
              <td className="py-2 px-3 font-mono">
                {s.match_wins}-{s.match_losses}-{s.match_draws}
              </td>
              <td className="py-2 px-3 font-mono">{(Number(s.game_win_pct) * 100).toFixed(1)}%</td>
              <td className="py-2 px-3 font-mono">{(Number(s.opp_match_win_pct) * 100).toFixed(1)}%</td>
              <td className="py-2 px-3 font-mono">{(Number(s.opp_game_win_pct) * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
