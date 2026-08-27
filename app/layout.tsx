import type { Metadata } from 'next';

import Sidebar from './components/Sidebar';
import { getCurrentUser } from '@/lib/auth';
import { toPublicUser } from '@/lib/types';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ocean AI ｜ AI営業コーチ',
  description: '商談メモと顧客情報から、営業担当者の次の一手を具体化するAI営業コーチ',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="ja">
      <body>
        {user ? (
          <div className="shell">
            <Sidebar user={toPublicUser(user)} />
            <div className="main">{children}</div>
          </div>
        ) : (
          // ログイン・初期設定画面はサイドバーなしで表示する。
          children
        )}
      </body>
    </html>
  );
}
