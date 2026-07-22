import Link from 'next/link'
import { ResetPasswordForm } from '@/components/PasswordResetForms'

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  if (!token) return <div className="mx-auto max-w-md px-4 py-20 text-center"><h1 className="text-3xl font-bold">Invalid reset link</h1><p className="mt-3 text-muted">Request a new password reset link to continue.</p><Link href="/auth/forgot-password" className="btn-primary mt-7">Request reset</Link></div>
  return <div className="mx-auto max-w-md px-4 py-20"><h1 className="mb-3 text-center text-3xl font-bold">Choose a new password</h1><p className="mb-8 text-center text-sm text-muted">Use at least 12 characters. This signs out other active sessions.</p><ResetPasswordForm token={token} /></div>
}
