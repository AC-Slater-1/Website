// middleware.js
// Vercel Edge Middleware for domain routing + future split testing
// Phase 3 of Marketing Infrastructure Plan

import { NextResponse } from 'next/server';

// Domain to brand path mapping
const DOMAIN_MAP = {
  'saasbuster.ai': '/saasbuster',
  'iseeq.ai': '/iseeq',
  '16kb.ai': '/16kb',
  'limeware.ai': '/limeware',
  'modelt.ai': '/modelt',
  'nocatch.ai': '/nocatch',
  'plainlabel.ai': '/plainlabel',
  'samebutfree.ai': '/samebutfree',
  'compareto.ai': '/compareto',
  'vanillalabs.ai': '/vanillalabs',
  'sassbuster.ai': '/sassbuster',
  'appbuster.com': '' // root brand, no rewrite
};

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Don't rewrite API routes, static assets, or shared scripts
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/ab-tracker.js') ||
    pathname.startsWith('/ab-pixels.js') ||
    pathname.startsWith('/kevin-widget.js') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Get brand prefix for this domain
  const brandPrefix = DOMAIN_MAP[hostname];

  // If unknown domain or appbuster.com, no rewrite needed
  if (brandPrefix === undefined || brandPrefix === '') {
    return NextResponse.next();
  }

  // Rewrite to brand-specific path
  // Example: saasbuster.ai/analytics.html -> /saasbuster/analytics.html
  const rewritePath = `${brandPrefix}${pathname}`;
  const url = request.nextUrl.clone();
  url.pathname = rewritePath;

  return NextResponse.rewrite(url);
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api routes
     * - _next static files
     * - static files (images, css, js)
     */
    '/((?!api/|_next/|.*\\..*$).*)',
  ],
};
