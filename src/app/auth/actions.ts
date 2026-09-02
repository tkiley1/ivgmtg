'use server'

import { createHash, randomBytes } from 'crypto'
import { compare, hash } from 'bcryptjs'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createSession, destroySession, requireCurrentUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { emailVerificationTokens, passwordResetTokens, profiles, sessions, users } from '@/lib/db/schema'
import { sendTransactionalEmail } from '@/lib/email'

export type AuthActionState = { error?: string; message?: string }

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

const emailSchema = z.string().trim().email('Enter a valid email address.').max(320).transform((value) => value.toLowerCase())
const resetSchema = z.object({
  token: z.string().min(40).max(128),
  password: z.string().min(12, 'Use at least 12 characters for your password.').max(128),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
})

function safeRedirect(value: string | undefined) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/dashboard'
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function newToken() {
  return randomBytes(32).toString('base64url')
}

function appUrl(path: string) {
  const base = process.env.APP_URL
  if (!base) throw new Error('APP_URL must be configured before sending account emails.')
  return new URL(path, base).toString()
}

async function sendVerificationEmail(user: { id: string; email: string }) {
  const database = getDb()
  const token = newToken()
  await database.transaction(async (tx) => {
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id))
    await tx.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
  })
  const url = appUrl(`/auth/verify?token=${encodeURIComponent(token)}`)
  await sendTransactionalEmail({
    to: user.email,
    subject: 'Verify your InvadersMTG email',
    text: `Verify your email address to secure your InvadersMTG account: ${url}`,
    html: `<p>Verify your email address to secure your InvadersMTG account.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`,
  })
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
      .returning({ id: users.id, email: users.email })
    await tx.insert(profiles).values({
      userId: createdUser.id,
      username: input.username,
      displayName,
    })
    return [createdUser]
  })

  await createSession(user.id)
  try {
    await sendVerificationEmail(user)
  } catch (error) {
    console.error('Unable to send verification email after registration.', error)
  }
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

export async function requestPasswordResetAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(formData.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Enter a valid email address.' }

  const [user] = await getDb()
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.email, parsed.data), eq(users.isActive, true)))
    .limit(1)

  // Always return the same response so this endpoint cannot reveal account existence.
  if (!user) return { message: 'If that address has an account, a reset link is on its way.' }

  const token = newToken()
  try {
    await getDb().transaction(async (tx) => {
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: tokenHash(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      })
    })
    const url = appUrl(`/auth/reset-password?token=${encodeURIComponent(token)}`)
    await sendTransactionalEmail({
      to: user.email,
      subject: 'Reset your InvadersMTG password',
      text: `Reset your InvadersMTG password: ${url}`,
      html: `<p>Someone requested a password reset for your InvadersMTG account.</p><p><a href="${url}">Reset password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
    })
  } catch (error) {
    console.error('Unable to send password reset email.', error)
  }
  return { message: 'If that address has an account, a reset link is on its way.' }
}

export async function resetPasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const tokenDigest = tokenHash(parsed.data.token)
  const userId = await getDb().transaction(async (tx) => {
    const [reset] = await tx
      .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenDigest),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ))
      .limit(1)
    if (!reset) return null

    await tx.update(users).set({ passwordHash: await hash(parsed.data.password, 12), updatedAt: new Date() }).where(eq(users.id, reset.userId))
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, reset.id))
    await tx.delete(sessions).where(eq(sessions.userId, reset.userId))
    return reset.userId
  })

  if (!userId) return { error: 'That reset link is invalid or has expired. Request a new one.' }
  await createSession(userId)
  redirect('/dashboard?passwordReset=1')
}

export async function verifyEmailAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const token = z.string().min(40).max(128).safeParse(formData.get('token'))
  if (!token.success) return { error: 'That verification link is invalid.' }
  const tokenDigest = tokenHash(token.data)

  const verified = await getDb().transaction(async (tx) => {
    const [verification] = await tx
      .select({ id: emailVerificationTokens.id, userId: emailVerificationTokens.userId })
      .from(emailVerificationTokens)
      .where(and(
        eq(emailVerificationTokens.tokenHash, tokenDigest),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ))
      .limit(1)
    if (!verification) return false
    await tx.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, verification.userId))
    await tx.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, verification.id))
    return true
  })

  if (!verified) return { error: 'That verification link is invalid or has expired. Request a new one from settings.' }
  redirect('/dashboard?verified=1')
}

export async function resendVerificationAction(previousState: AuthActionState, formData: FormData): Promise<AuthActionState> {
  void previousState
  void formData
  const user = await requireCurrentUser()
  const [account] = await getDb()
    .select({ id: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
  if (!account) return { error: 'Your account could not be found.' }
  if (account.emailVerifiedAt) return { message: 'Your email address is already verified.' }
  try {
    await sendVerificationEmail(account)
    return { message: 'A new verification link is on its way.' }
  } catch (error) {
    console.error('Unable to resend verification email.', error)
    return { error: 'We could not send that email. Please try again shortly.' }
  }
}
