import { ProfileSettingsForm } from '@/components/ProfileSettingsForm'
import { requireCurrentUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function ProfileSettingsPage() {
  const user = await requireCurrentUser()
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
  if (!profile) return null
  return <div className="max-w-2xl mx-auto px-4 py-8"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Player profile</p><h1 className="text-3xl font-bold mt-2">Profile settings</h1></div><ProfileSettingsForm profile={profile} /></div>
}
