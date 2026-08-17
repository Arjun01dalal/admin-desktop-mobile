type Props = {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
};

const inputCls =
  'h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartChange(e.target.value)}
        className={inputCls}
        aria-label="Start date"
      />
      <span>to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndChange(e.target.value)}
        className={inputCls}
        aria-label="End date"
      />
    </div>
  );
}
