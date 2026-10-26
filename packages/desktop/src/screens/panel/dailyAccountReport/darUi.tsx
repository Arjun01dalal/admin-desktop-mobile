import type { ReactNode } from 'react';

import { Button, CircularProgress, MenuItem, TextField } from '@mui/material';

import { dar } from './darStyles';

export function QuickCard({
  title,
  meta,
  actionLabel,
  onClick,
}: {
  title: string;
  meta: string;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={dar.quickCard} onClick={onClick}>
      <span className={dar.quickCardTitle}>{title}</span>
      <span className={dar.quickCardMeta}>{meta}</span>
      <span className={dar.quickCardBtn}>{actionLabel}</span>
    </button>
  );
}

export function PanelShell({
  step,
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: {
  step: number | string;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className={dar.panel}>
      <header className={dar.panelHead}>
        <div className={dar.panelTitle}>
          <div className={dar.step}>{step}</div>
          <div>
            <h2 className={dar.panelHeading}>{title}</h2>
            <p className={dar.panelSub}>{subtitle}</p>
          </div>
        </div>
        <Button className={dar.btn} variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      </header>
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status?: string }) {
  const value = status || 'active';
  return (
    <span className={value === 'inactive' ? dar.pillOff : dar.pillOn}>{value}</span>
  );
}

export function SoftPill({ children }: { children: ReactNode }) {
  return <span className={dar.pillSoft}>{children}</span>;
}

export function Pager({
  total,
  label,
  page,
  pages,
  onPrev,
  onNext,
}: {
  total: number;
  label: string;
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className={dar.pager}>
      <span className={dar.pagerCount}>
        {total} {label}
      </span>
      <div className={dar.pagerControls}>
        <Button className={dar.btnGhost} size="small" disabled={page <= 1} onClick={onPrev}>
          Prev
        </Button>
        <span className={dar.pagerPage}>
          {page} / {pages}
        </span>
        <Button className={dar.btnGhost} size="small" disabled={page >= pages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

export function StatusFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      className={dar.select}
      select
      size="small"
      fullWidth={false}
      label="Status"
      value={value}
      SelectProps={{ displayEmpty: true }}
      onChange={(event) => onChange(event.target.value)}
    >
      <MenuItem value="">All</MenuItem>
      <MenuItem value="active">Active</MenuItem>
      <MenuItem value="inactive">Inactive</MenuItem>
    </TextField>
  );
}

export function StatusField({
  value,
  onChange,
  helperText,
}: {
  value: string;
  onChange: (value: string) => void;
  helperText: string;
}) {
  return (
    <TextField
      className={dar.span2}
      select
      label="Status"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      helperText={helperText}
    >
      <MenuItem value="active">Active</MenuItem>
      <MenuItem value="inactive">Inactive</MenuItem>
    </TextField>
  );
}

export function TableLoader() {
  return (
    <div className={dar.loader}>
      <CircularProgress size={22} className="text-primary" sx={{ color: 'hsl(var(--primary))' }} />
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={dar.empty}>
      <strong className={dar.emptyTitle}>{title}</strong>
      <span className={dar.emptySub}>{subtitle}</span>
    </div>
  );
}
