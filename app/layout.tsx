import type { Metadata, Viewport } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

import MobileNav from './components/MobileNav';
import Sidebar from './components/Sidebar';
import { getCurrentUser } from '@/lib/auth';
import { isPublicPath, loginPath, SESSION_COOKIE } from '@/lib/auth-constants';
import { THEME_KEYS, THEME_STORAGE_KEY } from '@/lib/theme';
import { toPublicUser } from '@/lib/types';
import './globals.css';

/**
 * 配色（ブルーデザイン3案）を最初の描画より前に当てるスクリプト。
 * これがないと、既定の案で一瞬描いてから選んだ案に切り替わり、画面がちらつく。
 * localStorage が読めない環境でも既定の配色で表示できるよう握りつぶす。
 */
const THEME_BOOTSTRAP = `(function(){try{var k=window.localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(${JSON.stringify(THEME_KEYS)}.indexOf(k)>-1){document.documentElement.setAttribute('data-theme',k);}}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'Ocean AI ｜ AI営業コーチ',
  description: 'アポメモとクライアント情報から、営業担当者の次の一手を具体化するAI営業コーチ',
  // ホーム画面に追加したときにブラウザのUIを出さず、アプリのように開く。
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Ocean AI' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 拡大は禁止せず、必要な人が拡げられるようにしておく。
  maximumScale: 5,
  // ノッチのある端末で画面の端まで描き、余白は safe-area-inset で確保する。
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#101a2b' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Cookieはあるのに利用者を解決できない＝セッションが期限切れ・失効している
  // （30日経過、管理者による無効化、パスワード変更による全端末の失効など）。
  // middleware はCookieの有無しか見ないためここまで素通りしてくる。
  // 放置すると、ナビゲーションのない裸の画面に「ログインが必要です」とだけ出て、
  // 利用者は自力でURLを打つしかなくなる。ログイン画面へ送り、元の画面へ戻せるようにする。
  if (!user) {
    const pathname = (await headers()).get('x-pathname') ?? '';
    const hasStaleCookie = Boolean((await cookies()).get(SESSION_COOKIE));
    if (hasStaleCookie && !isPublicPath(pathname)) {
      redirect(loginPath(pathname, true));
    }
  }

  return (
    <html lang="ja">
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        {user ? (
          <div className="shell">
            {/* PCはサイドバー、モバイルは上部バー＋ボトムタブ。表示の切り替えはCSSで行う。 */}
            <Sidebar user={toPublicUser(user)} />
            <div className="main">
              <MobileNav user={toPublicUser(user)} />
              {children}
            </div>
          </div>
        ) : (
          // ログイン・初期設定画面はナビゲーションなしで表示する。
          children
        )}
      </body>
    </html>
  );
}
