'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { isActive, linksFor } from './nav';
import { USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser } from '@/lib/types';

/**
 * PC用のサイドバー。
 * 1024px 未満では CSS で非表示になり、MobileNav（上部バー＋ボトムタブ）に置き換わる。
 */
export default function Sidebar({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="sidebar">
      <div className="brand" style={{ padding: '0 8px' }}>
        <div className="brand-mark">O</div>
        <div>
          <div className="brand-name">Ocean AI</div>
          <div className="brand-sub">AI営業コーチ</div>
        </div>
      </div>

      <nav className="nav">
        <div className="nav-label" style={{ padding: '0 8px 4px' }}>
          メニュー
        </div>
        {linksFor(user).map((link) => {
          const LinkIcon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="nav-item"
              data-active={isActive(pathname, link)}
            >
              <LinkIcon />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: '0 8px' }}>
        <div className="user-chip">
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="faint">
            {USER_ROLE_LABEL[user.role]}・{user.email}
          </div>
        </div>
        <button type="button" className="btn-sm btn-block" style={{ marginTop: 8 }} onClick={logout}>
          ログアウト
        </button>
        <div className="faint" style={{ marginTop: 10 }}>
          クライアント情報・アポ履歴・営業傾向はチームで共有されます。相談の履歴は本人だけが見られます。
        </div>
      </div>
    </aside>
  );
}
