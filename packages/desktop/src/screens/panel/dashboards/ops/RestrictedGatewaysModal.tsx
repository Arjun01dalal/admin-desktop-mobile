/**
 * Edit Restricted Gateway — parity with admin WhatsAppOnlyGatewaysModal.
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { orangeBtnSx } from '@/screens/panel/transactions/shared';
import { secureApi } from '@/api/secureClient';
import { getStoredUser } from '@/utils/dates';
import {
  buildRestrictedGatewaysSetPayload,
  dedupeGatewayNames,
  extractDepositGatewayOptions,
  extractRestrictedGatewayNames,
  mergeGatewayOptions,
} from '@astro/shared';
import {
  Autocomplete,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Box,
  Stack,
} from '@mui/material';


type Props = {
  open: boolean;
  onClose: () => void;
  onAllowedChange?: (names: string[]) => void;
};

export function RestrictedGatewaysModal({ open, onClose, onAllowedChange }: Props) {
  const user = getStoredUser<{ _id?: string; name?: string }>();
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gatewayOptions, setGatewayOptions] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const onAllowedChangeRef = useRef(onAllowedChange);
  onAllowedChangeRef.current = onAllowedChange;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setOptionsLoading(true);
      try {
        const res = await secureApi('restrictedGateways.get', {});
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load saved gateways');
          setSelectedNames([]);
          setSavedNames([]);
        } else {
          const selected = extractRestrictedGatewayNames(res.data);
          setSelectedNames(selected);
          setSavedNames(selected);
          setGatewayOptions((prev) => mergeGatewayOptions(prev, selected));
          onAllowedChangeRef.current?.(selected);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load saved gateways');
          setSelectedNames([]);
          setSavedNames([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const res = await secureApi('depositProviders.list', {});
        if (cancelled) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load deposit gateways');
        } else {
          const options = extractDepositGatewayOptions(res.data);
          setSelectedNames((selected) => {
            setGatewayOptions(mergeGatewayOptions(options, selected));
            return selected;
          });
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'Failed to load deposit gateways');
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async () => {
    const names = selectedNames.map((n) => n.trim()).filter(Boolean);
    if (!names.length) {
      toast.error('Select at least one gateway');
      return;
    }
    setSaving(true);
    try {
      const payload = buildRestrictedGatewaysSetPayload(names, {
        userId: String(user?._id || ''),
        userName: String(user?.name || 'Admin'),
      });
      if (!payload.names.length) {
        toast.error('Select at least one gateway');
        return;
      }
      const res = await secureApi('restrictedGateways.set', payload);
      if (!res.ok) {
        toast.error(res.message || 'Failed to save');
        return;
      }
      setSavedNames(payload.names);
      onAllowedChangeRef.current?.(payload.names);
      toast.success('Restricted gateways saved');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>Restricted Gateway</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={1.75} sx={{ pt: 1 }}>
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 1.5,
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>
                Currently allowed (GET)
              </Typography>
              {savedNames.length ? (
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                  {savedNames.map((name) => (
                    <Chip key={name} size="small" color="primary" label={name} />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No gateways saved yet.
                </Typography>
              )}
            </Box>

            <Typography variant="body2" color="text.secondary">
              Edit selection from deposit provider gateways, then Save.
              {optionsLoading ? ' Loading provider list…' : ''}
            </Typography>

            <Autocomplete
              multiple
              freeSolo
              loading={optionsLoading}
              options={gatewayOptions}
              value={selectedNames}
              onChange={(_e, value) => setSelectedNames(dedupeGatewayNames(value))}
              filterSelectedOptions
              disableCloseOnSelect
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return <Chip key={key || option} size="small" label={option} {...tagProps} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Gateways"
                  placeholder="Search deposit gateway"
                />
              )}
            />
            <Typography variant="caption" color="text.secondary">
              Editing: {selectedNames.length} selected · {gatewayOptions.length} provider options
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          sx={orangeBtnSx}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
