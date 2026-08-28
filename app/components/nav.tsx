/**
 * 画面遷移の定義とアイコン。
 * PCのサイドバー（Sidebar）とモバイルのボトムタブ（MobileNav）で同じものを使う。
 */
import type { PublicUser } from '@/lib/types';

/** 線画アイコン。太さと色は親から継承させる。 */
function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconChat = () => (
  <Icon>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.2-.5L3 21l1.7-4.6A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z" />
  </Icon>
);

export const IconCustomers = () => (
  <Icon>
    <path d="M3 21V8l7-4v17" />
    <path d="M10 9h8a3 3 0 0 1 3 3v9" />
    <path d="M14 13h.01M14 17h.01M17.5 13h.01M17.5 17h.01M6.5 9h.01M6.5 13h.01M6.5 17h.01" />
  </Icon>
);

export const IconMeetings = () => (
  <Icon>
    <path d="M15.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6.5Z" />
    <path d="M15 3v4h4" />
    <path d="M9 12h6M9 16h4" />
  </Icon>
);

export const IconActions = () => (
  <Icon>
    <path d="M9 11.5 11 13.5 15.5 9" />
    <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
    <path d="M8 2.5v4M16 2.5v4" />
  </Icon>
);

export const IconMembers = () => (
  <Icon>
    <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4" />
    <path d="M15.5 5a3.2 3.2 0 0 1 0 6.2" />
  </Icon>
);

export const IconKnowledge = () => (
  <Icon>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5Z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z" />
  </Icon>
);

export const IconProfile = () => (
  <Icon>
    <circle cx="12" cy="8" r="3.4" />
    <path d="M5 20v-1a4.5 4.5 0 0 1 4.5-4.5h5A4.5 4.5 0 0 1 19 19v1" />
  </Icon>
);

export const IconAdmin = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1A1.6 1.6 0 0 0 10 3.2V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.4a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
  </Icon>
);

export const IconMore = () => (
  <Icon>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconHistory = () => (
  <Icon>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4.5V9H8" />
    <path d="M12 7.5V12l3 1.8" />
  </Icon>
);

export const IconSettings = () => (
  <Icon>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2.2" />
    <circle cx="8" cy="17" r="2.2" />
  </Icon>
);

export const IconSend = () => (
  <Icon>
    <path d="M4.5 12 20 4.5 15.5 20l-3.4-5.6L4.5 12Z" />
  </Icon>
);

export const IconPlus = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const IconClose = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export interface NavLink {
  href: string;
  label: string;
  /** ボトムタブ用の短い名前。 */
  short: string;
  exact?: boolean;
  icon: () => React.ReactElement;
  /** 管理者だけに見せる。 */
  adminOnly?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'コーチと相談', short: '相談', exact: true, icon: IconChat },
  { href: '/customers', label: '顧客情報', short: '顧客', icon: IconCustomers },
  { href: '/meetings', label: 'アポを記録', short: 'アポ', icon: IconMeetings },
  { href: '/actions', label: '次回行動', short: '行動', icon: IconActions },
  { href: '/members', label: 'チームの傾向', short: '傾向', icon: IconMembers },
  { href: '/knowledge', label: '自社営業知識', short: '知識', icon: IconKnowledge },
  { href: '/profile', label: '自分の設定', short: '設定', icon: IconProfile },
  { href: '/admin', label: 'メンバー管理', short: '管理', icon: IconAdmin, adminOnly: true },
];

/** モバイルのボトムタブに常時出す4件。残りは「その他」にまとめる。 */
export const TAB_HREFS = ['/', '/customers', '/meetings', '/actions'];

export function linksFor(user: PublicUser): NavLink[] {
  return NAV_LINKS.filter((link) => !link.adminOnly || user.role === 'admin');
}

export function isActive(pathname: string, link: NavLink): boolean {
  return link.exact ? pathname === link.href : pathname.startsWith(link.href);
}

/** 現在地の画面名。モバイルの上部バーに出す。 */
export function currentTitle(pathname: string): string {
  const match = [...NAV_LINKS]
    .filter((link) => !link.exact)
    .find((link) => pathname.startsWith(link.href));
  return match ? match.label : 'Ocean AI';
}
