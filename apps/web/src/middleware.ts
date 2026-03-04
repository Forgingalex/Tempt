export { auth as middleware } from '@/lib/auth'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/studio/:path*',
    '/agent/:id/use/:path*',
    '/settings/:path*',
  ],
}
