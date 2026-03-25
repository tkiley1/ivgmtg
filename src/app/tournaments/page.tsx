import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { displayStatus, statusBadgeClass } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function TournamentsPage() {
  const supabase = await createClient()

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_public', true)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(50) as { data: any[] | null }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Browse Tournaments</h1>
        <Link href="/tournaments/create" className="btn-primary">Create Tournament</Link>
      </div>

      {(!tournaments || tournaments.length === 0) ? (
        <div className="card text-center py-12 text-muted">No public tournaments found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`} className="card hover:border-accent transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className={`badge badge-${t.format}`}>{t.format}</span>
                <span className={`badge ${statusBadgeClass(t.status)}`}>{displayStatus(t.status)}</span>
              </div>
              <h3 className="text-lg font-bold mb-1">{t.name}</h3>
              {t.description && <p className="text-sm text-muted mb-2 line-clamp-2">{t.description}</p>}
              <div className="text-xs text-muted flex gap-4 mt-3">
                <span>{t.rounds_count} rounds</span>
                <span>Best of {t.games_per_round}</span>
                {t.top_cut && <span>Top {t.top_cut} cut</span>}
              </div>
              <div className="text-xs text-muted mt-1">
                {new Date(t.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
