import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isPublicPath, loginPath, SESSION_COOKIE } from '@/lib/auth-constants';

/**
 * 未ログインのアクセスを入口で止める。
 *
 * ここで見られるのはCookieの「有無」だけ。セッションが生きているかの確認には
 * 保存層（ファイル / Netlify Blobs）が要り、Edgeでは動かせないため、
 * 有効性の判定は各APIの requireUser() とレイアウトの getCurrentUser() に任せる。
 * つまり「Cookieはあるが期限切れ」の場合はここを素通りする。その先の扱いは
 * app/layout.tsx（画面遷移）と lib/client.ts（fetchの401）が引き受ける。
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // レイアウトが現在地を知るための手掛かり。
  // サーバーコンポーネントはpathnameを直接受け取れないため、ここでヘッダに載せる。
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  const pass = () => NextResponse.next({ request: { headers } });

  if (isPublicPath(pathname)) return pass();

  if (request.cookies.get(SESSION_COOKIE)) return pass();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 });
  }

  // ログイン後に元の画面へ戻す。
  return NextResponse.redirect(new URL(loginPath(pathname), request.url));
}

export const config = {
  // 静的ファイルとファビコンは対象外にする。
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
