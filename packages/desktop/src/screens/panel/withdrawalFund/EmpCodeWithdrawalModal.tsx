import { useEffect, useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { fieldSx, orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { AgentEmpCountRow, CountRow } from './getWithdrawalSummaryByEmpCode';

type DateFilterProps = {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  onApply: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  totalWithdrawals: number;
  agentRows: CountRow[];
  empCodeRows: CountRow[];
  /** Agent × EmpCode counts (current month / agent details). */
  agentEmpRows?: AgentEmpCountRow[];
  /** Optional subtitle (e.g. current-month date range). */
  subtitle?: string;
  /** When true, lists are replaced by a centered loader. */
  loading?: boolean;
  /** From/To + Apply for Current Month Emp Code Report. */
  dateFilter?: DateFilterProps | null;
};

type PanelKind = 'agents' | 'emp' | 'agentEmp';

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        flex: '1 1 120px',
        minWidth: 110,
        px: 1.5,
        py: 1.1,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        backgroundImage: accent
          ? `linear-gradient(135deg, ${accent}18 0%, transparent 70%)`
          : undefined,
      }}
    >
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          color: 'text.secondary',
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          mt: 0.35,
          fontSize: 22,
          fontWeight: 800,
          lineHeight: 1.15,
          color: accent || 'text.primary',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#b45309' : 'transparent';
  const color = rank <= 3 ? '#111' : 'text.secondary';
  return (
    <Box
      sx={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: 11,
        fontWeight: 800,
        bgcolor: tone === 'transparent' ? 'action.hover' : tone,
        color,
        flexShrink: 0,
      }}
    >
      {rank}
    </Box>
  );
}

function CountList({
  rows,
  emptyLabel,
  nameHeader,
}: {
  rows: CountRow[];
  emptyLabel: string;
  nameHeader: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  if (!rows.length) {
    return (
      <Box
        sx={{
          py: 5,
          px: 2,
          textAlign: 'center',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
          {emptyLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 1.75,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Typography sx={{ width: 36, fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
          #
        </Typography>
        <Typography sx={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
          {nameHeader}
        </Typography>
        <Typography
          sx={{
            width: 72,
            textAlign: 'right',
            fontSize: 11,
            fontWeight: 700,
            color: 'text.secondary',
          }}
        >
          Count
        </Typography>
      </Stack>

      <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {rows.map((row, index) => {
          const rank = index + 1;
          const pct = Math.round((row.count / max) * 100);
          return (
            <Box
              key={`${row.name}-${index}`}
              sx={{
                px: 1.75,
                py: 1.15,
                borderBottom: index < rows.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <RankBadge rank={rank} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="baseline"
                    spacing={1}
                  >
                    <Typography
                      noWrap
                      title={row.name}
                      sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}
                    >
                      {row.name}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 14, fontWeight: 800, color: '#ff9f0a', flexShrink: 0 }}
                    >
                      {row.count}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      mt: 0.75,
                      height: 6,
                      borderRadius: 99,
                      bgcolor: 'action.selected',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 99,
                        bgcolor: rank <= 3 ? '#ff9f0a' : '#42a5f5',
                      },
                    }}
                  />
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function AgentEmpCountList({ rows }: { rows: AgentEmpCountRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));

  if (!rows.length) {
    return (
      <Box
        sx={{
          py: 5,
          px: 2,
          textAlign: 'center',
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Typography color="text.secondary" sx={{ fontSize: 13 }}>
          No agent / emp code data found
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{
          px: 1.75,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Typography sx={{ width: 36, fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
          #
        </Typography>
        <Typography sx={{ flex: 1.2, fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
          Agent
        </Typography>
        <Typography sx={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'text.secondary' }}>
          Emp code
        </Typography>
        <Typography
          sx={{
            width: 72,
            textAlign: 'right',
            fontSize: 11,
            fontWeight: 700,
            color: 'text.secondary',
          }}
        >
          Count
        </Typography>
      </Stack>

      <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
        {rows.map((row, index) => {
          const rank = index + 1;
          const pct = Math.round((row.count / max) * 100);
          return (
            <Box
              key={`${row.agentName}-${row.empCode}-${index}`}
              sx={{
                px: 1.75,
                py: 1.15,
                borderBottom: index < rows.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <RankBadge rank={rank} />
                <Typography
                  sx={{ flex: 1.2, minWidth: 0, fontSize: 13, fontWeight: 700 }}
                  noWrap
                  title={row.agentName}
                >
                  {row.agentName}
                </Typography>
                <Typography
                  sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#66bb6a' }}
                  noWrap
                  title={row.empCode}
                >
                  {row.empCode}
                </Typography>
                <Typography sx={{ width: 72, textAlign: 'right', fontSize: 13, fontWeight: 800 }}>
                  {row.count}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  mt: 0.85,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { bgcolor: '#ab47bc', borderRadius: 2 },
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** Agent + Emp Code withdrawal counts — polished Withdrawal Fund modal. */
export function EmpCodeWithdrawalModal({
  open,
  onClose,
  title,
  totalWithdrawals,
  agentRows,
  empCodeRows,
  agentEmpRows = [],
  subtitle,
  loading = false,
  dateFilter = null,
}: Props) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'));
  const [tab, setTab] = useState<PanelKind>('agentEmp');

  useEffect(() => {
    if (open) setTab(agentEmpRows.length ? 'agentEmp' : 'agents');
  }, [open, agentEmpRows.length]);

  const agentTotal = useMemo(() => agentRows.reduce((s, r) => s + r.count, 0), [agentRows]);
  const empTotal = useMemo(() => empCodeRows.reduce((s, r) => s + r.count, 0), [empCodeRows]);
  const agentEmpTotal = useMemo(
    () => agentEmpRows.reduce((s, r) => s + r.count, 0),
    [agentEmpRows],
  );

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        },
      }}
    >
      <DialogTitle
        sx={{
          py: 1.75,
          px: 2.5,
          pr: 6,
          borderBottom: '1px solid',
          borderColor: 'divider',
          background: (t) =>
            t.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,159,10,0.12) 0%, transparent 100%)'
              : 'linear-gradient(180deg, rgba(255,159,10,0.14) 0%, #fff 100%)',
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.25, pr: 1 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography sx={{ mt: 0.5, fontSize: 12.5, color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        ) : null}
        <IconButton
          aria-label="Close"
          onClick={onClose}
          size="small"
          disabled={loading}
          sx={{
            position: 'absolute',
            right: 12,
            top: 12,
            color: 'text.secondary',
            bgcolor: 'action.hover',
            '&:hover': { bgcolor: 'action.selected' },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, py: 2.25 }}>
        {dateFilter ? (
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="flex-end"
            flexWrap="wrap"
            useFlexGap
            mt={1.5}
            mb={2}
          >
            <TextField
              size="small"
              type="date"
              label="From Date"
              InputLabelProps={{ shrink: true }}
              value={dateFilter.startDate}
              onChange={(e) => dateFilter.onStartChange(e.target.value)}
              disabled={loading}
              sx={{ ...fieldSx, width: 180, minWidth: 180 }}
            />
            <TextField
              size="small"
              type="date"
              label="To Date"
              InputLabelProps={{ shrink: true }}
              value={dateFilter.endDate}
              onChange={(e) => dateFilter.onEndChange(e.target.value)}
              disabled={loading}
              sx={{ ...fieldSx, width: 180, minWidth: 180 }}
            />
            <Button
              variant="contained"
              disabled={loading || !dateFilter.startDate || !dateFilter.endDate}
              onClick={() => dateFilter.onApply()}
              sx={orangeBtnSx}
            >
              Apply
            </Button>
          </Stack>
        ) : null}

        {loading ? (
          <Stack alignItems="center" justifyContent="center" py={8} spacing={1.5}>
            <CircularProgress size={36} sx={{ color: '#ff9f0a' }} />
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Loading report…</Typography>
          </Stack>
        ) : (
          <>
            <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap" mb={2.25}>
              <StatPill label="Total withdrawals" value={totalWithdrawals} accent="#ff9f0a" />
              <StatPill label="Agents" value={agentRows.length} accent="#42a5f5" />
              <StatPill label="Emp codes" value={empCodeRows.length} accent="#66bb6a" />
              <StatPill label="Agent × Emp" value={agentEmpRows.length} accent="#ab47bc" />
            </Stack>

            {isNarrow ? (
              <>
                <Tabs
                  value={tab}
                  onChange={(_e, v: PanelKind) => setTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    mb: 1.5,
                    minHeight: 40,
                    '& .MuiTab-root': {
                      minHeight: 40,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                    },
                    '& .Mui-selected': { color: '#ff9f0a !important' },
                    '& .MuiTabs-indicator': { bgcolor: '#ff9f0a' },
                  }}
                >
                  <Tab
                    value="agentEmp"
                    icon={<BadgeOutlinedIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label={`Agent × Emp (${agentEmpRows.length})`}
                  />
                  <Tab
                    value="agents"
                    icon={<GroupsOutlinedIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label={`Agents (${agentRows.length})`}
                  />
                  <Tab
                    value="emp"
                    icon={<BadgeOutlinedIcon sx={{ fontSize: 18 }} />}
                    iconPosition="start"
                    label={`Emp codes (${empCodeRows.length})`}
                  />
                </Tabs>
                {tab === 'agentEmp' ? (
                  <AgentEmpCountList rows={agentEmpRows} />
                ) : tab === 'agents' ? (
                  <CountList
                    rows={agentRows}
                    nameHeader="Agent name"
                    emptyLabel="No agent data found"
                  />
                ) : (
                  <CountList
                    rows={empCodeRows}
                    nameHeader="Emp code"
                    emptyLabel="No emp code data found"
                  />
                )}
              </>
            ) : (
              <Stack spacing={2.5}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} mb={1.25}>
                    <BadgeOutlinedIcon sx={{ fontSize: 18, color: '#ab47bc' }} />
                    <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Agent × Emp code</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                      · {agentEmpTotal} withdrawals · who gave how many per empCode
                    </Typography>
                  </Stack>
                  <AgentEmpCountList rows={agentEmpRows} />
                </Box>
                <Stack direction="row" spacing={2} alignItems="stretch">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.25}>
                      <GroupsOutlinedIcon sx={{ fontSize: 18, color: '#42a5f5' }} />
                      <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Agent wise</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        · {agentTotal} withdrawals
                      </Typography>
                    </Stack>
                    <CountList
                      rows={agentRows}
                      nameHeader="Agent name"
                      emptyLabel="No agent data found"
                    />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={1.25}>
                      <BadgeOutlinedIcon sx={{ fontSize: 18, color: '#66bb6a' }} />
                      <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Emp code wise</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                        · {empTotal} withdrawals
                      </Typography>
                    </Stack>
                    <CountList
                      rows={empCodeRows}
                      nameHeader="Emp code"
                      emptyLabel="No emp code data found"
                    />
                  </Box>
                </Stack>
              </Stack>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          py: 1.75,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
        }}
      >
        <Button
          onClick={onClose}
          variant="contained"
          disabled={loading}
          sx={{ ...orangeBtnSx, minWidth: 110 }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
