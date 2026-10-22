/**
 * Gtel Caller Dashboard — desktop UI parity with web admin CallerDashboard.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CallerDashDispositionModal } from '@/screens/panel/gtel/CallerDashDispositionModal';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import { CallerDashAllotmentModal } from '@/screens/panel/gtel/CallerDashAllotmentModal';
import { useGtelCallerDashboard } from '@/screens/panel/gtel/useGtelCallerDashboard';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { CallerDashCallsModal } from '@/screens/panel/gtel/CallerDashCallsModal';
import { CallerDashListModal } from '@/screens/panel/gtel/CallerDashListModal';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import type { GtelCallerDashCard, GtelCallerDashRow } from '@astro/shared';
import { dashToneColor, useDashPalette } from '@/screens/panel/gtel/tones';
import { CallerDashCharts } from '@/screens/panel/gtel/CallerDashCharts';
import { CallerDashTable } from '@/screens/panel/gtel/CallerDashTable';
import { PanelAccessDenied } from '@/components/PanelAccessDenied';
import { GtelKpiCards } from '@/screens/panel/gtel/GtelKpiCards';
import { useGtelAuth } from '@/screens/panel/gtel/useGtelAuth';
import { fieldSx } from '@/screens/panel/transactions/shared';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { todayIST } from '@/utils/dates';
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';


type ViewMode = 'chart' | 'table';

const loadBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 800,
  height: 40,
  px: 2,
  bgcolor: 'success.main',
  color: 'success.contrastText',
  '&:hover': { bgcolor: 'success.dark' },
};

export function GtelCallerDashboardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const palette = useDashPalette();
  const { canShowGtelDashboard, lockEmpCode, loginEmpCode } = useGtelAuth();

  const initialFrom = params.get('from')?.trim() || todayIST();
  const initialTo = params.get('to')?.trim() || todayIST();
  const initialEmp = lockEmpCode ? loginEmpCode : params.get('empCode')?.trim() || '';

  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [draftEmp, setDraftEmp] = useState(initialEmp);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [empCode, setEmpCode] = useState(initialEmp);
  /** Chart = tabbed one-chart; Table = all charts stacked. */
  const [view, setView] = useState<ViewMode>('table');
  const [showGraphs, setShowGraphs] = useState(false);
  const [dispRow, setDispRow] = useState<GtelCallerDashRow | null>(null);
  const [campaignRow, setCampaignRow] = useState<GtelCallerDashRow | null>(null);
  const [allotRow, setAllotRow] = useState<GtelCallerDashRow | null>(null);
  const [callsModal, setCallsModal] = useState<{
    name: string;
    empCode: string;
  } | null>(null);

  const { cards, callers, loading, error } = useGtelCallerDashboard({ from, to, empCode });

  const campaignItems = useMemo(
    () =>
      (campaignRow?.campaignActive || []).map((label) => ({
        label,
      })),
    [campaignRow],
  );

  const kpiCards = useMemo(
    () =>
      cards.map((card: GtelCallerDashCard) => ({
        key: card.key,
        label: card.label,
        value: card.value,
        accent: dashToneColor(palette, card.tone, card.key),
      })),
    [cards, palette],
  );

  const applyFilters = useCallback(() => {
    setFrom(draftFrom);
    setTo(draftTo);
    setEmpCode(lockEmpCode ? loginEmpCode : draftEmp);
  }, [draftEmp, draftFrom, draftTo, lockEmpCode, loginEmpCode]);

  const resetFilters = useCallback(() => {
    const today = todayIST();
    const emp = lockEmpCode ? loginEmpCode : '';
    setDraftFrom(today);
    setDraftTo(today);
    setDraftEmp(emp);
    setFrom(today);
    setTo(today);
    setEmpCode(emp);
  }, [lockEmpCode, loginEmpCode]);

  const openCalls = useCallback((row: GtelCallerDashRow) => {
    const code = String(row.empCode || '').trim();
    if (!code || code === '—') return;
    setCallsModal({ name: row.name || '—', empCode: code });
  }, []);

  if (!canShowGtelDashboard) {
    return <PanelAccessDenied title="Caller Dashboard" />;
  }

  return (
    <Box
      sx={{
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        minHeight: 0,
        height: '100%',
        overflow: 'auto',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={900}>
            Caller Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Dialer caller stats, dispositions, campaign & allotment overview
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/gtel-calls')}
          sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
        >
          Back to Gtel Calls
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          <TextField
            label="From (IST)"
            type="date"
            size="small"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...fieldSx, width: 160 }}
          />
          <TextField
            label="To (IST)"
            type="date"
            size="small"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ ...fieldSx, width: 160 }}
          />
          <TextField
            label="Emp Code"
            size="small"
            placeholder="e.g. 036"
            value={draftEmp}
            disabled={lockEmpCode}
            onChange={(e) => setDraftEmp(e.target.value)}
            sx={{ ...fieldSx, width: 140 }}
          />
          <Button
            variant="contained"
            startIcon={<DashboardCustomizeOutlinedIcon />}
            sx={loadBtnSx}
            disabled={loading}
            onClick={applyFilters}
          >
            Load
          </Button>
          <Button variant="outlined" disabled={loading} onClick={resetFilters}>
            Reset
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={
              showGraphs ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />
            }
            onClick={() => setShowGraphs((v) => !v)}
            sx={{ textTransform: 'none', fontWeight: 700, height: 40 }}
          >
            {showGraphs ? 'Hide graphs' : 'Show graphs'}
          </Button>
          {showGraphs ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={view}
              onChange={(_, next: ViewMode | null) => {
                if (next) setView(next);
              }}
              sx={{ ml: { sm: 'auto' } }}
            >
              <ToggleButton value="chart" sx={{ textTransform: 'none', fontWeight: 700, px: 1.5 }}>
                Chart
              </ToggleButton>
              <ToggleButton value="table" sx={{ textTransform: 'none', fontWeight: 700, px: 1.5 }}>
                Table
              </ToggleButton>
            </ToggleButtonGroup>
          ) : null}
        </Stack>
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            {error}
          </Typography>
        ) : null}
      </Paper>

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={800}>
            Totals
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {cards.length} metrics
          </Typography>
        </Stack>
        <GtelKpiCards cards={kpiCards} />
      </Box>

      {showGraphs ? (
        <CallerDashCharts rows={callers} mode={view === 'chart' ? 'tabs' : 'stack'} />
      ) : null}

      <Box>
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
          Caller table
        </Typography>
        <Box sx={{ minHeight: 320 }}>
          <CallerDashTable
            rows={callers}
            loading={loading}
            onOpenDisposition={setDispRow}
            onOpenCalls={openCalls}
            onOpenActiveCampaigns={setCampaignRow}
            onOpenAllotment={setAllotRow}
          />
        </Box>
      </Box>

      <CallerDashDispositionModal row={dispRow} onClose={() => setDispRow(null)} />
      <CallerDashListModal
        open={Boolean(campaignRow)}
        title="Active Campaigns"
        subtitle={
          campaignRow
            ? `${campaignRow.name || '—'}${campaignRow.empCode ? ` (${campaignRow.empCode})` : ''}`
            : undefined
        }
        items={campaignItems}
        emptyMessage="No active campaigns for this caller."
        onClose={() => setCampaignRow(null)}
      />
      <CallerDashAllotmentModal row={allotRow} onClose={() => setAllotRow(null)} />
      <CallerDashCallsModal
        open={Boolean(callsModal)}
        name={callsModal?.name || ''}
        empCode={callsModal?.empCode || ''}
        from={from.trim() || todayIST()}
        to={to.trim() || todayIST()}
        onClose={() => setCallsModal(null)}
      />
    </Box>
  );
}
