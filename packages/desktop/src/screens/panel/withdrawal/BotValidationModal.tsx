import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import type { ValidationItem } from './types';

type Props = {
  open: boolean;
  items: ValidationItem[];
  onClose: () => void;
};

const headCellSx = { bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 } as const;

export function BotValidationModal({ open, items, onClose }: Props) {
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Validation Results</DialogTitle>
        <DialogContent>
          {!items.length ? (
            <Typography color="text.secondary">No validation data</Typography>
          ) : (
            <Box sx={{ overflow: 'auto', maxHeight: '70vh' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Point', 'Name', 'Status', 'Reason', 'Other Details'].map((h) => (
                      <TableCell key={h} sx={headCellSx}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((v, i) => (
                    <TableRow key={v._id || i}>
                      <TableCell>{v.point ?? '—'}</TableCell>
                      <TableCell>{v.name ?? '—'}</TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 700,
                          color: v.passed ? '#66bb6a' : '#ef5350',
                        }}
                      >
                        {v.passed ? 'Passed' : 'Failed'}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'normal' }}>{v.reason || '—'}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="contained"
                          sx={{ ...orangeBtnSx, fontSize: 10, height: 26 }}
                          onClick={() => setDetails(v.details || {})}
                        >
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={onClose} sx={orangeBtnSx}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={details != null}
        onClose={() => setDetails(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { bgcolor: 'background.paper' } }}
      >
        <DialogTitle>Other Details</DialogTitle>
        <DialogContent>
          <Box sx={{ maxHeight: '60vh', overflowY: 'auto', pr: 1 }}>
            <DetailsRenderer details={details} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setDetails(null)} sx={orangeBtnSx}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function DetailsRenderer({ details }: { details: Record<string, unknown> | null }) {
  if (!details || !Object.keys(details).length) {
    return <Typography color="text.secondary">No Details</Typography>;
  }

  return (
    <>
      {Object.entries(details).map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <Box key={key} sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={700}>
                {key}:
              </Typography>
              {value.length === 0 ? (
                <Typography variant="body2">—</Typography>
              ) : (
                value.map((entry, index) => (
                  <Box
                    key={index}
                    sx={{
                      mt: 1,
                      p: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    {isRecord(entry) ? (
                      Object.entries(entry).map(([k, v]) => (
                        <NestedValue key={k} label={k} value={v} />
                      ))
                    ) : (
                      <Typography variant="body2">{String(entry)}</Typography>
                    )}
                  </Box>
                ))
              )}
            </Box>
          );
        }

        return (
          <Typography key={key} variant="body2" sx={{ mb: 0.5 }}>
            <strong>{key}:</strong> {formatLeaf(value)}
          </Typography>
        );
      })}
    </>
  );
}

function NestedValue({ label, value }: { label: string; value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="body2" fontWeight={700}>
          {label}:
        </Typography>
        {value.map((entry, i) => (
          <Box
            key={i}
            sx={{
              ml: 1.5,
              mt: 0.5,
              p: 1,
              border: '1px dashed',
              borderColor: 'divider',
            }}
          >
            {isRecord(entry) ? (
              Object.entries(entry).map(([k, v]) => (
                <Typography key={k} variant="body2">
                  <strong>{k}:</strong> {formatLeaf(v)}
                </Typography>
              ))
            ) : (
              <Typography variant="body2">{String(entry)}</Typography>
            )}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Typography variant="body2">
      <strong>{label}:</strong> {formatLeaf(value)}
    </Typography>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatLeaf(value: unknown): string {
  if (value == null || value === '') return '—';
  if (isRecord(value)) return JSON.stringify(value);
  return String(value);
}
