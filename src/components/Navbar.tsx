import { getCurrentUser } from '@/lib/auth/session'
import { AppNavigation } from '@/components/AppNavigation'

export async function Navbar() {
  const user = await getCurrentUser()

  return <AppNavigation user={user ? { username: user.username } : null} />
}
