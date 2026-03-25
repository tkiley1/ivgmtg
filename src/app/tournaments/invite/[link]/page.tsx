'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function InviteLinkPage({
  params,
}: {
  params: Promise<{ link: string }>
}) {
  const { link } = use(params)
  const supabase = createClient()
  const router = useRouter()
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(true)

  useEffect(() => {
    const join = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(`/auth/login?redirect=/tournaments/invite/${link}`)
        return
      }

      const { data, error: err } = await supabase.rpc('join_tournament_by_link', {
        p_invite_link: link,
      })

      if (err) {
        setError(err.message)
        setJoining(false)
      } else {
        router.push(`/tournaments/${data}`)
      }
    }
    join()
  }, [link])

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-4">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center text-muted">
      {joining ? 'Joining tournament...' : 'Redirecting...'}
    </div>
  )
}
