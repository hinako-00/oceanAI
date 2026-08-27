import type { Metadata } from 'next';

import Sidebar from './components/Sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ocean AI ｜ AI営業コーチ',
  description: '商談メモと顧客情報から、営業担当者の次の一手を具体化するAI営業コーチ',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="shell">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
      </body>
    </html>
  );
}
