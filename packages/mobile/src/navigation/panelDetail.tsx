/**
 * Panel detail routes — maps desktop href paths (carried on KPI / provider
 * card models) to mobile detail screens pushed on the root stack.
 * Screen modules load lazily via getComponent on first navigation.
 */
import React from 'react';
import { canAccessNavItem, Permissions, type Permission } from '../auth/permissions';
import type { AuthUser } from '../types/auth';
import {
  mergeTargetParams,
  type PanelDetailParams,
  type PanelDetailTarget,
} from './panelTargetParams';

export type { PanelDetailParams, PanelDetailTarget };
export { mergeTargetParams };

export type PanelDetailRoute = {
  /** Desktop route path — also used as the stack screen name. */
  path: string;
  title: string;
  /** Lazy factory — require() runs on first open. */
  getComponent: () => React.ComponentType<Record<string, unknown>>;
};

const DETAIL_PERMISSION_BY_PATH: Readonly<Record<string, Permission>> = {
  '/liveMatchTotal': Permissions.View_Dashboard,
  '/masterLiveMatchTotal': Permissions.View_Dashboard,
  '/bothLiveMatchTotal': Permissions.View_Dashboard,
  '/bothMasterAddPage': Permissions.View_Dashboard,
  '/falconRateManagement': Permissions.View_Dashboard,
  '/exchangeRateManagement': Permissions.View_Dashboard,
  '/activeUserData': Permissions.View_Dashboard,
  '/masterDashboard': Permissions.View_Dashboard,
  '/balance-f': Permissions.View_Dashboard,
  '/total-bonus-users-p': Permissions.View_Dashboard,
  '/registered-users': Permissions.View_Dashboard,
  '/users': Permissions.View_Users,
  '/todays-active': Permissions.todays_active,
  '/played-today-yesterday': Permissions.View_Dashboard,
  '/new-registers': Permissions.new_registrations,
  '/game-activity': Permissions.game_activity,
  '/player-activity/details': Permissions.player_activity,
  '/game-activity/details': Permissions.game_activity,
  '/game-activity/user-stats': Permissions.game_activity,
  '/betConstructGamesList': Permissions.View_Games,
  '/nandi-platform': Permissions.View_Dashboard,
  '/ludo-user-ggr-by-round': Permissions.house_game,
  '/ludo-player-wise-rtp': Permissions.house_game,
  '/leaderboardCustomerCount': Permissions.caller_leaderboard_tab,
  '/gtel-calls': Permissions.show_gtel_calls,
  '/user-report': Permissions.View_Users,
  '/user_exposure': Permissions.View_Users,
  '/bonus-wallet-referral-earning': Permissions.View_Users,
  '/caller-responsibility/deposit-list': Permissions.caller_responsibility,
  '/caller-responsibility/details': Permissions.caller_responsibility,
  '/caller-responsibility/bot-users': Permissions.caller_responsibility,
  '/funds/mid-groups': Permissions.Deposit_Config,
};

function named(
  mod: Record<string, unknown>,
  exportName: string,
): React.ComponentType<Record<string, unknown>> {
  const Comp = mod[exportName];
  if (typeof Comp !== 'function') {
    throw new Error(`panelDetail: missing export ${exportName}`);
  }
  return Comp as React.ComponentType<Record<string, unknown>>;
}

const detailCache = new Map<string, React.ComponentType<Record<string, unknown>>>();

function lazyOnce(
  key: string,
  factory: () => React.ComponentType<Record<string, unknown>>,
): () => React.ComponentType<Record<string, unknown>> {
  return () => {
    const hit = detailCache.get(key);
    if (hit) return hit;
    const Comp = factory();
    detailCache.set(key, Comp);
    return Comp;
  };
}

export const PANEL_DETAIL_ROUTES: PanelDetailRoute[] = [
  {
    path: '/liveMatchTotal',
    title: 'Live Match Total',
    getComponent: lazyOnce('/liveMatchTotal', () => {
      const { LiveMatchTotalScreen } = require('../screens/dashboards/details/LiveMatchTotalScreen');
      return function LiveMatchLaxmi() {
        return <LiveMatchTotalScreen variant="laxmi" />;
      };
    }),
  },
  {
    path: '/masterLiveMatchTotal',
    title: 'Live Match Total (Master)',
    getComponent: lazyOnce('/masterLiveMatchTotal', () => {
      const { LiveMatchTotalScreen } = require('../screens/dashboards/details/LiveMatchTotalScreen');
      return function LiveMatchMaster() {
        return <LiveMatchTotalScreen variant="master" />;
      };
    }),
  },
  {
    path: '/bothLiveMatchTotal',
    title: 'Live Match Total (Master & Laxmi)',
    getComponent: lazyOnce('/bothLiveMatchTotal', () => {
      const { LiveMatchTotalScreen } = require('../screens/dashboards/details/LiveMatchTotalScreen');
      return function LiveMatchBoth() {
        return <LiveMatchTotalScreen variant="both" />;
      };
    }),
  },
  {
    path: '/bothMasterAddPage',
    title: 'AAA & Master AAA Books',
    getComponent: lazyOnce('/bothMasterAddPage', () =>
      named(require('../screens/dashboards/details/BothMasterAddScreen'), 'BothMasterAddScreen'),
    ),
  },
  {
    path: '/falconRateManagement',
    title: 'Falcon Rate Management',
    getComponent: lazyOnce('/falconRateManagement', () =>
      named(
        require('../screens/dashboards/details/FalconRateManagementScreen'),
        'FalconRateManagementScreen',
      ),
    ),
  },
  {
    path: '/exchangeRateManagement',
    title: 'Exchange Rate Management',
    getComponent: lazyOnce('/exchangeRateManagement', () =>
      named(
        require('../screens/dashboards/details/ExchangeRateManagementScreen'),
        'ExchangeRateManagementScreen',
      ),
    ),
  },
  {
    path: '/activeUserData',
    title: 'Active User Data',
    getComponent: lazyOnce('/activeUserData', () =>
      named(require('../screens/dashboards/details/ActiveUserDataScreen'), 'ActiveUserDataScreen'),
    ),
  },
  {
    path: '/masterDashboard',
    title: 'Master Dashboard',
    getComponent: lazyOnce('/masterDashboard', () =>
      named(
        require('../screens/dashboards/details/MasterDashboardScreen'),
        'MasterDashboardScreen',
      ),
    ),
  },
  {
    path: '/balance-f',
    title: 'Users Balance',
    getComponent: lazyOnce('/balance-f', () => {
      const {
        DashboardUsersListScreen,
      } = require('../screens/dashboards/details/DashboardUsersListScreen');
      return function BalanceUsers() {
        return <DashboardUsersListScreen kind="balance" />;
      };
    }),
  },
  {
    path: '/total-bonus-users-p',
    title: 'Users Bonus Balance',
    getComponent: lazyOnce('/total-bonus-users-p', () => {
      const {
        DashboardUsersListScreen,
      } = require('../screens/dashboards/details/DashboardUsersListScreen');
      return function BonusUsers() {
        return <DashboardUsersListScreen kind="bonus" />;
      };
    }),
  },
  {
    path: '/registered-users',
    title: 'Registered Users (App, Today)',
    getComponent: lazyOnce('/registered-users', () => {
      const {
        DashboardUsersListScreen,
      } = require('../screens/dashboards/details/DashboardUsersListScreen');
      return function RegisteredUsers() {
        return <DashboardUsersListScreen kind="registered" />;
      };
    }),
  },
  {
    path: '/users',
    title: 'Users',
    getComponent: lazyOnce('/users', () => named(require('../screens/UsersScreen'), 'UsersScreen')),
  },
  {
    path: '/todays-active',
    title: "Today's Active Users",
    getComponent: lazyOnce('/todays-active', () =>
      named(require('../screens/dashboards/details/TodaysActiveScreen'), 'TodaysActiveScreen'),
    ),
  },
  {
    path: '/played-today-yesterday',
    title: 'Played Today / Yesterday',
    getComponent: lazyOnce('/played-today-yesterday', () =>
      named(
        require('../screens/dashboards/details/PlayedTodayYesterdayScreen'),
        'PlayedTodayYesterdayScreen',
      ),
    ),
  },
  {
    path: '/new-registers',
    title: 'New Registration',
    getComponent: lazyOnce('/new-registers', () =>
      named(require('../screens/dashboards/details/NewRegistersScreen'), 'NewRegistersScreen'),
    ),
  },
  {
    path: '/game-activity',
    title: 'Games Activity',
    getComponent: lazyOnce('/game-activity', () =>
      named(require('../screens/dashboards/details/GameActivityScreen'), 'GameActivityScreen'),
    ),
  },
  {
    path: '/player-activity/details',
    title: 'Player Activity Details',
    getComponent: lazyOnce('/player-activity/details', () =>
      named(
        require('../screens/dashboards/details/PlayerActivityDetailsScreen'),
        'PlayerActivityDetailsScreen',
      ),
    ),
  },
  {
    path: '/game-activity/details',
    title: 'Game Activity Details',
    getComponent: lazyOnce('/game-activity/details', () =>
      named(
        require('../screens/dashboards/details/GameActivityDetailsScreen'),
        'GameActivityDetailsScreen',
      ),
    ),
  },
  {
    path: '/game-activity/user-stats',
    title: 'Game User Stats',
    getComponent: lazyOnce('/game-activity/user-stats', () =>
      named(require('../screens/dashboards/details/GameUserStatsScreen'), 'GameUserStatsScreen'),
    ),
  },
  {
    path: '/betConstructGamesList',
    title: 'BetConstruct Details',
    getComponent: lazyOnce('/betConstructGamesList', () =>
      named(
        require('../screens/dashboards/details/BetConstructGamesListScreen'),
        'BetConstructGamesListScreen',
      ),
    ),
  },
  {
    path: '/nandi-platform',
    title: 'Shatabhisha Platform',
    getComponent: lazyOnce('/nandi-platform', () =>
      named(require('../screens/dashboards/details/NandiPlatformScreen'), 'NandiPlatformScreen'),
    ),
  },
  {
    path: '/ludo-user-ggr-by-round',
    title: 'Ludo User GGR By Round',
    getComponent: lazyOnce('/ludo-user-ggr-by-round', () =>
      named(require('../screens/dashboards/details/LudoUserGgrScreen'), 'LudoUserGgrScreen'),
    ),
  },
  {
    path: '/ludo-player-wise-rtp',
    title: 'Player Wise RTP',
    getComponent: lazyOnce('/ludo-player-wise-rtp', () =>
      named(
        require('../screens/dashboards/details/LudoPlayerWiseRtpScreen'),
        'LudoPlayerWiseRtpScreen',
      ),
    ),
  },
  {
    path: '/leaderboardCustomerCount',
    title: 'Caller Customers',
    getComponent: lazyOnce('/leaderboardCustomerCount', () =>
      named(
        require('../screens/dashboards/details/LeaderboardCustomerListScreen'),
        'LeaderboardCustomerListScreen',
      ),
    ),
  },
  {
    path: '/gtel-calls',
    title: 'Gtel Calls',
    getComponent: lazyOnce('/gtel-calls', () =>
      named(require('../screens/dashboards/details/GtelCallsScreen'), 'GtelCallsScreen'),
    ),
  },
  {
    path: '/user-report',
    title: 'User Report',
    getComponent: lazyOnce('/user-report', () =>
      named(require('../screens/UserReportScreen'), 'UserReportScreen'),
    ),
  },
  {
    path: '/user_exposure',
    title: 'User Exposure',
    getComponent: lazyOnce('/user_exposure', () =>
      named(require('../screens/UserExposureScreen'), 'UserExposureScreen'),
    ),
  },
  {
    path: '/bonus-wallet-referral-earning',
    title: 'Bonus Earning',
    getComponent: lazyOnce('/bonus-wallet-referral-earning', () =>
      named(require('../screens/BonusEarningScreen'), 'BonusEarningScreen'),
    ),
  },
  {
    path: '/caller-responsibility/deposit-list',
    title: 'Caller Deposit List',
    getComponent: lazyOnce('/caller-responsibility/deposit-list', () =>
      named(
        require('../screens/dashboards/details/CallerDepositListScreen'),
        'CallerDepositListScreen',
      ),
    ),
  },
  {
    path: '/caller-responsibility/details',
    title: 'Caller Details',
    getComponent: lazyOnce('/caller-responsibility/details', () =>
      named(require('../screens/dashboards/details/CallerDetailsScreen'), 'CallerDetailsScreen'),
    ),
  },
  {
    path: '/caller-responsibility/bot-users',
    title: 'Active Bot Users',
    getComponent: lazyOnce('/caller-responsibility/bot-users', () =>
      named(require('../screens/dashboards/details/ActiveBotUsersScreen'), 'ActiveBotUsersScreen'),
    ),
  },
  {
    path: '/funds/mid-groups',
    title: 'MID Groups',
    getComponent: lazyOnce('/funds/mid-groups', () =>
      named(require('../screens/dashboards/details/MidGroupsScreen'), 'MidGroupsScreen'),
    ),
  },
];

const ROUTES_BY_PATH = new Map(PANEL_DETAIL_ROUTES.map((r) => [r.path, r]));

/**
 * Detail routes are registered on the root stack, so menu filtering alone
 * cannot protect them from deep links or stale navigation state.
 */
export function canAccessPanelDetail(path: string, user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  // Caller Dashboard → Calls uses the same Gtel Calls screen; allow either perm.
  if (path === '/gtel-calls') {
    return (
      canAccessNavItem({ id: 'detail:/gtel-calls', permission: Permissions.show_gtel_calls }, user) ||
      canAccessNavItem(
        { id: 'detail:/gtel-calls-dash', permission: Permissions.show_gtel_dashboard },
        user,
      )
    );
  }
  const permission = DETAIL_PERMISSION_BY_PATH[path];
  if (!permission) return false;
  return canAccessNavItem({ id: `detail:${path}`, permission }, user);
}

/**
 * True when a card target resolves to an implemented mobile detail screen
 * the user is allowed to open (route + responsibility).
 */
export function canOpenPanelPath(href?: string, user?: AuthUser | null): boolean {
  if (!href || !ROUTES_BY_PATH.has(href)) return false;
  return canAccessPanelDetail(href, user ?? null);
}

/**
 * Open the mobile detail screen matching a card target.
 * Returns false when the href has no mobile screen (card stays inert).
 */
export function openPanelTarget(
  navigation: {
    navigate: (name: string, params?: PanelDetailParams) => void;
    getParent?: () => unknown;
  },
  target: PanelDetailTarget,
): boolean {
  if (!target.href || !ROUTES_BY_PATH.has(target.href)) return false;
  const params = mergeTargetParams(target);

  type NavNode = {
    navigate: (name: string, params?: PanelDetailParams) => void;
    getParent?: () => unknown;
  };

  let nav: NavNode | null = navigation;
  let root: NavNode = navigation;
  while (nav) {
    root = nav;
    const parent: unknown = nav.getParent?.();
    nav = parent && typeof parent === 'object' ? (parent as NavNode) : null;
  }
  root.navigate(target.href, params);
  return true;
}
