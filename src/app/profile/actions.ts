'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireCurrentUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { profiles } from '@/lib/db/schema'

export type ProfileActionState = { error?: string; success?: string }

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required.').max(80),
  bio: z.string().trim().max(280, 'Bio must be 280 characters or fewer.').optional(),
  avatarUrl: z.string().trim().url('Enter a valid avatar URL.').max(2_000).optional().or(z.literal('')),
})

export async function updateProfileAction(_: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const user = await requireCurrentUser()
  await getDb().update(profiles).set({
    displayName: parsed.data.displayName,
    bio: parsed.data.bio || null,
    avatarUrl: parsed.data.avatarUrl || null,
    updatedAt: new Date(),
  }).where(eq(profiles.userId, user.id))
  revalidatePath(`/profile/${user.username}`)
  revalidatePath('/profile/settings')
  return { success: 'Profile saved.' }
}
