import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(20) as { data: any[] | null }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-accent">IVGMTG</span>
        </h1>
        <p className="text-xl text-muted max-w-2xl mx-auto">
          Magic: The Gathering Tournament Platform. Create tournaments, track standings, and compete.
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link href="/tournaments/create" className="btn-primary">
            Create Tournament
          </Link>
          <Link href="/tournaments/join" className="btn-secondary">
            Join Tournament
          </Link>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-6">Public Tournaments</h2>

      {(!tournaments || tournaments.length === 0) ? (
        <div className="card text-center py-12 text-muted">
          No public tournaments yet. Be the first to create one!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`} className="card hover:border-accent transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className={`badge badge-${t.format}`}>{t.format}</span>
                <span className={`badge badge-${t.status}`}>{t.status}</span>
              </div>
              <h3 className="text-lg font-bold mb-1">{t.name}</h3>
              {t.description && (
                <p className="text-sm text-muted mb-2 line-clamp-2">{t.description}</p>
              )}
              <div className="text-xs text-muted flex gap-4 mt-3">
                <span>{t.rounds_count} rounds</span>
                <span>Best of {t.games_per_round}</span>
                {t.top_cut && <span>Top {t.top_cut} cut</span>}
              </div>
              <div className="text-xs text-muted mt-1">
                {t.scheduled_at
                  ? new Date(t.scheduled_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                  : new Date(t.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
