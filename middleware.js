export const config = { matcher: '/' };

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  const url = new URL(request.url);

  if (host.startsWith('va.') && url.pathname === '/') {
    url.pathname = '/va/';
    return Response.redirect(url, 302);
  }
}
