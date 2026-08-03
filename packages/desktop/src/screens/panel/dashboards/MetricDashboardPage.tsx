import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { SecureAction } from '@/api/secureActions';
import { PanelPage } from './PanelPage';
import { DateRangeFilter } from './DateRangeFilter';
import { StatCard } from './StatCard';
import { useSecureQuery } from './useSecureQuery';
import { formatAmount, formatInt, pick, todayISO, toNumber } from './format';

export type MetricConfig = {
  label: string;
  /** Dot-path into the response object. */
  field: string;
  icon?: LucideIcon;
  format?: 'int' | 'amount';
  /** Colour the value green/red based on sign. */
  signed?: boolean;
};

type Props = {
  title: string;
  description?: string;
  action: SecureAction;
  metrics: MetricConfig[];
  /** Extra payload fields sent alongside the date range. */
  basePayload?: Record<string, unknown>;
  showDateFilter?: boolean;
};

function formatValue(raw: unknown, format?: MetricConfig['format']): string {
  return format === 'amount' ? formatAmount(raw) : formatInt(raw);
}

/**
 * Config-driven metrics page shared by the Dashboards & Analytics group.
 * Each page just supplies its secure action + metric mapping.
 */
export function MetricDashboardPage({
  title,
  description,
  action,
  metrics,
  basePayload,
  showDateFilter = true,
}: Props) {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());

  const payload = showDateFilter
    ? { startDate, endDate, ...basePayload }
    : { ...basePayload };

  const { data, loading, error, refetch } = useSecureQuery<Record<string, unknown>>(
    action,
    payload,
  );

  return (
    <PanelPage
      title={title}
      description={description}
      loading={loading}
      error={error}
      onRefresh={refetch}
      actions={
        showDateFilter && (
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onStartChange={setStartDate}
            onEndChange={setEndDate}
          />
        )
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metrics.map((m) => {
          const raw = pick(data, m.field);
          const accent = m.signed
            ? toNumber(raw) >= 0
              ? 'positive'
              : 'negative'
            : 'default';
          return (
            <StatCard
              key={m.field + m.label}
              label={m.label}
              icon={m.icon}
              loading={loading && data === null}
              accent={accent}
              value={formatValue(raw, m.format)}
            />
          );
        })}
      </div>
    </PanelPage>
  );
}
