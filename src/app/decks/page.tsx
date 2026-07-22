import { DeckLibrary } from '@/components/DeckLibrary'
import { requireCurrentUser } from '@/lib/auth/session'
import { listUserStandardDecks } from '@/lib/tournaments/queries'

export const dynamic = 'force-dynamic'

export default async function DeckLibraryPage() {
  const user = await requireCurrentUser()
  const decks = await listUserStandardDecks(user.id)
  return <div className="mx-auto max-w-4xl px-4 py-8"><DeckLibrary decks={decks} /></div>
}
