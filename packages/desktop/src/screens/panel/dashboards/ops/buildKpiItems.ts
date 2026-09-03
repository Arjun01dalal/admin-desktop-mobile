import type { DashboardMode, KpiItem, OpsDashboardBundle } from './types';
import { floorNum, toNum, pickNum } from './mergeMetrics';
import { KPI_MAP, NAV_MAP } from './jyotishMapping';

/** Laxmi StatCards for these KPIs use Math.round (not floor). */
function roundNum(value: unknown): number {
  return Math.round(toNum(value));
}

function navCards(startDate: string, endDate: string): KpiItem[] {
  const dateState = { startDate, endDate };
  return [
    {
      id: 'masterData',
      label: NAV_MAP.masterData.jyotish,
      value: '',
      headingOnly: true,
      href: '/masterDashboard',
      state: { selectActiveCustomers: true },
    },
    {
      id: 'liveMatchTotal',
      label: NAV_MAP.liveMatchTotal.jyotish,
      value: '',
      headingOnly: true,
      href: '/liveMatchTotal',
      state: dateState,
    },
  ];
}

/** Build KPI tiles — full KPIs on main; Panchang/Gochar nav on VIP only. */
export function buildKpiItems(
  mode: DashboardMode,
  bundle: OpsDashboardBundle | null,
  startDate: string,
  endDate: string,
  today: string,
): KpiItem[] {
  if (mode === 'vip') {
    return navCards(startDate, endDate);
  }
  // Combined: provider cards only — no Master Data / Live Match Total / Active Exchange KPIs.
  if (mode === 'combined') return [];

  if (mode !== 'main' || !bundle) return [];

  const s = bundle.summary;
  const dw = bundle.depositWithdrawal;
  const dc = bundle.depositCount;

  const liability =
    toNum(s.falconTotalBetPendingAmount) +
    toNum(s.jetfairTotalBetPendingAmount) +
    toNum(s.sattaMatkaTotalBetPendingAmount);

  // Laxmi: payload.count from /User/get-active-customers (not providerWise sum)
  const todaysActiveCustomers = floorNum(bundle.todaysActiveCount);

  const dateState = { startDate, endDate };

  const items: KpiItem[] = [
    {
      id: 'totalDeposit',
      label: 'Total Deposits',
      value: floorNum(dw.totalDeposit ?? s.totalDeposit),
      prefix: '₹',
    },
    {
      id: 'totalWithdrawal',
      label: KPI_MAP.totalWithdrawal.jyotish,
      value: floorNum(dw.totalRefund ?? s.totalRefund ?? dw.totalWithdrawal ?? s.totalWithdrawal),
      prefix: '₹',
    },
    {
      id: 'totalPendingWithdrawal',
      label: KPI_MAP.totalPendingWithdrawal.jyotish,
      value: floorNum(dw.totalPendingWithdrawal ?? s.totalPendingWithdrawal),
      prefix: '₹',
    },
    {
      id: 'instantDeposit',
      label: 'Total Instant Deposit',
      value: floorNum(dw.instantDeposit ?? s.instantDeposit),
      prefix: '₹',
    },
    {
      id: 'usersBalance',
      label: 'Total Users Balance',
      // Laxmi: Math.round(dashboardPayload.totalBalanceOfUsers)
      value: roundNum(pickNum(s, ['totalBalanceOfUsers'])),
      prefix: '₹',
      href: '/balance-f',
    },
    {
      id: 'bonusBalance',
      label: 'Total Users Bonus Balance',
      // Laxmi: Math.round(dashboardPayload.totalBonusBalanceOfUsers)
      value: roundNum(pickNum(s, ['totalBonusBalanceOfUsers'])),
      prefix: '₹',
      href: '/total-bonus-users-p',
    },
    {
      id: 'totalUsers',
      label: 'Total Users',
      value: floorNum(s.totalRegisterUsers),
    },
    {
      id: 'regWeb',
      label: 'Total Registered Users Web',
      value: floorNum(s.totalRegisterUsersOfWeb),
    },
    {
      id: 'regApp',
      label: 'Total Registered Users App',
      value: floorNum(s.totalRegisterUsersOfApp),
    },
    {
      id: 'regToday',
      label: 'Total Registered Users Today',
      value: floorNum(s.totalTodayRegisterUsers),
      href: '/new-registers',
    },
    {
      id: 'regWebToday',
      label: 'Total Registered Users Web Today',
      value: floorNum(s.totalTodayRegisterUsersOfWeb),
    },
    {
      id: 'regAppToday',
      label: 'Total Registered Users App Today',
      value: floorNum(s.totalTodayRegisterUsersOfApp),
      href: '/registered-users',
    },
    {
      id: 'active7d',
      label: 'Last 7 days Active Users',
      // Laxmi: Math.round(dashboardPayload.totalActiveUsers)
      value: roundNum(pickNum(s, ['totalActiveUsers'])),
    },
    {
      id: 'active7dApp',
      label: 'Last 7 Days Active Users App',
      // Laxmi: Math.round(dashboardPayload.totalActiveUsersApp)
      value: roundNum(pickNum(s, ['totalActiveUsersApp'])),
    },
    {
      id: 'nonPerforming',
      label: 'Total Non Performing Users',
      // Laxmi: Math.round(payload.total) from /User/nonPerformingUser
      value: roundNum(bundle.nonPerformingUserCount),
      href: '/non_performing_user',
    },
    {
      id: 'liability',
      label: 'Liability',
      value: floorNum(liability),
      prefix: '₹',
    },
    {
      id: 'bonusGiven',
      label: 'Total Bonus Given',
      value: floorNum(s.totalBonusGiven),
      prefix: '₹',
    },
    {
      id: 'ftdAmount',
      label: 'FTD Amount',
      value: floorNum(dc.ftdAmount),
      prefix: '₹',
    },
    {
      id: 'ftdCount',
      label: 'FTD Count',
      value: floorNum(dc.ftdCount),
    },
    {
      id: 'stdAmount',
      label: 'STD Amount',
      value: floorNum(dc.stdAmount),
      prefix: '₹',
    },
    {
      id: 'stdCount',
      label: 'STD Count',
      value: floorNum(dc.stdCount),
    },
    {
      id: 'depositCount',
      label: 'Deposit Count',
      value: floorNum(dc.depositCount),
    },
  ];

  if (todaysActiveCustomers > 0) {
    items.push({
      id: 'todaysActive',
      label: "Today's Active Users",
      value: todaysActiveCustomers,
      href: '/users',
      state: { selectActiveCustomers: true, ...dateState },
    });
  }

  items.push(...navCards(startDate, endDate));

  if (startDate !== today) {
    items.splice(3, 0, {
      id: 'balancePrev',
      label: `User Balance (Date:-${startDate})`,
      // Laxmi StatCard shows raw balance (no Math.round) — keep parity via round for display consistency with Total Users Balance.
      value: roundNum(bundle.prevDayBalance),
      prefix: '₹',
    });
  }

  return items;
}
