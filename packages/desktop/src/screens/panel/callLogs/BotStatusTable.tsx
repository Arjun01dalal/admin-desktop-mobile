/**
 * Compact Bot Status summary for Call Logs.
 * Clear short labels (no Jyotish remap), hide empty columns, soft dark-theme chrome.
 */
import { useMemo, useState } from 'react';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { BOT_STATUS_KEYS } from './constants';
import { buildBotSummaryRows, type BotSummaryRow } from './utils';

type BotStatusTableProps = {
  botSummary: Record<string, unknown>;
  loading: boolean;
  actionLoading: boolean;
  onReinitiate: (
    targets: Array<{ botId: number; status: 'deleted' | 'failed' | 'no-answer' }>,
  ) => void;
};

const REINIT_STATUSES = ['failed', 'deleted', 'no-answer'] as const;

type StatusKey = (typeof BOT_STATUS_KEYS)[number];

/** Short ops-friendly headers (avoid Jyotish remap for metric columns). */
const SHORT_LABELS: Record<StatusKey, string> = {
  'no-answer': 'No Ans',
  completed: 'Done',
  'in-progress': 'Active',
  failed: 'Fail',
  busy: 'Busy',
  queued: 'Queue',
  deleted: 'Del',
};

const TONE: Record<
  StatusKey,
  { fg: string; bg: string; head: string }
> = {
  'no-answer': { fg: '#ff8a80', bg: 'rgba(255,138,128,0.12)', head: '#ffab91' },
  completed: { fg: '#69f0ae', bg: 'rgba(105,240,174,0.12)', head: '#69f0ae' },
  'in-progress': { fg: '#80d8ff', bg: 'rgba(128,216,255,0.12)', head: '#80d8ff' },
  failed: { fg: '#ff8a80', bg: 'rgba(255,138,128,0.12)', head: '#ff8a80' },
  busy: { fg: '#ffe57f', bg: 'rgba(255,229,127,0.12)', head: '#ffe57f' },
  queued: { fg: '#b0bec5', bg: 'rgba(176,190,197,0.1)', head: '#cfd8dc' },
  deleted: { fg: '#ce93d8', bg: 'rgba(206,147,216,0.12)', head: '#ce93d8' },
};

const headSx = {
  bgcolor: 'rgba(255,159,10,0.92)',
  color: '#1a1200',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: 0.2,
  py: 0.6,
  px: 0.75,
  border: 'none',
  borderRight: '1px solid rgba(0,0,0,0.12)',
  textAlign: 'center' as const,
  whiteSpace: 'nowrap' as const,
  lineHeight: 1.2,
  top: 0,
};

const cellSx = {
  fontSize: 12,
  py: 0.4,
  px: 0.75,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  borderRight: '1px solid rgba(255,255,255,0.04)',
  textAlign: 'center' as const,
  whiteSpace: 'nowrap' as const,
  lineHeight: 1.2,
};

function CountCell({
  statusKey,
  count,
}: {
  statusKey: StatusKey;
  count: number;
}) {
  const tone = TONE[statusKey];
  if (count <= 0) {
    return (
      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.28)', fontSize: 12 }}>
        0
      </Typography>
    );
  }
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        minWidth: 28,
        px: 0.75,
        py: 0.15,
        borderRadius: 1,
        bgcolor: tone.bg,
        color: tone.fg,
        fontWeight: 700,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {count.toLocaleString('en-IN')}
    </Box>
  );
}

export function BotStatusTable({
  botSummary,
  loading,
  actionLoading,
  onReinitiate,
}: BotStatusTableProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const rows = useMemo(() => buildBotSummaryRows(botSummary), [botSummary]);

  const visibleKeys = useMemo(() => {
    return BOT_STATUS_KEYS.filter((key) => rows.some((r) => Number(r[key]) > 0));
  }, [rows]);

  const showState = useMemo(
    () => rows.some((r) => r.state && r.state !== '-'),
    [rows],
  );

  const totals = useMemo(() => {
    const acc = {} as Record<StatusKey, number>;
    for (const key of BOT_STATUS_KEYS) acc[key] = 0;
    for (const row of rows) {
      for (const key of BOT_STATUS_KEYS) acc[key] += Number(row[key]) || 0;
    }
    return acc;
  }, [rows]);

  const availableTargets = useMemo(
    () =>
      rows.flatMap((row) =>
        REINIT_STATUSES.filter((status) => Number(row[status]) > 0).map((status) => ({
          key: `${row.botId}:${status}`,
          botId: row.botId,
          status,
        })),
      ),
    [rows],
  );
  const selectedTargets = availableTargets.filter((target) => selected.has(target.key));
  const allSelected =
    availableTargets.length > 0 && selectedTargets.length === availableTargets.length;

  const toggleTarget = (key: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(
      allSelected ? new Set() : new Set(availableTargets.map((target) => target.key)),
    );
  };

  const reinitiateSelected = () => {
    if (!selectedTargets.length) return;
    onReinitiate(
      selectedTargets.map(({ botId, status }) => ({ botId, status })),
    );
    setSelected(new Set());
  };

  if (!loading && rows.length === 0) return null;

  // Show full status matrix when open (not only non-empty columns).
  const keysToShow =
    visibleKeys.length > 0 ? BOT_STATUS_KEYS : (['completed', 'failed', 'no-answer'] as StatusKey[]);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1.5,
        bgcolor: 'rgba(26,26,31,0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{
          px: 1.5,
          py: 0.65,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: open ? '1px solid rgba(255,255,255,0.08)' : 'none',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0 }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#f0f0f2' }}>
            Bot Status
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
            {rows.length} bot{rows.length === 1 ? '' : 's'}
          </Typography>
          {keysToShow.slice(0, 4).map((key) =>
            totals[key] > 0 ? (
              <Chip
                key={key}
                size="small"
                label={`${SHORT_LABELS[key]} ${totals[key].toLocaleString('en-IN')}`}
                sx={{
                  height: 22,
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: TONE[key].bg,
                  color: TONE[key].fg,
                  border: 'none',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            ) : null,
          )}
          {availableTargets.length > 0 ? (
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={selectedTargets.length > 0 && !allSelected}
                disabled={actionLoading}
                onClick={(event) => event.stopPropagation()}
                onChange={toggleAll}
                inputProps={{ 'aria-label': 'Select all reinitiate statuses' }}
                sx={{ p: 0.25, color: '#ff9f0a' }}
              />
              <Typography variant="caption" color="text.secondary">
                Select all
              </Typography>
            </Stack>
          ) : null}
          <Button
            size="small"
            variant="contained"
            color="warning"
            disabled={!selectedTargets.length || actionLoading}
            onClick={(event) => {
              event.stopPropagation();
              reinitiateSelected();
            }}
            sx={{
              minHeight: 28,
              py: 0.25,
              px: 1.25,
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            Reinit Selected ({selectedTargets.length})
          </Button>
        </Stack>
        <IconButton
          size="small"
          aria-label={open ? 'Collapse bot status' : 'Expand bot status'}
          sx={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <TableContainer
          sx={{
            width: '100%',
            maxHeight: 'none',
            overflowX: 'auto',
            overflowY: 'visible',
            bgcolor: 'transparent',
          }}
        >
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headSx, position: 'sticky', left: 0, zIndex: 3, minWidth: 56 }}>
                  Bot
                </TableCell>
                {keysToShow.map((key) => (
                  <TableCell key={key} sx={headSx}>
                    {SHORT_LABELS[key]}
                  </TableCell>
                ))}
                {showState ? <TableCell sx={headSx}>State</TableCell> : null}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row: BotSummaryRow) => (
                <TableRow
                  key={row.botId}
                  hover
                  sx={{
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                    '&:nth-of-type(even)': { bgcolor: 'rgba(255,255,255,0.02)' },
                  }}
                >
                  <TableCell
                    sx={{
                      ...cellSx,
                      fontWeight: 700,
                      color: '#e8e8ea',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      bgcolor: '#1a1a1f',
                      minWidth: 56,
                    }}
                  >
                    {row.botId}
                  </TableCell>
                  {keysToShow.map((key) => {
                    const count = Number(row[key]) || 0;
                    const canReinit =
                      (key === 'deleted' || key === 'failed' || key === 'no-answer') &&
                      count > 0;
                    if (canReinit) {
                      const tone = TONE[key] ?? TONE.deleted;
                      const selectionKey = `${row.botId}:${key}`;
                      return (
                        <TableCell key={key} sx={cellSx}>
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="center"
                            spacing={0.25}
                          >
                            <Checkbox
                              size="small"
                              checked={selected.has(selectionKey)}
                              onChange={() => toggleTarget(selectionKey)}
                              inputProps={{
                                'aria-label': `Select bot ${row.botId} ${key} calls`,
                              }}
                              sx={{
                                p: 0.25,
                                color: tone.fg,
                                '&.Mui-checked': { color: tone.fg },
                              }}
                              disabled={actionLoading}
                            />
                            <Box
                              component="span"
                              sx={{
                                minWidth: 24,
                                color: tone.fg,
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {count.toLocaleString('en-IN')}
                            </Box>
                          </Stack>
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={key} sx={cellSx}>
                        <CountCell statusKey={key} count={count} />
                      </TableCell>
                    );
                  })}
                  {showState ? (
                    <TableCell sx={{ ...cellSx, color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                      {row.state && row.state !== '-' ? row.state : '—'}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Collapse>
    </Paper>
  );
}
