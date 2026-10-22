/** Allotted CX modal — polished detail list (dp_id / name / source / allotedAt). */

import { useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import type { GtelAllottedCxDetail, GtelCallerDashRow } from '@astro/shared';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { alpha, useTheme } from '@mui/material/styles';
import { copyToClipboard } from '@/utils/clipboard';
import CloseIcon from '@mui/icons-material/Close';
import { display } from '@/screens/panel/shared';

import { useDashPalette } from './tones';

type Props = {
  row: GtelCallerDashRow | null;
  onClose: () => void;
};

function formatSource(source?: string): string {
  if (!source) return '—';
  return source
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatAllottedAt(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod');
  if (!day || !month || !year) return value;
  return `${day}-${month}-${year} · ${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ''}`;
}

function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value || value === '—') return null;
  return (
    <Tooltip title={copied ? 'Copied' : 'Copy DP ID'}>
      <IconButton
        size="small"
        aria-label="Copy DP ID"
        onClick={() => {
          void copyToClipboard(value).then((ok) => {
            if (!ok) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          });
        }}
        sx={{
          width: 26,
          height: 26,
          color: 'text.secondary',
          '&:hover': { color: 'text.primary', bgcolor: 'action.hover' },
        }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
}

export function CallerDashAllotmentModal({ row, onClose }: Props) {
  const open = Boolean(row);
  const theme = useTheme();
  const palette = useDashPalette();
  const accent = palette.chart.allot;
  const dark = theme.palette.mode === 'dark';

  const rows = useMemo<GtelAllottedCxDetail[]>(() => {
    if (!row) return [];
    if (row.allottedCxDetails?.length) return row.allottedCxDetails;
    return (row.allottedCx || []).map((label) => ({ name: label }));
  }, [row]);

  const headBg = dark ? alpha(accent, 0.22) : alpha(accent, 0.12);
  const headFg = dark ? '#99f6e4' : '#115e59';
  const rowHover = dark ? alpha('#fff', 0.04) : alpha(accent, 0.04);
  const border = dark ? alpha('#94a3b8', 0.22) : alpha('#0f766e', 0.18);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          border: '1px solid',
          borderColor: border,
          boxShadow: dark
            ? `0 24px 64px ${alpha('#000', 0.55)}`
            : `0 20px 48px ${alpha('#0f172a', 0.18)}`,
        },
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid',
          borderColor: border,
          background: dark
            ? `linear-gradient(135deg, ${alpha(accent, 0.2)} 0%, ${alpha('#0f172a', 0.4)} 100%)`
            : `linear-gradient(135deg, ${alpha(accent, 0.14)} 0%, ${alpha('#fff', 0.9)} 100%)`,
        }}
      >
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(accent, dark ? 0.28 : 0.16),
              color: accent,
              flexShrink: 0,
            }}
          >
            <PeopleAltOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1, pt: 0.15 }}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
              <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2, fontSize: 18 }}>
                Allotted CX
              </Typography>
              <Box
                sx={{
                  px: 1,
                  py: 0.2,
                  borderRadius: 999,
                  bgcolor: alpha(accent, dark ? 0.28 : 0.14),
                  color: headFg,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {rows.length}
              </Box>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }} noWrap>
              {row?.name || '—'}
              {row?.empCode ? ` · ${row.empCode}` : ''}
            </Typography>
          </Box>
          <IconButton
            aria-label="Close"
            onClick={onClose}
            size="small"
            sx={{
              mt: -0.25,
              bgcolor: alpha(theme.palette.text.primary, dark ? 0.08 : 0.04),
              '&:hover': { bgcolor: alpha(theme.palette.text.primary, dark ? 0.14 : 0.08) },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        {rows.length ? (
          <Box sx={{ overflow: 'auto', maxHeight: 460 }}>
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'separate',
                borderSpacing: 0,
                tableLayout: 'fixed',
              }}
            >
              <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <Box component="tr">
                  {['#', 'Name', 'DP ID', 'Source', 'Allotted At'].map((label, i) => (
                    <Box
                      component="th"
                      key={label}
                      sx={{
                        px: 1.5,
                        py: 1.1,
                        textAlign: i === 0 ? 'center' : 'left',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        color: headFg,
                        bgcolor: headBg,
                        borderBottom: `1px solid ${border}`,
                        whiteSpace: 'nowrap',
                        width: i === 0 ? 48 : i === 2 ? '28%' : i === 3 ? '24%' : undefined,
                      }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {rows.map((item, index) => {
                  const dpId = String(item.dp_id || item._id || '').trim();
                  return (
                    <Box
                      component="tr"
                      key={dpId || item.name || index}
                      sx={{
                        '&:hover td': { bgcolor: rowHover },
                        '&:last-of-type td': { borderBottom: 0 },
                      }}
                    >
                      <Box
                        component="td"
                        sx={{
                          px: 1.5,
                          py: 1.35,
                          textAlign: 'center',
                          borderBottom: `1px solid ${border}`,
                          color: 'text.secondary',
                          fontWeight: 700,
                          fontSize: 12,
                          verticalAlign: 'middle',
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 1.5,
                          py: 1.35,
                          borderBottom: `1px solid ${border}`,
                          verticalAlign: 'middle',
                        }}
                      >
                        <Typography
                          fontWeight={700}
                          fontSize={13}
                          noWrap
                          title={display(item.name)}
                          sx={{ textTransform: 'capitalize' }}
                        >
                          {display(item.name)}
                        </Typography>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 1.5,
                          py: 1.35,
                          borderBottom: `1px solid ${border}`,
                          verticalAlign: 'middle',
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                          <Typography
                            component="code"
                            title={dpId || '—'}
                            sx={{
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: 12,
                              color: 'text.secondary',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            {dpId || '—'}
                          </Typography>
                          <CopyIdButton value={dpId} />
                        </Stack>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 1.5,
                          py: 1.35,
                          borderBottom: `1px solid ${border}`,
                          verticalAlign: 'middle',
                        }}
                      >
                        <Box
                          component="span"
                          title={item.source || ''}
                          sx={{
                            display: 'inline-flex',
                            maxWidth: '100%',
                            px: 1,
                            py: 0.35,
                            borderRadius: 999,
                            bgcolor: alpha(accent, dark ? 0.2 : 0.1),
                            color: headFg,
                            border: `1px solid ${alpha(accent, dark ? 0.35 : 0.22)}`,
                            fontSize: 11,
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatSource(item.source)}
                        </Box>
                      </Box>
                      <Box
                        component="td"
                        sx={{
                          px: 1.5,
                          py: 1.35,
                          borderBottom: `1px solid ${border}`,
                          verticalAlign: 'middle',
                          color: 'text.secondary',
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatAllottedAt(item.allotedAt)}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
            <Typography color="text.secondary" fontWeight={600}>
              No allotted CX for this caller.
            </Typography>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
