import type { ComponentProps } from 'react';
import { TablePanel } from '@/components/TablePanel';

/** User Report tables — taller viewport fit with less bottom padding. */
export function UserReportTablePanel(props: ComponentProps<typeof TablePanel>) {
  return <TablePanel bottomGap={4} fallbackSubtract={168} {...props} />;
}
