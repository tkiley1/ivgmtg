'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { displayStatus, statusBadgeClass } from '@/lib/utils'

export default function MyTournamentsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [participating, setParticipating] = useState<any[]>([])
  const [managing, setManaging] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'playing' | 'managing'>('playing')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: parts } = await supabase
        .from('tournament_participants')
        .select('tournament_id, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const partIds = (parts ?? []).map(p => p.tournament_id)
      if (partIds.length > 0) {
        const { data: tList } = await supabase
          .from('tournaments')
          .select('*')
          .in('id', partIds)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
        const statusMap = new Map((parts ?? []).map(p => [p.tournament_id, p.status]))
        setParticipating((tList ?? []).map(t => ({ ...t, participant_status: statusMap.get(t.id) })))
      }

      const { data: admins } = await supabase
        .from('tournament_admins')
        .select('tournament_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const adminIds = (admins ?? []).map(a => a.tournament_id)
      if (adminIds.length > 0) {
        const { data: mList } = await supabase
          .from('tournaments')
          .select('*')
          .in('id', adminIds)
          .neq('status', 'cancelled')
          .order('created_at', { ascending: false })
        const roleMap = new Map((admins ?? []).map(a => [a.tournament_id, a.role]))
        setManaging((mList ?? []).map(t => ({ ...t, admin_role: roleMap.get(t.id) })))
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-muted">Loading...</div>

  const list = tab === 'playing' ? participating : managing

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">My Tournaments</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('playing')}
          className={tab === 'playing' ? 'btn-primary' : 'btn-secondary'}
        >
          Playing ({participating.length})
        </button>
        <button
          onClick={() => setTab('managing')}
          className={tab === 'managing' ? 'btn-primary' : 'btn-secondary'}
        >
          Managing ({managing.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          {tab === 'playing'
            ? "You haven't joined any tournaments yet."
            : "You aren't managing any tournaments."}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <div key={t.id} className="card flex items-center justify-between">
              <Link href={`/tournaments/${t.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className={`badge badge-${t.format}`}>{t.format}</span>
                  <span className={`badge ${statusBadgeClass(t.status)}`}>{displayStatus(t.status)}</span>
                  {tab === 'playing' && t.participant_status === 'dropped' && (
                    <span className="badge bg-danger/20 text-danger">dropped</span>
                  )}
                  {tab === 'managing' && (
                    <span className="badge bg-accent/20 text-accent">{t.admin_role}</span>
                  )}
                </div>
                <h3 className="text-lg font-bold truncate">{t.name}</h3>
                <div className="text-xs text-muted flex gap-4 mt-1">
                  <span>{t.rounds_count} rounds</span>
                  <span>Best of {t.games_per_round}</span>
                  <span>Round {t.current_round}/{t.rounds_count}</span>
                  {t.access_key && tab === 'managing' && (
                    <span>Key: <span className="font-mono text-accent">{t.access_key}</span></span>
                  )}
                </div>
              </Link>
              {tab === 'managing' && (
                <Link href={`/tournaments/${t.id}/manage`} className="btn-secondary text-sm ml-4 shrink-0">
                  Manage
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
