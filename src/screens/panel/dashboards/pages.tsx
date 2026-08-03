import { Users, UserPlus, Wallet, Percent } from 'lucide-react';
import { OpsDashboardPage } from './ops';
import { RiskAnalysisPage } from './ops/RiskAnalysisPage';
import { MetricDashboardPage } from './MetricDashboardPage';

/**
 * Dashboard / VIP / Combined — shared OpsDashboardPage (laxminarayan port).
 * Risk Analysis — RiskManagementDashobard port.
 * Analytics still uses the lighter MetricDashboardPage shell.
 */

export function DashboardPage() {
  return <OpsDashboardPage mode="main" />;
}

export function VipDashboardPage() {
  return <OpsDashboardPage mode="vip" />;
}

export function CombinedDashboardPage() {
  return <OpsDashboardPage mode="combined" />;
}

export function RiskDashboardPage() {
  return <RiskAnalysisPage />;
}

export function AnalyticsPage() {
  return (
    <MetricDashboardPage
      title="Analytics"
      description="User balance and engagement analytics."
      action="analytics.userBalance"
      metrics={[
        { label: 'Active Users', field: 'activeUsers', icon: Users, format: 'int' },
        {
          label: 'Total Balance',
          field: 'totalBalance',
          icon: Wallet,
          format: 'amount',
        },
        {
          label: 'Avg Balance',
          field: 'averageBalance',
          icon: Percent,
          format: 'amount',
        },
        {
          label: 'Deposit Users',
          field: 'depositUsers',
          icon: UserPlus,
          format: 'int',
        },
      ]}
    />
  );
}

export { MasterFlowPage } from './MasterFlowPage';
export { ProfitLossPage } from './ProfitLossPage';
