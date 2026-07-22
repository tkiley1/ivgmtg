import { createHash, randomBytes } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getDb } from '@/lib/db'
import { profiles, sessions, users } from '@/lib/db/schema'

const SESSION_COOKIE = 'ivgmtg_session'
const SESSION_LIFETIME_DAYS = Number(process.env.SESSION_LIFETIME_DAYS ?? 30)

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export type CurrentUser = {
  id: string
  email: string
  emailVerifiedAt: Date | null
  username: string
  displayName: string
  avatarUrl: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  const [result] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1)

  return result ?? null
}

export async function requireCurrentUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login')
  return user
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000)

  await getDb().insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  })

  ;(await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
  cookieStore.delete(SESSION_COOKIE)
}

export async function hasSessionCookie() {
  return Boolean((await cookies()).get(SESSION_COOKIE)?.value)
}
