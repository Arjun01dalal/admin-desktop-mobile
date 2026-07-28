import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PanelPage } from './PanelPage';
import { useSecureQuery } from './useSecureQuery';
import { toNumber } from './format';

type PLRow = {
  _id: string;
  name?: string;
  mobile?: number | string;
  balance?: number;
  deposite?: number;
  betAmount?: number;
  totalProfit?: number;
  withdrawl?: number;
  bonus?: number;
};

type PLResponse = {
  count?: number;
  data?: PLRow[];
  payload?: { count?: number; data?: PLRow[] };
};

const PAGE_SIZES = [10, 25, 50, 75, 100];

function fmt(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Profit & Loss — per-user paginated table (ported from admin-panel-domains). */
export function ProfitLossPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchId, setSearchId] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchMobile, setSearchMobile] = useState('');
  // Filter actually sent to the API (applied on Enter / search click).
  const [filter, setFilter] = useState<Record<string, string>>({});

  const payload = useMemo(
    () => ({ pageSize, pageNumber: page, filter }),
    [pageSize, page, filter],
  );

  const { data, loading, error, refetch } = useSecureQuery<PLResponse>(
    'profitLoss.list',
    payload,
  );

  const body = data?.payload ?? data;
  const rows: PLRow[] = Array.isArray(body?.data) ? body!.data! : [];
  const count = toNumber(body?.count) ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const applyFilter = () => {
    const next: Record<string, string> = {};
    if (searchId.trim()) next._id = searchId.trim();
    if (searchName.trim()) next.name = searchName.trim();
    if (searchMobile.trim()) next.mobile = searchMobile.trim();
    setPage(1);
    setFilter(next);
  };

  const searchProps = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
  ) => (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') applyFilter();
        }}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-input bg-background px-2 pr-7 text-xs font-normal text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="button"
        onClick={applyFilter}
        aria-label="Search"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <PanelPage
      title="Profit & Loss"
      description="Per-user balances, bets, deposits and withdrawals."
      loading={loading}
      error={error}
      onRefresh={refetch}
      actions={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Items per page
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">User ID</th>
              <th className="px-3 py-2 font-medium">User Name</th>
              <th className="px-3 py-2 font-medium">Mobile No</th>
              <th className="px-3 py-2 text-right font-medium">Start Balance</th>
              <th className="px-3 py-2 text-right font-medium">Deposit</th>
              <th className="px-3 py-2 text-right font-medium">Bet Amount</th>
              <th className="px-3 py-2 text-right font-medium">Win Amount</th>
              <th className="px-3 py-2 text-right font-medium">Withdraw</th>
              <th className="px-3 py-2 text-right font-medium">Bonus</th>
              <th className="px-3 py-2 text-right font-medium">End Balance</th>
            </tr>
            <tr className="border-b border-border bg-muted/20">
              <th className="px-3 py-2" />
              <th className="px-3 py-2">{searchProps(searchId, setSearchId, 'Search by user id')}</th>
              <th className="px-3 py-2">{searchProps(searchName, setSearchName, 'Search by name')}</th>
              <th className="px-3 py-2">{searchProps(searchMobile, setSearchMobile, 'Search by mobile')}</th>
              <th colSpan={7} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  No records found.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row._id ?? index}
                  className="border-b border-border/60 transition-colors hover:bg-muted/30"
                >
                  <td className="px-3 py-2 text-muted-foreground">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row._id}</td>
                  <td className="px-3 py-2">{row.name ?? '—'}</td>
                  <td className="px-3 py-2">{row.mobile ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.balance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.deposite)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.betAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.totalProfit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.withdrawl)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.bonus ?? 0)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(row.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {count > 0
            ? `${count.toLocaleString()} records · page ${page} of ${totalPages.toLocaleString()}`
            : 'No records'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-input px-2.5 py-1 text-foreground disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 tabular-nums text-foreground">{page}</span>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-md border border-input px-2.5 py-1 text-foreground disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </PanelPage>
  );
}
