import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return (
    <div className="landing-page">
      {/* Animated background */}
      <div className="landing-bg" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid-overlay" />
      </div>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-4 text-center">
        <div className="landing-badge">Tournament Platform</div>
        <h1 className="landing-title">
          <span className="landing-title-accent">IVG</span>MTG
        </h1>
        <p className="landing-subtitle">
          Organize and compete in Magic: The Gathering tournaments.<br className="hidden sm:block" />
          Swiss pairings. ELO rankings. Live standings. All in one place.
        </p>
        <div className="flex gap-4 mt-10">
          <Link href="/auth/register" className="landing-cta-primary">
            Create Account
          </Link>
          <Link href="/auth/login" className="landing-cta-secondary">
            Sign In
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 animate-bounce text-muted/40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 py-24">
        <h2 className="text-center text-sm font-bold uppercase tracking-[0.2em] text-accent/60 mb-4">
          Everything you need
        </h2>
        <p className="text-center text-3xl sm:text-4xl font-bold mb-16 max-w-2xl mx-auto leading-tight">
          Run tournaments like a <span className="text-accent">planeswalker</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
              title: 'Swiss Pairings',
              desc: 'Automatic Swiss-system pairings with rematch avoidance, bye handling, and score-group matching.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
                </svg>
              ),
              title: 'ELO Ratings',
              desc: 'Track your skill with a persistent ELO rating. Gain points from wins, lose them from defeats.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
                </svg>
              ),
              title: 'Live Standings',
              desc: 'Full MTG tiebreakers: match points, OMW%, GW%, OGW%. Updated in real time.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 6v6l4 2" />
                </svg>
              ),
              title: 'Round Timer',
              desc: 'Live countdown for each round. Players and judges always know how much time remains.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
              ),
              title: 'Score Reporting',
              desc: 'Players submit and confirm scores. Dual-confirmation prevents disputes. Admins can override.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 9 7 12 7s5-3 7.5-3a2.5 2.5 0 0 1 0 5H18" /><path d="M18 15h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M6 15H4.5a2.5 2.5 0 0 0 0 5H6" /><path d="M18 21h1.5a2.5 2.5 0 0 0 0-5H18" /><line x1="6" y1="9" x2="6" y2="15" /><line x1="18" y1="9" x2="18" y2="15" /><line x1="6" y1="15" x2="6" y2="21" /><line x1="18" y1="15" x2="18" y2="21" />
                </svg>
              ),
              title: 'Top Cut Brackets',
              desc: 'Optional single-elimination top cut after Swiss rounds. Seeded by final standings.',
            },
          ].map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3 className="text-lg font-bold mt-4 mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Formats */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 py-24">
        <h2 className="text-center text-3xl sm:text-4xl font-bold mb-16">
          All major formats
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          {[
            { name: 'Commander', color: '#c084fc', bg: '#7c3aed22', desc: 'Multiplayer or 1v1 commander pods' },
            { name: 'Draft', color: '#93c5fd', bg: '#3b82f622', desc: 'Booster draft with Swiss rounds' },
            { name: 'Sealed', color: '#fbbf24', bg: '#f59e0b22', desc: 'Sealed deck tournament play' },
          ].map((fmt) => (
            <div key={fmt.name} className="card py-8" style={{ borderColor: `${fmt.color}33` }}>
              <div
                className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl font-black"
                style={{ background: fmt.bg, color: fmt.color }}
              >
                {fmt.name[0]}
              </div>
              <h3 className="text-xl font-bold mb-1" style={{ color: fmt.color }}>{fmt.name}</h3>
              <p className="text-sm text-muted">{fmt.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 text-center py-24 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to compete?</h2>
          <p className="text-muted text-lg mb-8">
            Create your account and join your first tournament in under a minute.
          </p>
          <Link href="/auth/register" className="landing-cta-primary text-lg px-8 py-3">
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8 text-center text-sm text-muted/60">
        IVGMTG &middot; Magic: The Gathering Tournament Platform
      </footer>
    </div>
  )
}
