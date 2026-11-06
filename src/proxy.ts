// Every route except sign-in, Auth.js endpoints and static assets requires a session.
// Unauthenticated requests are redirected to /signin by the `authorized` callback in src/auth.ts.
export { auth as proxy } from '@/auth';

export const config = {
  matcher: ['/((?!api/auth|signin|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
