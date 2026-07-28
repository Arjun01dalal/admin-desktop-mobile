import {
  Users,
  UserPlus,
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  Trophy,
  Gamepad2,
  Landmark,
  ArrowDownUp,
  Percent,
  Activity,
} from 'lucide-react';
import { MetricDashboardPage, type MetricConfig } from './MetricDashboardPage';

/**
 * Metric mappings reference the admin-panel-domains dashboard response shapes.
 * Field paths may need tuning against the live API responses.
 */

const SUMMARY_METRICS: MetricConfig[] = [
  { label: 'Total Users', field: 'totalUserCount', icon: Users, format: 'int' },
  { label: 'Registered Today', field: 'totalUserRegisterToday', icon: UserPlus, format: 'int' },
  { label: 'Total Balance', field: 'totalBalance', icon: Wallet, format: 'amount' },
  { label: 'Liabilities', field: 'liabilities', icon: Coins, format: 'amount' },
  { label: 'Casino Bets', field: 'totalCountCasino', icon: Gamepad2, format: 'int' },
  { label: 'Deposit', field: 'totalDeposit', icon: TrendingUp, format: 'amount' },
  { label: 'Withdrawal', field: 'totalWithdrawal', icon: TrendingDown, format: 'amount' },
  { label: 'Net P/L', field: 'finalWinLoss', icon: ArrowDownUp, format: 'amount', signed: true },
];

export function DashboardPage() {
  return (
    <MetricDashboardPage
      title="Dashboard"
      description="Key platform metrics for the selected date range."
      action="dashboard.summary"
      metrics={SUMMARY_METRICS}
    />
  );
}

export function VipDashboardPage() {
  return (
    <MetricDashboardPage
      title="VIP Dashboard"
      description="High-value customer performance."
      action="dashboard.summary"
      basePayload={{ segment: 'vip' }}
      metrics={[
        { label: 'VIP Users', field: 'totalUserCount', icon: Trophy, format: 'int' },
        { label: 'VIP Balance', field: 'totalBalance', icon: Wallet, format: 'amount' },
        { label: 'VIP Deposit', field: 'totalDeposit', icon: TrendingUp, format: 'amount' },
        { label: 'VIP Withdrawal', field: 'totalWithdrawal', icon: TrendingDown, format: 'amount' },
        { label: 'VIP Net P/L', field: 'finalWinLoss', icon: ArrowDownUp, format: 'amount', signed: true },
      ]}
    />
  );
}

export function CombinedDashboardPage() {
  return (
    <MetricDashboardPage
      title="Combined Dashboard"
      description="Aggregated metrics across all platforms."
      action="dashboard.summary"
      basePayload={{ combined: true }}
      metrics={SUMMARY_METRICS}
    />
  );
}

export function RiskDashboardPage() {
  return (
    <MetricDashboardPage
      title="Risk Dashboard"
      description="Exposure and risk indicators."
      action="dashboard.summary"
      basePayload={{ view: 'risk' }}
      metrics={[
        { label: 'Total Exposure', field: 'exposure', icon: Activity, format: 'amount', signed: true },
        { label: 'Liabilities', field: 'liabilities', icon: Coins, format: 'amount' },
        { label: 'Open Bets', field: 'openBets', icon: Gamepad2, format: 'int' },
        { label: 'Net P/L', field: 'finalWinLoss', icon: ArrowDownUp, format: 'amount', signed: true },
      ]}
    />
  );
}

export function AnalyticsPage() {
  return (
    <MetricDashboardPage
      title="Analytics"
      description="User balance and engagement analytics."
      action="analytics.userBalance"
      metrics={[
        { label: 'Active Users', field: 'activeUsers', icon: Users, format: 'int' },
        { label: 'Total Balance', field: 'totalBalance', icon: Wallet, format: 'amount' },
        { label: 'Avg Balance', field: 'averageBalance', icon: Percent, format: 'amount' },
        { label: 'Deposit Users', field: 'depositUsers', icon: UserPlus, format: 'int' },
      ]}
    />
  );
}

export function MasterFlowPage() {
  return (
    <MetricDashboardPage
      title="Master Flow"
      description="Master-level fund flow overview."
      action="dashboard.summary"
      basePayload={{ view: 'masterFlow' }}
      metrics={[
        { label: 'Total Inflow', field: 'totalDeposit', icon: TrendingUp, format: 'amount' },
        { label: 'Total Outflow', field: 'totalWithdrawal', icon: TrendingDown, format: 'amount' },
        { label: 'Net Flow', field: 'finalWinLoss', icon: ArrowDownUp, format: 'amount', signed: true },
        { label: 'Commission', field: 'totalCommission', icon: Landmark, format: 'amount' },
      ]}
    />
  );
}

export { ProfitLossPage } from './ProfitLossPage';
