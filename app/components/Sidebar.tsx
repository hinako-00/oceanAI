'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser } from '@/lib/types';

const LINKS = [
  { href: '/', label: 'コーチと相談', exact: true },
  { href: '/customers', label: '顧客カルテ' },
  { href: '/meetings', label: '商談を記録' },
  { href: '/actions', label: '次回行動' },
  { href: '/members', label: 'チームの傾向' },
  { href: '/knowledge', label: '自社営業知識' },
  { href: '/profile', label: '自分の設定' },
];

export default function Sidebar({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const links = user.role === 'admin' ? [...LINKS, { href: '/admin', label: 'メンバー管理' }] : LINKS;

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
        {links.map((link) => {
          const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className="nav-item" data-active={active}>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot" style={{ marginTop: 'auto', padding: '0 8px' }}>
        <div className="user-chip">
          <div>
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div className="faint">
              {USER_ROLE_LABEL[user.role]}・{user.email}
            </div>
          </div>
        </div>
        <button type="button" className="btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={logout}>
          ログアウト
        </button>
        <div className="faint" style={{ marginTop: 10 }}>
          顧客カルテ・商談履歴・営業傾向はチームで共有されます。相談の履歴は本人だけが見られます。
        </div>
      </div>
    </aside>
  );
}
