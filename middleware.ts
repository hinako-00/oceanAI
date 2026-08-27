import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE } from '@/lib/auth-constants';

/**
 * 未ログインのアクセスを入口で止める。
 * Cookieの有無だけを見て振り分け、セッションの有効性は各APIの requireUser() が確認する。
 */
const PUBLIC_PATHS = [
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/setup',
  // 死活監視はロードバランサやコンテナのヘルスチェックから叩かれるため公開する。
  '/api/health',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (request.cookies.get(SESSION_COOKIE)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  // ログイン後に元の画面へ戻す。
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // 静的ファイルとファビコンは対象外にする。
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
