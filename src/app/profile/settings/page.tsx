import { ProfileSettingsForm } from '@/components/ProfileSettingsForm'
import { ResendVerificationForm } from '@/components/AuthStatusForm'
import { requireCurrentUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export default async function ProfileSettingsPage() {
  const user = await requireCurrentUser()
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, user.id)).limit(1)
  if (!profile) return null
  return <div className="max-w-2xl mx-auto px-4 py-8 space-y-6"><div className="mb-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Player profile</p><h1 className="text-3xl font-bold mt-2">Profile settings</h1></div>{!user.emailVerifiedAt && <section className="card"><h2 className="text-lg font-bold">Email verification</h2><p className="mt-1 text-sm text-muted">Your email is not yet verified. We&apos;ll send a fresh link to {user.email}.</p><div className="mt-4"><ResendVerificationForm /></div></section>}<ProfileSettingsForm profile={profile} /></div>
}
