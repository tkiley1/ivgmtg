import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db'
import { playerRatings, profiles } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const players = await getDb().select({
    username: profiles.username,
    displayName: profiles.displayName,
    format: playerRatings.format,
    rating: playerRatings.rating,
    wins: playerRatings.wins,
    losses: playerRatings.losses,
    draws: playerRatings.draws,
  }).from(playerRatings).innerJoin(profiles, eq(playerRatings.userId, profiles.userId)).orderBy(desc(playerRatings.rating)).limit(100)

  return <div className="max-w-4xl mx-auto px-4 py-8"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Leaderboard</p><h1 className="text-3xl font-bold mt-2">Earn your seat at the top.</h1><p className="text-muted mt-2">Ratings are tracked separately for each tournament format.</p></div><div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-muted text-left"><th className="py-3 pr-4">#</th><th className="py-3 pr-4">Player</th><th className="py-3 pr-4">Format</th><th className="py-3 text-right">Rating</th><th className="py-3 text-right">Record</th></tr></thead><tbody>{players.map((player, index) => <tr key={`${player.username}-${player.format}`} className="border-b border-border/50"><td className="py-3 pr-4 font-mono text-muted">{index + 1}</td><td className="py-3 pr-4"><Link href={`/profile/${player.username}`} className="hover:text-accent">{player.displayName} <span className="text-muted">@{player.username}</span></Link></td><td className="py-3 pr-4 capitalize">{player.format}</td><td className="py-3 text-right font-mono font-bold">{player.rating}</td><td className="py-3 text-right font-mono">{player.wins}-{player.losses}-{player.draws}</td></tr>)}</tbody></table>{players.length === 0 && <p className="text-center text-muted py-12">Results will populate the leaderboard after the first completed event.</p>}</div></div>
}
