import { useEffect, useState } from 'react';
import { Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
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

/** Nested list editor for Mid / Link / WhatsApp / City (laxminarayan CitySelector). */
export function ArrayFieldEditor({
  rowId,
  values,
  selectedValue,
  label,
  placeholder,
  arrayAction,
  arrayKey,
  selectedKey = 'city',
  onRefresh,
  userId,
  userName,
}: Props) {
  const [list, setList] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setList(Array.isArray(values) ? values.map(String) : []);
  }, [values]);

  const activateSelected = async (name: string) => {
    if (selectedKey === 'city') return;
    const data: Record<string, unknown> = { _id: rowId };
    if (selectedKey === 'mid') data.mid = name;
    else if (selectedKey === 'link') data.link = name;
    else if (selectedKey === 'redirectionLink') data.redirectionLink = `https://wa.me/${name}`;

    const res = await secureApi('depositProviders.updateMidNameLink', data);
    if (!res.ok) {
      toast.error(res.message || 'Failed to set active value');
      return;
    }
    onRefresh();
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
        await activateSelected(trimmed);
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

  return (
    <Stack spacing={0.5} alignItems="stretch" sx={{ minWidth: 150, maxWidth: 200, py: 0.25 }}>
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: 'rgba(255,255,255,0.7)', lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      {list.length > 0 && selectedKey !== 'city' && (
        <TextField
          select
          size="small"
          value={selectedValue && list.includes(String(selectedValue)) ? String(selectedValue) : ''}
          onChange={(e) => void activateSelected(e.target.value)}
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
      )}
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
    </Stack>
  );
}
