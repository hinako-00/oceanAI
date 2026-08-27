'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'コーチと相談', exact: true },
  { href: '/customers', label: '顧客カルテ' },
  { href: '/meetings', label: '商談を記録' },
  { href: '/actions', label: '次回行動' },
  { href: '/profile', label: '自分の営業傾向' },
  { href: '/knowledge', label: '自社営業知識' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">O</div>
        <div>
          <div className="brand-name">Ocean AI</div>
          <div className="brand-sub">AI営業コーチ</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label">メニュー</div>
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className="nav-item" data-active={active}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot faint" style={{ marginTop: 'auto', padding: '0 8px' }}>
        AIの出力は保存前に必ず担当者が確認します。確認済みの事実・担当者の報告・AIの仮説は区別して記録されます。
      </div>
    </aside>
  );
}
