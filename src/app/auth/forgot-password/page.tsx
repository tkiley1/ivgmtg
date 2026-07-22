import Link from 'next/link'
import { RequestPasswordResetForm } from '@/components/PasswordResetForms'

export default function ForgotPasswordPage() {
  return <div className="mx-auto max-w-md px-4 py-20"><h1 className="mb-3 text-center text-3xl font-bold">Reset password</h1><p className="mb-8 text-center text-sm text-muted">We&apos;ll send a one-hour reset link if the account exists.</p><RequestPasswordResetForm /><p className="mt-6 text-center text-sm text-muted"><Link href="/auth/login" className="text-accent hover:underline">Back to sign in</Link></p></div>
}
