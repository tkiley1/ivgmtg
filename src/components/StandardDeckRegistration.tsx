'use client'

import { useActionState, useRef, useState } from 'react'
import { submitStandardDeckListAction, type TournamentActionState } from '@/app/tournaments/actions'

const initialState: TournamentActionState = {}

export function StandardDeckRegistration({
  tournamentId,
  required,
  existing,
}: {
  tournamentId: string
  required: boolean
  existing: { name: string | null; listText: string | null; status: string } | null
}) {
  const [state, formAction, pending] = useActionState(submitStandardDeckListAction, initialState)
  const [listText, setListText] = useState(existing?.listText ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadFile(file: File | undefined) {
    if (!file) return
    if (file.size > 20_000) return
    setListText(await file.text())
  }

  return (
    <section className="card">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
        <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">Standard deck registration</p><h2 className="text-xl font-bold mt-1">{existing ? 'Update your deck list' : 'Submit your deck list'}</h2></div>
        <span className={`badge ${required ? 'badge-standard' : 'badge-scheduled'}`}>{required ? 'required' : 'optional'}</span>
      </div>
      <p className="text-sm text-muted mb-4">Paste the text from MTG Arena’s Export command or upload its .txt file. The validator requires a <code>Deck</code> section with at least 60 cards and permits up to 15 sideboard cards.</p>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <div><label htmlFor="deckName" className="block text-sm text-muted mb-1">Deck name</label><input id="deckName" name="name" className="input" defaultValue={existing?.name ?? ''} maxLength={120} required placeholder="Azorius Control" /></div>
        <div><label htmlFor="arenaExport" className="block text-sm text-muted mb-1">MTG Arena export</label><textarea id="arenaExport" name="listText" className="input font-mono text-xs min-h-56" value={listText} onChange={(event) => setListText(event.target.value)} required placeholder={'Deck\n4 Card Name (SET) 123\n…\n\nSideboard\n2 Card Name (SET) 456'} /></div>
        <div className="flex flex-wrap items-center gap-3"><button type="button" className="btn-secondary text-sm" onClick={() => inputRef.current?.click()}>Upload .txt</button><input ref={inputRef} type="file" className="hidden" accept="text/plain,.txt" onChange={(event) => void loadFile(event.target.files?.[0])} /><span className="text-xs text-muted">Arena export only; card legality is checked by the organizer/card database layer.</span></div>
        {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Submitting…' : existing ? 'Update deck list' : 'Submit deck list'}</button>
      </form>
    </section>
  )
}
