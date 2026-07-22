import Link from 'next/link'
import { VerifyEmailForm } from '@/components/AuthStatusForm'

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-3xl font-bold">Invalid verification link</h1><p className="mt-3 text-muted">Sign in and request another email from settings.</p><Link href="/auth/login" className="btn-primary mt-7">Sign in</Link></div>
  return <div className="mx-auto max-w-md px-4 py-20"><h1 className="mb-3 text-center text-3xl font-bold">Verify your email</h1><p className="mb-8 text-center text-sm text-muted">Confirming your address helps protect your account and tournament access.</p><VerifyEmailForm token={token} /></div>
}
