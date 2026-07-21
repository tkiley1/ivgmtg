import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // This is only an optimistic redirect. Every server action and route validates
  // the session and authorization again before reading or changing data.
  const protectedPaths = ['/dashboard', '/leaderboard', '/profile', '/tournaments/create', '/tournaments/join', '/tournaments/my']
  const isProtected = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (!request.cookies.has('ivgmtg_session') && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
