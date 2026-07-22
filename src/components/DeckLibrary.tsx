'use client'

import { useActionState, useRef, useState } from 'react'
import { deleteDeckAction, saveStandardDeckAction, type DeckActionState } from '@/app/decks/actions'

const initialState: DeckActionState = {}

type Deck = { id: string; name: string; listText: string; isPublic: boolean }

function DeckEditor({ deck }: { deck?: Deck }) {
  const [state, action, pending] = useActionState(saveStandardDeckAction, initialState)
  const [listText, setListText] = useState(deck?.listText ?? '')
  const fileInput = useRef<HTMLInputElement>(null)
  async function loadFile(file: File | undefined) {
    if (file && file.size <= 20_000) setListText(await file.text())
  }
  return <form action={action} className="space-y-4 rounded-xl border border-border bg-background/35 p-4"><input type="hidden" name="deckId" value={deck?.id ?? ''} /><div className="flex flex-col gap-3 sm:flex-row"><div className="flex-1"><label className="mb-1 block text-sm text-muted">Deck name</label><input name="name" required maxLength={120} className="input" defaultValue={deck?.name ?? ''} placeholder="Azorius Control" /></div><label className="mt-6 flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" defaultChecked={deck?.isPublic ?? false} /> Show on profile</label></div><div><label className="mb-1 block text-sm text-muted">MTG Arena export</label><textarea name="listText" value={listText} onChange={(event) => setListText(event.target.value)} required className="input min-h-48 font-mono text-xs" placeholder={'Deck\n4 Card Name (SET) 123\n…'} /></div><div className="flex flex-wrap items-center gap-3"><button type="button" className="btn-secondary text-sm" onClick={() => fileInput.current?.click()}>Upload .txt</button><input ref={fileInput} type="file" accept="text/plain,.txt" className="hidden" onChange={(event) => void loadFile(event.target.files?.[0])} /><span className="text-xs text-muted">Standard decks are validated for a 60+ card main deck and up to 15 sideboard cards.</span></div>{state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}{state.success && <p className="text-sm text-success" role="status">{state.success}</p>}<button type="submit" disabled={pending} className="btn-primary">{pending ? 'Saving…' : deck ? 'Save changes' : 'Add Standard deck'}</button></form>
}

function DeckDeleteButton({ deckId }: { deckId: string }) {
  const [state, action, pending] = useActionState(deleteDeckAction, initialState)
  return <form action={action} onSubmit={(event) => { if (!window.confirm('Remove this deck from your library? Tournament deck submissions will stay intact.')) event.preventDefault() }}><input type="hidden" name="deckId" value={deckId} />{state.error && <p className="mb-2 text-sm text-danger">{state.error}</p>}<button type="submit" disabled={pending} className="text-sm text-danger hover:underline">{pending ? 'Removing…' : 'Remove deck'}</button></form>
}

export function DeckLibrary({ decks }: { decks: Deck[] }) {
  return <div className="space-y-7"><section className="card"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Deck library</p><h1 className="mt-2 text-3xl font-bold">Your Standard decks</h1><p className="mt-2 text-muted">Save validated Arena exports once, choose their profile visibility, and reuse them when registering for Standard events. Commander support is planned next.</p></section><section className="card"><h2 className="mb-4 text-xl font-bold">Add a deck</h2><DeckEditor /></section>{decks.length > 0 && <section className="space-y-4"><h2 className="text-xl font-bold">Saved decks</h2>{decks.map((deck) => <details key={deck.id} className="card group"><summary className="cursor-pointer list-none flex items-center justify-between gap-3"><div><p className="font-semibold">{deck.name}</p><p className="text-sm text-muted">Standard · {deck.isPublic ? 'Visible on profile' : 'Private'}</p></div><span className="text-sm text-accent group-open:hidden">Edit</span></summary><div className="mt-5 space-y-4 border-t border-border pt-5"><DeckEditor deck={deck} /><DeckDeleteButton deckId={deck.id} /></div></details>)}</section>}</div>
}
