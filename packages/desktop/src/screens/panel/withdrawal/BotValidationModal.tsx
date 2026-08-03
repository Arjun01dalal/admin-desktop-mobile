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

export function BotValidationModal({ open, items, onClose }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { bgcolor: '#1a1a1f' } }}
    >
      <DialogTitle>Bot Validation Results</DialogTitle>
      <DialogContent>
        {!items.length ? (
          <Typography color="text.secondary">No validation data</Typography>
        ) : (
          <Box sx={{ overflow: 'auto', maxHeight: '70vh' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Point', 'Name', 'Status', 'Reason'].map((h) => (
                    <TableCell
                      key={h}
                      sx={{ bgcolor: '#ff9f0a', color: '#1a1200', fontWeight: 700 }}
                    >
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
                    <TableCell>{v.reason || '—'}</TableCell>
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
  );
}
