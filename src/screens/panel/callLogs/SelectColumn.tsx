import { Checkbox } from '@mui/material';
import { useCallLogsSelection } from './SelectionContext';
import type { CallLogRow } from './types';

/** Header checkbox — reads selection from context (not column memo deps). */
export function SelectAllCheckbox() {
  const { allSelected, indeterminate, toggleAll } = useCallLogsSelection();
  return (
    <Checkbox
      size="small"
      checked={allSelected}
      indeterminate={indeterminate}
      onChange={toggleAll}
    />
  );
}

/** Row checkbox — selection updates do not rebuild column definitions. */
export function SelectRowCheckbox({ row }: { row: CallLogRow }) {
  const { selectedSids, toggleRow } = useCallLogsSelection();
  const id = String(row.call_sid || '');
  return (
    <Checkbox
      size="small"
      checked={id ? selectedSids.has(id) : false}
      onChange={() => toggleRow(id)}
      disabled={!id}
    />
  );
}
