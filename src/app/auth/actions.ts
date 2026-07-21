'use server'

import { compare, hash } from 'bcryptjs'
import { eq, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSession, destroySession } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { profiles, users } from '@/lib/db/schema'

export type AuthActionState = { error?: string }

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, 'Use 3–30 lowercase letters, numbers, or underscores.')

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(40),
  lastName: z.string().trim().min(1, 'Last name is required.').max(40),
  email: z.string().trim().email('Enter a valid email address.').max(320).transform((value) => value.toLowerCase()),
  username,
  password: z.string().min(12, 'Use at least 12 characters for your password.').max(128),
})

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
  redirectTo: z.string().optional(),
})

function safeRedirect(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

export async function registerAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const input = parsed.data
  const database = getDb()
  const [existing] = await database
    .select({ id: users.id })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(or(eq(users.email, input.email), eq(profiles.username, input.username)))
    .limit(1)

  if (existing) return { error: 'That email address or username is already in use.' }

  const passwordHash = await hash(input.password, 12)
  const displayName = `${input.firstName} ${input.lastName}`

  const [user] = await database.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({ email: input.email, passwordHash })
      .returning({ id: users.id })
    await tx.insert(profiles).values({
      userId: createdUser.id,
      username: input.username,
      displayName,
    })
    return [createdUser]
  })

  await createSession(user.id)
  redirect('/dashboard')
}

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter your email address and password.' }

  const input = parsed.data
  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)

  if (!user || !user.isActive || !(await compare(input.password, user.passwordHash))) {
    return { error: 'Invalid email address or password.' }
  }

  await createSession(user.id)
  redirect(safeRedirect(input.redirectTo))
}

export async function signOutAction() {
  await destroySession()
  redirect('/')
}
