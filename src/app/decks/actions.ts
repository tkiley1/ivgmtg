'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireCurrentUser } from '@/lib/auth/session'
import { getDb } from '@/lib/db'
import { userDecks } from '@/lib/db/schema'
import { validateStandardArenaDecklist } from '@/lib/decks/arena'

export type DeckActionState = { error?: string; success?: string }

const deckSchema = z.object({
  deckId: z.preprocess((value) => value === '' ? undefined : value, z.string().uuid().optional()),
  name: z.string().trim().min(1, 'Give this deck a name.').max(120),
  listText: z.string().trim().min(1, 'Paste an MTG Arena deck export.').max(20_000),
  isPublic: z.string().optional(),
})

function refreshDeckViews(username: string) {
  revalidatePath('/decks')
  revalidatePath(`/profile/${username}`)
}

export async function saveStandardDeckAction(_: DeckActionState, formData: FormData): Promise<DeckActionState> {
  const parsed = deckSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the deck and try again.' }
  try {
    validateStandardArenaDecklist(parsed.data.listText)
    const user = await requireCurrentUser()
    const database = getDb()
    const values = {
      name: parsed.data.name,
      listText: parsed.data.listText,
      isPublic: parsed.data.isPublic === 'on',
      updatedAt: new Date(),
    }
    if (parsed.data.deckId) {
      const [updated] = await database.update(userDecks).set(values).where(and(eq(userDecks.id, parsed.data.deckId), eq(userDecks.userId, user.id))).returning({ id: userDecks.id })
      if (!updated) return { error: 'That deck is no longer available.' }
    } else {
      await database.insert(userDecks).values({ userId: user.id, format: 'standard', ...values })
    }
    refreshDeckViews(user.username)
    return { success: parsed.data.deckId ? 'Deck updated.' : 'Deck added to your library.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save this deck.' }
  }
}

export async function deleteDeckAction(_: DeckActionState, formData: FormData): Promise<DeckActionState> {
  const deckId = z.string().uuid().safeParse(formData.get('deckId'))
  if (!deckId.success) return { error: 'That deck is invalid.' }
  try {
    const user = await requireCurrentUser()
    const [deleted] = await getDb().delete(userDecks).where(and(eq(userDecks.id, deckId.data), eq(userDecks.userId, user.id))).returning({ id: userDecks.id })
    if (!deleted) return { error: 'That deck is no longer available.' }
    refreshDeckViews(user.username)
    return { success: 'Deck removed from your library. Tournament deck submissions are unchanged.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to remove this deck.' }
  }
}
