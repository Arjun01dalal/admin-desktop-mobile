/**
 * Menu hub categories — built from NavItem.category on accessible items.
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import type { NavItem } from './navItems';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/** Display order for Menu hub category cards. */
export const NAV_CATEGORY_ORDER = [
  'Dashboards',
  'Caller & Dialer',
  'Users & Activity',
  'Games',
  'Payments & Funds',
  'Reports',
  'Ops & Settings',
] as const;

export type NavCategoryId = (typeof NAV_CATEGORY_ORDER)[number];

/** Short labels + Material icon for Menu grid tiles. */
export const NAV_CATEGORY_META: Record<
  NavCategoryId,
  { title: string; subtitle: string; icon: MaterialIconName }
> = {
  Dashboards: {
    title: 'Dashboards',
    subtitle: 'KPI & risk views',
    icon: 'dashboard',
  },
  'Caller & Dialer': {
    title: 'Caller & Dialer',
    subtitle: 'Calls & campaigns',
    icon: 'phone-in-talk',
  },
  'Users & Activity': {
    title: 'Users & Activity',
    subtitle: 'Players & reports',
    icon: 'people',
  },
  Games: {
    title: 'Games',
    subtitle: 'Casino & lists',
    icon: 'sports-esports',
  },
  'Payments & Funds': {
    title: 'Payments & Funds',
    subtitle: 'Deposit & payout',
    icon: 'account-balance-wallet',
  },
  Reports: {
    title: 'Reports',
    subtitle: 'Coins & downloads',
    icon: 'assessment',
  },
  'Ops & Settings': {
    title: 'Ops & Settings',
    subtitle: 'Config & tools',
    icon: 'settings',
  },
};

export type NavCategoryGroup = {
  id: NavCategoryId;
  title: string;
  subtitle: string;
  icon: MaterialIconName;
  items: NavItem[];
};

/** Group accessible nav items (excludes Menu / welcome hub). */
export function groupNavItemsByCategory(items: NavItem[]): NavCategoryGroup[] {
  const byCat = new Map<string, NavItem[]>();
  for (const item of items) {
    if (item.id === 'welcome') continue;
    const cat = String(item.category || 'Ops & Settings').trim() || 'Ops & Settings';
    const list = byCat.get(cat) ?? [];
    list.push(item);
    byCat.set(cat, list);
  }

  const groups: NavCategoryGroup[] = [];
  for (const id of NAV_CATEGORY_ORDER) {
    const list = byCat.get(id);
    if (!list?.length) continue;
    const meta = NAV_CATEGORY_META[id];
    groups.push({
      id,
      title: meta.title,
      subtitle: meta.subtitle,
      icon: meta.icon,
      items: list,
    });
  }

  // Any unexpected category names (future sync) — append at end.
  for (const [cat, list] of byCat) {
    if ((NAV_CATEGORY_ORDER as readonly string[]).includes(cat)) continue;
    if (!list.length) continue;
    groups.push({
      id: cat as NavCategoryId,
      title: cat,
      subtitle: `${list.length} items`,
      icon: 'folder',
      items: list,
    });
  }

  return groups;
}
