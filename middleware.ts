export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/schedules/:path*',
    '/availability/:path*',
    '/users/:path*',
    '/api/users/:path*',
    '/api/schedules/:path*',
    '/api/availability/:path*',
  ],
};
