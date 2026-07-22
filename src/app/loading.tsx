export default function Loading() {
  return <div className="mx-auto max-w-7xl animate-pulse px-4 py-8"><div className="h-6 w-32 rounded bg-primary/25" /><div className="mt-4 h-12 max-w-md rounded-lg bg-card" /><div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-48 rounded-2xl border border-border bg-card/70" />)}</div></div>
}
