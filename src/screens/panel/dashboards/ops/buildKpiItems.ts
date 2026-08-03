import type { DashboardMode, KpiItem, OpsDashboardBundle } from './types';
import { floorNum, toNum } from './mergeMetrics';

/** Build KPI tiles for main Dashboard (VIP/Combined skip KPIs). */
export function buildKpiItems(
  mode: DashboardMode,
  bundle: OpsDashboardBundle | null,
  startDate: string,
  today: string,
): KpiItem[] {
  if (mode !== 'main' || !bundle) return [];

  const s = bundle.summary;
  const dw = bundle.depositWithdrawal;
  const dc = bundle.depositCount;

  const liability =
    toNum(s.falconTotalBetPendingAmount) +
    toNum(s.jetfairTotalBetPendingAmount) +
    toNum(s.sattaMatkaTotalBetPendingAmount);

  const items: KpiItem[] = [
    {
      id: 'totalDeposit',
      label: 'Total Deposits',
      value: floorNum(dw.totalDeposit ?? s.totalDeposit),
      prefix: '₹',
    },
    {
      id: 'totalWithdrawal',
      label: 'Total Withdrawals',
      value: floorNum(dw.totalWithdrawal ?? s.totalWithdrawal),
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
      value: floorNum(s.totalBalanceOfUsers),
      prefix: '₹',
    },
    {
      id: 'bonusBalance',
      label: 'Total Users Bonus Balance',
      value: floorNum(s.totalBonusBalanceOfUsers),
      prefix: '₹',
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
    },
    {
      id: 'active7d',
      label: 'Last 7 days Active Users',
      value: floorNum(s.totalActiveUsers),
    },
    {
      id: 'active7dApp',
      label: 'Last 7 Days Active Users App',
      value: floorNum(s.totalActiveUsersApp),
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
    {
      id: 'masterData',
      label: 'Master Data',
      value: '',
      headingOnly: true,
      href: '/master-flow',
    },
    {
      id: 'liveMatchTotal',
      label: 'Live Match Total',
      value: '',
      headingOnly: true,
      href: '/risk-dashboard',
    },
  ];

  if (startDate !== today) {
    items.splice(3, 0, {
      id: 'balancePrev',
      label: `User Balance (Date:-${startDate})`,
      value: floorNum(s.balance),
      prefix: '₹',
    });
  }

  return items;
}
