import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  loading?: boolean;
  accent?: 'default' | 'positive' | 'negative';
};

export function StatCard({ label, value, icon: Icon, hint, loading, accent = 'default' }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p
            className={cn(
              'mt-1 text-2xl font-bold tabular-nums',
              accent === 'positive' && 'text-emerald-400',
              accent === 'negative' && 'text-rose-400',
              accent === 'default' && 'text-foreground',
            )}
          >
            {loading ? <span className="text-muted-foreground">…</span> : value}
          </p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
