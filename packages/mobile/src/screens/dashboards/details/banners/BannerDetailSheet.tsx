import React, { useMemo } from 'react';
import { RowDetailSheet, type SheetAction, type SheetField } from '../RowDetailSheet';
import type { DataTableColumn } from '../../../../dashboards/ui/DataTable';
import { replaceS3WithCloudfront } from '../../../../utils/cdnUrl';
import { display, type Row } from './helpers';

type Props = {
  row: Row | null;
  columns: DataTableColumn<Row>[];
  actions: SheetAction[];
  onClose: () => void;
};

export function BannerDetailSheet({ row, columns, actions, onClose }: Props) {
  const fields = useMemo<SheetField[]>(
    () =>
      row
        ? columns
            .filter((column) => column.key !== 'idx')
            .map((column) => ({
              label: column.label,
              value: column.render(row, 0),
              multiline: column.key === 'imagePath',
            }))
        : [],
    [columns, row],
  );

  return (
    <RowDetailSheet
      visible={row !== null}
      title={row ? display(row.gameName) : ''}
      imageUri={row?.imagePath ? replaceS3WithCloudfront(row.imagePath) : undefined}
      fields={fields}
      actions={actions}
      onClose={onClose}
    />
  );
}
