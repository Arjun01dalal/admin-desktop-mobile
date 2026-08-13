/**
 * Panel detail routes — maps desktop href paths (carried on KPI / provider
 * card models) to mobile detail screens pushed on the root stack.
 */
import React from 'react';
import { LiveMatchTotalScreen } from '../screens/dashboards/details/LiveMatchTotalScreen';
import { BothMasterAddScreen } from '../screens/dashboards/details/BothMasterAddScreen';
import { FalconRateManagementScreen } from '../screens/dashboards/details/FalconRateManagementScreen';
import { ExchangeRateManagementScreen } from '../screens/dashboards/details/ExchangeRateManagementScreen';
import { MasterDashboardScreen } from '../screens/dashboards/details/MasterDashboardScreen';
import { DashboardUsersListScreen } from '../screens/dashboards/details/DashboardUsersListScreen';
import { TodaysActiveScreen } from '../screens/dashboards/details/TodaysActiveScreen';
import { NewRegistersScreen } from '../screens/dashboards/details/NewRegistersScreen';
import { GameActivityScreen } from '../screens/dashboards/details/GameActivityScreen';
import { PlayerActivityDetailsScreen } from '../screens/dashboards/details/PlayerActivityDetailsScreen';
import { GameActivityDetailsScreen } from '../screens/dashboards/details/GameActivityDetailsScreen';
import { BetConstructGamesScreen } from '../screens/dashboards/details/BetConstructGamesScreen';
import { LeaderboardCustomerListScreen } from '../screens/dashboards/details/LeaderboardCustomerListScreen';
import { UserReportScreen } from '../screens/UserReportScreen';
import { CallerDepositListScreen } from '../screens/dashboards/details/CallerDepositListScreen';
import { ActiveUserDataScreen } from '../screens/dashboards/details/ActiveUserDataScreen';
import { MidGroupsScreen } from '../screens/dashboards/details/MidGroupsScreen';

export type PanelDetailParams = Record<string, unknown>;

export type PanelDetailTarget = {
  href?: string;
  state?: Record<string, unknown>;
  /** Query string, e.g. `?startDate=…&type=falcon`. */
  search?: string;
};

export type PanelDetailRoute = {
  /** Desktop route path — also used as the stack screen name. */
  path: string;
  title: string;
  Component: React.ComponentType<Record<string, unknown>>;
};

export const PANEL_DETAIL_ROUTES: PanelDetailRoute[] = [
  {
    path: '/liveMatchTotal',
    title: 'Live Match Total',
    Component: () => <LiveMatchTotalScreen variant="laxmi" />,
  },
  {
    path: '/masterLiveMatchTotal',
    title: 'Live Match Total (Master)',
    Component: () => <LiveMatchTotalScreen variant="master" />,
  },
  {
    path: '/bothLiveMatchTotal',
    title: 'Live Match Total (Master & Laxmi)',
    Component: () => <LiveMatchTotalScreen variant="both" />,
  },
  {
    path: '/bothMasterAddPage',
    title: 'AAA & Master AAA Books',
    Component: BothMasterAddScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/falconRateManagement',
    title: 'Falcon Rate Management',
    Component: FalconRateManagementScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/exchangeRateManagement',
    title: 'Exchange Rate Management',
    Component: ExchangeRateManagementScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/activeUserData',
    title: 'Active User Data',
    Component: ActiveUserDataScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/masterDashboard',
    title: 'Master Dashboard',
    Component: MasterDashboardScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/balance-f',
    title: 'Users Balance',
    Component: () => <DashboardUsersListScreen kind="balance" />,
  },
  {
    path: '/total-bonus-users-p',
    title: 'Users Bonus Balance',
    Component: () => <DashboardUsersListScreen kind="bonus" />,
  },
  {
    path: '/registered-users',
    title: 'Registered Users (App, Today)',
    Component: () => <DashboardUsersListScreen kind="registered" />,
  },
  {
    path: '/todays-active',
    title: "Today's Active Users",
    Component: TodaysActiveScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/new-registers',
    title: 'New Registration',
    Component: NewRegistersScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/game-activity',
    title: 'Games Activity',
    Component: GameActivityScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/player-activity/details',
    title: 'Player Activity Details',
    Component: PlayerActivityDetailsScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/game-activity/details',
    title: 'Game Activity Details',
    Component: GameActivityDetailsScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/betConstructGamesList',
    title: 'BetConstruct Games',
    Component: BetConstructGamesScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/leaderboardCustomerCount',
    title: 'Caller Customers',
    Component: LeaderboardCustomerListScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/user-report',
    title: 'User Report',
    Component: UserReportScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/caller-responsibility/deposit-list',
    title: 'Caller Deposit List',
    Component: CallerDepositListScreen as PanelDetailRoute['Component'],
  },
  {
    path: '/funds/mid-groups',
    title: 'MID Groups',
    Component: MidGroupsScreen as PanelDetailRoute['Component'],
  },
];

const ROUTES_BY_PATH = new Map(PANEL_DETAIL_ROUTES.map((r) => [r.path, r]));

/** True when a card target resolves to an implemented mobile detail screen. */
export function canOpenPanelPath(href?: string): boolean {
  return !!href && ROUTES_BY_PATH.has(href);
}

/** Merge `search` query params and router `state` into one params object. */
export function mergeTargetParams(target: PanelDetailTarget): PanelDetailParams {
  const params: PanelDetailParams = {};
  if (target.search) {
    const qs = target.search.startsWith('?') ? target.search.slice(1) : target.search;
    new URLSearchParams(qs).forEach((value, key) => {
      params[key] = value;
    });
  }
  if (target.state) Object.assign(params, target.state);
  return params;
}

/**
 * Open the mobile detail screen matching a card target.
 * Returns false when the href has no mobile screen (card stays inert).
 */
export function openPanelTarget(
  navigation: { navigate: (name: string, params?: PanelDetailParams) => void },
  target: PanelDetailTarget,
): boolean {
  if (!target.href || !ROUTES_BY_PATH.has(target.href)) return false;
  navigation.navigate(target.href, mergeTargetParams(target));
  return true;
}
