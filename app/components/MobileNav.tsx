'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  IconClose,
  IconMore,
  TAB_HREFS,
  currentTitle,
  isActive,
  linksFor,
} from './nav';
import { USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser } from '@/lib/types';

/**
 * モバイル用のナビゲーション。
 * 上部に現在地を出すバー、下部に親指で届くタブを置き、
 * タブに載りきらない画面は「その他」のボトムシートにまとめる。
 * PCでは CSS（.topbar / .tabbar）で非表示にし、Sidebar に切り替わる。
 */
export default function MobileNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const links = linksFor(user);
  const tabs = links.filter((link) => TAB_HREFS.includes(link.href));
  const rest = links.filter((link) => !TAB_HREFS.includes(link.href));

  // 画面が変わったらシートは閉じる。
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // シートを開いている間は背面をスクロールさせない。Escキーで閉じられるようにする。
  useEffect(() => {
    if (!moreOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const moreActive = rest.some((link) => isActive(pathname, link));

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">O</div>
        </div>
        <div className="topbar-title">{currentTitle(pathname)}</div>
      </header>

      <nav className="tabbar" aria-label="メインメニュー">
        {tabs.map((link) => {
          const TabIcon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="tab-item"
              data-active={isActive(pathname, link)}
              aria-current={isActive(pathname, link) ? 'page' : undefined}
            >
              <TabIcon />
              {link.short}
            </Link>
          );
        })}
        <button
          type="button"
          className="tab-item"
          data-active={moreActive || moreOpen}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <IconMore />
          その他
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className="sheet-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="sheet" role="dialog" aria-label="その他のメニュー">
            <div className="sheet-grip" />
            <div className="sheet-head">
              <h2 className="sheet-title">メニュー</h2>
              <button
                type="button"
                className="btn-icon"
                aria-label="閉じる"
                onClick={() => setMoreOpen(false)}
              >
                <IconClose />
              </button>
            </div>

            <div className="nav">
              {rest.map((link) => {
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
            </div>

            <div className="user-chip" style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700 }}>{user.name}</div>
              <div className="faint">
                {USER_ROLE_LABEL[user.role]}・{user.email}
              </div>
            </div>

            <button type="button" className="btn-block" style={{ marginTop: 10 }} onClick={logout}>
              ログアウト
            </button>

            <p className="faint" style={{ margin: '12px 2px 0' }}>
              顧客情報・アポ履歴・営業傾向はチームで共有されます。相談の履歴は本人だけが見られます。
            </p>
          </div>
        </>
      )}
    </>
  );
}
