import { useMemo } from 'react';
import { Box, Button } from '@mui/material';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { BOT_STATUS_KEYS, BOT_STATUS_LABELS } from './constants';
import { buildBotSummaryRows, type BotSummaryRow } from './utils';

type BotStatusTableProps = {
  botSummary: Record<string, unknown>;
  loading: boolean;
  actionLoading: boolean;
  onReinitiateDeleted: (botId: number) => void;
};

export function BotStatusTable({
  botSummary,
  loading,
  actionLoading,
  onReinitiateDeleted,
}: BotStatusTableProps) {
  const botSummaryRows = useMemo(() => buildBotSummaryRows(botSummary), [botSummary]);

  const botSummaryColumns = useMemo<CommonTableColumn<BotSummaryRow>[]>(
    () => [
      {
        id: 'sr',
        label: 'SR.No',
        width: 64,
        render: (_row, index) => index + 1,
      },
      {
        id: 'botId',
        label: 'Bot ID',
        width: 72,
        render: (row) => row.botId,
      },
      ...BOT_STATUS_KEYS.map((key) => {
        const isDeleted = key === 'deleted';
        return {
          id: key,
          label: BOT_STATUS_LABELS[key],
          width: isDeleted ? 168 : 88,
          cellSx: isDeleted
            ? {
                whiteSpace: 'normal',
                minWidth: 160,
                maxWidth: 180,
                overflow: 'hidden',
                px: 1,
              }
            : undefined,
          render: (row: BotSummaryRow) => {
            const count = row[key];
            if (isDeleted && count > 0) {
              return (
                <Button
                  size="small"
                  variant="outlined"
                  disabled={actionLoading}
                  onClick={() => void onReinitiateDeleted(row.botId)}
                  sx={{
                    maxWidth: '100%',
                    minWidth: 0,
                    px: 1,
                    py: 0.5,
                    fontSize: 11,
                    lineHeight: 1.25,
                    whiteSpace: 'normal',
                    textTransform: 'none',
                  }}
                >
                  Reinit {count}
                </Button>
              );
            }
            return count;
          },
        };
      }),
      {
        id: 'state',
        label: 'State',
        width: 72,
        cellSx: { whiteSpace: 'nowrap', minWidth: 64 },
        render: (row) => row.state || '-',
      },
    ],
    [actionLoading, onReinitiateDeleted],
  );

  if (botSummaryRows.length === 0) return null;

  return (
    <Box mb={2} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <CommonTable
        columns={botSummaryColumns}
        rows={botSummaryRows}
        getRowKey={(row) => row.botId}
        loading={loading}
        emptyMessage="No bot summary"
        dense
        virtualize={false}
      />
    </Box>
  );
}
