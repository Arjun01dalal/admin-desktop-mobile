import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { ITEMS_PER_PAGE_OPTIONS } from '@/utils/pagination';
import { cn } from '@/lib/utils';

const fieldCls =
  'h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type LabelProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, children, className }: LabelProps) {
  return (
    <label className={cn('flex min-w-[140px] flex-col gap-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function DateField({ label, value, onChange, className }: DateFieldProps) {
  return (
    <Field label={label} className={className}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldCls}
      />
    </Field>
  );
}

type SelectFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  placeholder?: string;
};

export function SelectField({
  label,
  value,
  onChange,
  options,
  className,
  placeholder,
}: SelectFieldProps) {
  const select = (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(fieldCls, 'min-w-[140px]', className)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
  if (!label) return select;
  return <Field label={label}>{select}</Field>;
}

type PageSizeFieldProps = {
  value: number;
  onChange: (value: number) => void;
  options?: readonly string[];
};

export function PageSizeField({
  value,
  onChange,
  options = ITEMS_PER_PAGE_OPTIONS,
}: PageSizeFieldProps) {
  return (
    <SelectField
      label="Items Per Page"
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={options.map((opt) => ({ value: opt, label: opt }))}
    />
  );
}

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
  className?: string;
};

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search',
  className,
}: SearchInputProps) {
  return (
    <Input
      value={value}
      placeholder={placeholder}
      className={cn('h-8 min-w-[120px] bg-background', className)}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch?.();
      }}
    />
  );
}

type ApplyButtonProps = {
  onClick: () => void;
  loading?: boolean;
  label?: string;
};

export function ApplyButton({ onClick, loading, label = 'Apply' }: ApplyButtonProps) {
  return (
    <Button onClick={onClick} disabled={loading} className="self-end">
      {label}
    </Button>
  );
}

type PagerProps = {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled?: boolean;
  total?: number;
};

export function ReportPager({ page, totalPages, onChange, disabled, total }: PagerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {typeof total === 'number' ? (
        <p className="text-sm text-muted-foreground">Total: {total}</p>
      ) : (
        <span />
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
