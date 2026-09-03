import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  MenuItem,
  Popover,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import type { SecureAction } from '@/api/secureActions';

type Props = {
  rowId: string;
  values: string[];
  selectedValue?: string;
  label: string;
  placeholder: string;
  /** Array API action (mid/upi/whatsapp). Omit for city → updateBonusAndClients */
  arrayAction?: SecureAction;
  /** Optional remove API (e.g. depositProviders.removeMidArray for MIDs). */
  removeAction?: SecureAction;
  arrayKey?: string;
  selectedKey?: 'mid' | 'link' | 'redirectionLink' | 'city';
  onRefresh: () => void;
  userId?: string;
  userName?: string;
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'none' as const,
  minWidth: 56,
  px: 1,
  py: 0.25,
  '&:hover': { bgcolor: '#e08c00' },
};

const smallActionBtnSx = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'none' as const,
  minWidth: 52,
  px: 0.75,
  py: 0.15,
  lineHeight: 1.4,
};

/**
 * Nested list editor for Mid / Link / WhatsApp / City.
 * MID manage (Enable/Delete) opens in a popover so the table row stays compact
 * and virtualized scrolling does not lock up.
 */
export function ArrayFieldEditor({
  rowId,
  values,
  selectedValue,
  label,
  placeholder,
  arrayAction,
  removeAction,
  arrayKey,
  selectedKey = 'city',
  onRefresh,
  userId,
  userName,
}: Props) {
  const [list, setList] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setList(Array.isArray(values) ? values.map(String) : []);
  }, [values]);

  const activateSelected = async (name: string, { quiet }: { quiet?: boolean } = {}) => {
    if (selectedKey === 'city') return false;
    const data: Record<string, unknown> = { _id: rowId };
    if (selectedKey === 'mid') data.mid = name;
    else if (selectedKey === 'link') data.link = name;
    else if (selectedKey === 'redirectionLink') data.redirectionLink = `https://wa.me/${name}`;

    const res = await secureApi('depositProviders.updateMidNameLink', data);
    if (!res.ok) {
      toast.error(res.message || 'Failed to set active value');
      return false;
    }
    if (!quiet) toast.success(`${name} enabled`);
    onRefresh();
    return true;
  };

  const handleEnable = async (name: string) => {
    const trimmed = String(name || '').trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setBusyKey(`enable:${trimmed}`);
    try {
      await activateSelected(trimmed);
    } finally {
      setBusy(false);
      setBusyKey(null);
    }
  };

  const handleAdd = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (list.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.warn(`"${trimmed}" already exists`);
      return;
    }
    setBusy(true);
    try {
      if (arrayAction && arrayKey) {
        const res = await secureApi(arrayAction, { _id: rowId, [arrayKey]: [trimmed] });
        if (!res.ok) {
          toast.error(res.message || `Failed to add ${placeholder}`);
          return;
        }
        toast.success(`${placeholder} added`);
        setDraft('');
        await activateSelected(trimmed, { quiet: true });
        return;
      }

      const res = await secureApi('depositProviders.updateBonusAndClients', {
        _id: rowId,
        cityNotAllowed: {
          cities: trimmed
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          action: 'add',
        },
        updatedBy: { userId, userName },
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to add city');
        return;
      }
      toast.success('City added');
      setDraft('');
      onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (mid: string) => {
    const trimmed = String(mid || '').trim();
    if (!trimmed || !removeAction || !arrayKey) return;
    setBusy(true);
    setBusyKey(`delete:${trimmed}`);
    try {
      const res = await secureApi(removeAction, {
        _id: rowId,
        [arrayKey]: [trimmed],
        updatedBy: {
          userId: userId || undefined,
          userName: userName || undefined,
        },
      });
      if (!res.ok) {
        toast.error(res.message || `Failed to remove ${placeholder}`);
        return;
      }
      toast.success(`${trimmed} deleted`);
      // Drop locally so popover stays responsive before parent reload finishes.
      setList((prev) => prev.filter((v) => v !== trimmed));
      onRefresh();
    } finally {
      setBusy(false);
      setBusyKey(null);
    }
  };

  const selected =
    selectedValue && list.includes(String(selectedValue)) ? String(selectedValue) : '';
  const manageOpen = Boolean(anchorEl);
  const showManage = Boolean(removeAction) && selectedKey !== 'city';

  return (
    <Stack spacing={0.5} alignItems="stretch" sx={{ minWidth: 150, maxWidth: 200, py: 0.25 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.2 }}
      >
        {label}
      </Typography>

      {list.length > 0 && selectedKey !== 'city' ? (
        showManage ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField
              size="small"
              value={selected || '—'}
              InputProps={{ readOnly: true }}
              sx={{
                flex: 1,
                minWidth: 0,
                '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 11, minHeight: 30 },
                '& .MuiInputBase-input': {
                  py: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
              title={selected || undefined}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                ...smallActionBtnSx,
                minWidth: 64,
                borderColor: 'rgba(255,159,10,0.55)',
                color: '#ffb74d',
                '&:hover': {
                  borderColor: '#ff9f0a',
                  bgcolor: 'rgba(255,159,10,0.1)',
                },
              }}
            >
              Manage
            </Button>
          </Stack>
        ) : (
          <TextField
            select
            size="small"
            value={selected}
            onChange={(e) => void handleEnable(e.target.value)}
            sx={{
              '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 11, minHeight: 30 },
              '& .MuiSelect-select': { py: 0.5 },
            }}
          >
            {list.map((v) => (
              <MenuItem key={v} value={v} sx={{ fontSize: 12 }}>
                {v}
              </MenuItem>
            ))}
          </TextField>
        )
      ) : null}

      {selectedKey === 'city' && list.length > 0 && (
        <Typography
          variant="caption"
          component="div"
          sx={{
            color: 'rgba(255,255,255,0.75)',
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            lineHeight: 1.3,
            maxWidth: '100%',
            textAlign: 'left',
          }}
        >
          {list.join(', ')}
        </Typography>
      )}

      <Stack direction="row" spacing={0.5} alignItems="center">
        <TextField
          size="small"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdd();
            }
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            '& .MuiInputBase-root': { bgcolor: '#121218', fontSize: 11, minHeight: 30 },
            '& .MuiInputBase-input': { py: 0.5 },
          }}
        />
        <Button
          size="small"
          variant="contained"
          disabled={busy}
          onClick={() => void handleAdd()}
          sx={orangeBtnSx}
        >
          ADD
        </Button>
      </Stack>

      <Popover
        open={manageOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxWidth: '90vw',
              maxHeight: 360,
              bgcolor: '#1a1a22',
              border: '1px solid rgba(255,255,255,0.12)',
              mt: 0.5,
            },
          },
        }}
      >
        <Box sx={{ px: 1.25, pt: 1, pb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ffb74d' }}>
            Manage {label}
            {selected ? ` · active: ${selected}` : ''}
          </Typography>
        </Box>
        <Box sx={{ maxHeight: 300, overflowY: 'auto', px: 0.75, pb: 1 }}>
          {list.length === 0 ? (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', px: 1 }}>
              No items
            </Typography>
          ) : (
            list.map((v) => {
              const isActive = v === selected;
              const enableBusy = busyKey === `enable:${v}`;
              const deleteBusy = busyKey === `delete:${v}`;
              return (
                <Stack
                  key={v}
                  direction="row"
                  spacing={0.5}
                  alignItems="center"
                  sx={{
                    px: 0.75,
                    py: 0.6,
                    borderRadius: 1,
                    bgcolor: isActive ? 'rgba(255,159,10,0.16)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  }}
                >
                  <Button
                    size="small"
                    variant={isActive ? 'contained' : 'outlined'}
                    disabled={busy || isActive}
                    onClick={() => void handleEnable(v)}
                    sx={{
                      ...smallActionBtnSx,
                      ...(isActive
                        ? {
                            bgcolor: '#66bb6a',
                            color: '#0d1f0f',
                            '&:hover': { bgcolor: '#57a85c' },
                            '&.Mui-disabled': {
                              bgcolor: '#66bb6a',
                              color: '#0d1f0f',
                              opacity: 0.9,
                            },
                          }
                        : {
                            borderColor: 'rgba(102,187,106,0.6)',
                            color: '#81c784',
                            '&:hover': {
                              borderColor: '#66bb6a',
                              bgcolor: 'rgba(102,187,106,0.12)',
                            },
                          }),
                    }}
                  >
                    {enableBusy ? '…' : isActive ? 'Active' : 'Enable'}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={busy}
                    onClick={() => void handleRemove(v)}
                    sx={{
                      ...smallActionBtnSx,
                      borderColor: 'rgba(239,83,80,0.55)',
                      color: '#ef5350',
                      '&:hover': {
                        borderColor: '#ef5350',
                        bgcolor: 'rgba(239,83,80,0.12)',
                      },
                    }}
                  >
                    {deleteBusy ? '…' : 'Delete'}
                  </Button>
                  <Typography
                    variant="caption"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#ffcc80' : 'rgba(255,255,255,0.88)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={v}
                  >
                    {v}
                  </Typography>
                </Stack>
              );
            })
          )}
        </Box>
      </Popover>
    </Stack>
  );
}
