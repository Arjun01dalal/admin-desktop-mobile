import { TextField } from '@mui/material';
import { createTableFiltersContext } from '@/components/createTableFiltersContext';
import { filterFieldSx } from './styles';
import type { KycFilters } from './types';

export type KycFiltersCtx = {
  draftFilters: KycFilters;
  setDraftField: (key: keyof KycFilters) => (value: string) => void;
  search: () => void;
};

export const { Provider: KycFiltersProvider, useFilters: useKycFilters } =
  createTableFiltersContext<KycFiltersCtx>('KycFilters');

function ColumnSearch({
  value,
  onChange,
  onSearch,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  placeholder: string;
}) {
  return (
    <TextField
      size="small"
      fullWidth
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearch();
      }}
      sx={filterFieldSx}
    />
  );
}

export function KycColumnFilter({
  field,
  placeholder,
}: {
  field: keyof KycFilters;
  placeholder: string;
}) {
  const { draftFilters, setDraftField, search } = useKycFilters();
  return (
    <ColumnSearch
      value={draftFilters[field]}
      onChange={setDraftField(field)}
      onSearch={search}
      placeholder={placeholder}
    />
  );
}
