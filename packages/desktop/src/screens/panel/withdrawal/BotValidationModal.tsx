import { useMemo, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { ValidationItem } from './types';

type Props = {
  open: boolean;
  items: ValidationItem[];
  onClose: () => void;
};

const hideScrollbarSx = {
  overflow: 'auto',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
} as const;

const paperSx = {
  borderRadius: 2.5,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
  bgcolor: 'background.paper',
} as const;

const headCellSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 800,
  fontSize: 12.5,
  whiteSpace: 'nowrap',
  borderBottom: 'none',
  py: 1.25,
} as const;

const bodyCellSx = {
  fontSize: 13,
  borderColor: 'divider',
  py: 1.15,
  verticalAlign: 'middle',
} as const;

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
        width: '100%',
        boxSizing: 'border-box',
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        backgroundImage: accent
          ? `linear-gradient(135deg, ${accent}22 0%, transparent 75%)`
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

export function BotValidationModal({ open, items, onClose }: Props) {
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);

  const passedCount = useMemo(
    () => items.filter((item) => Boolean(item.passed)).length,
    [items],
  );
  const failedCount = items.length - passedCount;

  const closeDetails = () => setDetails(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: paperSx }}
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
          <Typography sx={{ fontWeight: 800, fontSize: 18, lineHeight: 1.25 }}>
            Bot Report
          </Typography>
          <Typography sx={{ mt: 0.4, fontSize: 12.5, color: 'text.secondary' }}>
            Validation results for this withdrawal
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={onClose}
            size="small"
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

        <DialogContent
          sx={{
            px: 2.5,
            pb: 2.25,
            // MUI zeroes padding-top when DialogContent follows DialogTitle
            pt: '20px !important',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              columnGap: 2,
              rowGap: 2,
              mb: 2.25,
              width: '100%',
            }}
          >
            <StatPill label="Checks" value={items.length} accent="#ff9f0a" />
            <StatPill label="Passed" value={passedCount} accent="#66bb6a" />
            <StatPill label="Failed" value={failedCount} accent="#ef5350" />
          </Box>

          {!items.length ? (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={1}
              sx={{
                py: 6,
                borderRadius: 2,
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
              <Typography color="text.secondary" fontWeight={600}>
                No validation data
              </Typography>
            </Stack>
          ) : (
            <Box
              sx={{
                ...hideScrollbarSx,
                maxHeight: '60vh',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Point', 'Name', 'Status', 'Reason', 'Details'].map((h) => (
                      <TableCell key={h} sx={headCellSx}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((v, i) => {
                    const passed = Boolean(v.passed);
                    return (
                      <TableRow
                        key={v._id || i}
                        hover
                        sx={{
                          '&:nth-of-type(even)': {
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        <TableCell sx={{ ...bodyCellSx, fontWeight: 700, width: 72 }}>
                          {formatPrimitive(v.point)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, fontWeight: 600, minWidth: 140 }}>
                          {formatPrimitive(v.name)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, width: 110 }}>
                          <Chip
                            size="small"
                            icon={
                              passed ? (
                                <CheckCircleOutlineIcon sx={{ fontSize: '16px !important' }} />
                              ) : (
                                <CancelOutlinedIcon sx={{ fontSize: '16px !important' }} />
                              )
                            }
                            label={passed ? 'Passed' : 'Failed'}
                            sx={{
                              fontWeight: 700,
                              fontSize: 11,
                              height: 26,
                              bgcolor: passed ? 'rgba(102,187,106,0.16)' : 'rgba(239,83,80,0.16)',
                              color: passed ? '#66bb6a' : '#ef5350',
                              border: '1px solid',
                              borderColor: passed
                                ? 'rgba(102,187,106,0.45)'
                                : 'rgba(239,83,80,0.45)',
                              '& .MuiChip-icon': {
                                color: 'inherit',
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            ...bodyCellSx,
                            whiteSpace: 'normal',
                            maxWidth: 280,
                            color: 'text.secondary',
                          }}
                        >
                          {formatPrimitive(v.reason)}
                        </TableCell>
                        <TableCell sx={{ ...bodyCellSx, width: 72 }}>
                          <Tooltip title="Other details">
                            <IconButton
                              size="small"
                              onClick={() =>
                                setDetails(isRecord(v.details) ? v.details : {})
                              }
                              sx={{
                                bgcolor: '#f1a144',
                                color: '#111',
                                width: 30,
                                height: 30,
                                borderRadius: 1.5,
                                '&:hover': { bgcolor: '#e09030' },
                              }}
                              aria-label="Other details"
                            >
                              <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
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
          <Button variant="contained" onClick={onClose} sx={{ ...orangeBtnSx, minWidth: 110 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={details != null}
        onClose={closeDetails}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: paperSx }}
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
          <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Other Details</Typography>
          <Typography sx={{ mt: 0.4, fontSize: 12.5, color: 'text.secondary' }}>
            Extra fields from this validation check
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={closeDetails}
            size="small"
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
        <DialogContent sx={{ px: 2.5, py: 2.25, mt: 0.5 }}>
          <Box sx={{ ...hideScrollbarSx, maxHeight: '60vh', pr: 0.5 }}>
            <DetailsRenderer details={details} />
          </Box>
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
            variant="contained"
            onClick={closeDetails}
            sx={{ ...orangeBtnSx, minWidth: 110 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DetailsRenderer({ details }: { details: Record<string, unknown> | null }) {
  if (!details || !Object.keys(details).length) {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={1}
        sx={{
          py: 5,
          borderRadius: 2,
          border: '1px dashed',
          borderColor: 'divider',
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 26, color: 'text.secondary' }} />
        <Typography color="text.secondary" fontWeight={600}>
          No Details
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={0.5}>
      {Object.entries(details).map(([key, value]) => (
        <NestedValue key={key} label={key} value={value} />
      ))}
    </Stack>
  );
}

function NestedValue({ label, value }: { label: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <Box sx={{ mt: 0.5, mb: 0.75 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        {value.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            —
          </Typography>
        ) : (
          value.map((entry, i) => (
            <Box
              key={i}
              sx={{
                ml: 0.5,
                mt: 0.75,
                p: 1.25,
                border: '1px dashed',
                borderColor: 'divider',
                borderRadius: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              {isRecord(entry) ? (
                Object.entries(entry).map(([k, v]) => (
                  <NestedValue key={k} label={k} value={v} />
                ))
              ) : (
                <Typography variant="body2">{formatPrimitive(entry)}</Typography>
              )}
            </Box>
          ))
        )}
      </Box>
    );
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    return (
      <Box sx={{ mt: 0.5, mb: 0.75 }}>
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Box
          sx={{
            ml: 0.5,
            p: 1.25,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            bgcolor: 'background.paper',
          }}
        >
          {keys.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          ) : (
            keys.map((k) => <NestedValue key={k} label={k} value={value[k]} />)
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-start"
      sx={{
        py: 0.65,
        px: 1,
        borderRadius: 1,
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Typography
        variant="body2"
        fontWeight={700}
        sx={{ minWidth: 120, color: 'text.secondary', flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {formatPrimitive(value)}
      </Typography>
    </Stack>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatPrimitive(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}
