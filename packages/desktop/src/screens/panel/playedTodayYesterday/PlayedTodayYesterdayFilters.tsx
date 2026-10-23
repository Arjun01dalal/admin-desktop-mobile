/**
 * Collapsible filter body — type cards, breakdown, meta, search + C2C push.
 */
import {
  Box,
  Button,
  ButtonBase,
  Checkbox,
  CircularProgress,
  Divider,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  BREAKDOWN_COUNTS,
  CLIENT_NAMES,
  COUNT_BY_TYPE,
  INDIA_STATES,
  PLAYED_PAGE_SIZE_OPTIONS,
  PLAY_FILTERS,
  PLAY_SUMMARY_META,
  type PlaySummary,
  type PlayType,
} from '@astro/shared';
import { AddToC2cCampaignControls } from '@/components/AddToC2cCampaignControls';
import { orangeBtnSx, fieldSx } from '@/screens/panel/transactions/shared';
import { formatPlayedCell } from './formatPlayedCell';

const filterFieldSx = {
  ...fieldSx,
  width: 168,
  flexShrink: 0,
};

type Props = {
  type: PlayType;
  summary: PlaySummary;
  total: number;
  loading: boolean;
  draftDate: string;
  draftEmpCode: string;
  draftClientName: string;
  draftStates: string[];
  pageSize: number;
  userIds: string[];
  onTypeChange: (next: PlayType) => void;
  onDraftDateChange: (v: string) => void;
  onDraftEmpCodeChange: (v: string) => void;
  onDraftClientNameChange: (v: string) => void;
  onDraftStatesChange: (v: string[]) => void;
  onPageSizeChange: (n: number) => void;
  onClearDate: () => void;
  onSearch: () => void;
};

export function PlayedTodayYesterdayFilters({
  type,
  summary,
  total,
  loading,
  draftDate,
  draftEmpCode,
  draftClientName,
  draftStates,
  pageSize,
  userIds,
  onTypeChange,
  onDraftDateChange,
  onDraftEmpCodeChange,
  onDraftClientNameChange,
  onDraftStatesChange,
  onPageSizeChange,
  onClearDate,
  onSearch,
}: Props) {
  return (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
          gap: 1.25,
          mb: 2,
        }}
      >
        {PLAY_FILTERS.map(({ type: value, label }) => {
          const active = type === value;
          const count = summary[COUNT_BY_TYPE[value]];
          return (
            <ButtonBase
              key={value}
              focusRipple
              onClick={() => {
                if (value === type) return;
                onTypeChange(value);
              }}
              sx={(theme) => ({
                display: 'block',
                width: '100%',
                textAlign: 'left',
                borderRadius: 2,
                border: '1.5px solid',
                borderColor: active ? 'primary.main' : 'divider',
                bgcolor: active ? 'rgba(255,159,10,0.14)' : 'action.hover',
                px: 1.75,
                py: 1.5,
                transition: 'border-color 120ms ease, background-color 120ms ease',
                boxShadow: active ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'rgba(255,159,10,0.10)',
                },
              })}
            >
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: active ? 'primary.main' : 'text.secondary',
                  lineHeight: 1.35,
                  mb: 0.5,
                }}
              >
                {label}
              </Typography>
              <Typography
                sx={{
                  fontSize: 22,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'text.primary',
                }}
              >
                {count != null && count !== '' ? Number(count).toLocaleString('en-IN') : '—'}
              </Typography>
            </ButtonBase>
          );
        })}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)',
            sm: 'repeat(4, 1fr)',
          },
          gap: 1.25,
          mb: 2,
        }}
      >
        {BREAKDOWN_COUNTS.map(({ key, label }) => (
          <Box
            key={key}
            sx={{
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
              px: 1.75,
              py: 1.25,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 0.35 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {summary[key] != null && summary[key] !== ''
                ? Number(summary[key]).toLocaleString('en-IN')
                : '—'}
            </Typography>
          </Box>
        ))}
        <Box
          sx={{
            borderRadius: 2,
            border: '1.5px solid',
            borderColor: 'primary.main',
            bgcolor: 'rgba(255,159,10,0.12)',
            px: 1.75,
            py: 1.25,
          }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mb: 0.35 }}>
            Total
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {total.toLocaleString('en-IN')}
          </Typography>
        </Box>
      </Box>

      <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 2.25 }}>
        {PLAY_SUMMARY_META.map(({ key, label }) => (
          <Box
            key={key}
            sx={{
              px: 1.25,
              py: 0.6,
              borderRadius: 999,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              {label}:{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 800 }}>
                {formatPlayedCell(summary[key])}
              </Box>
            </Typography>
          </Box>
        ))}
      </Stack>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={1.75}>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} alignItems="flex-end">
          <TextField
            label="Date"
            type="date"
            size="small"
            value={draftDate}
            onChange={(e) => onDraftDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={filterFieldSx}
          />
          <Button
            onClick={onClearDate}
            disabled={!draftDate}
            sx={{ ...orangeBtnSx, minWidth: 88, opacity: draftDate ? 1 : 0.55 }}
          >
            Clear
          </Button>
          <TextField
            label="Employee Code"
            size="small"
            value={draftEmpCode}
            onChange={(e) => onDraftEmpCodeChange(e.target.value)}
            placeholder="Emp code"
            sx={filterFieldSx}
          />
          <TextField
            select
            label="App Name"
            size="small"
            value={draftClientName}
            onChange={(e) => onDraftClientNameChange(e.target.value)}
            sx={filterFieldSx}
          >
            <MenuItem value="">All</MenuItem>
            {CLIENT_NAMES.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="State"
            size="small"
            value={draftStates}
            onChange={(e) => {
              const value = e.target.value;
              onDraftStatesChange(
                typeof value === 'string' ? value.split(',') : (value as string[]),
              );
            }}
            SelectProps={{
              multiple: true,
              displayEmpty: true,
              renderValue: (selected) =>
                Array.isArray(selected) && selected.length
                  ? selected.length > 2
                    ? `${selected.length} states`
                    : selected.join(', ')
                  : 'All',
            }}
            sx={{ ...filterFieldSx, width: 180 }}
          >
            {INDIA_STATES.map((name) => (
              <MenuItem key={name} value={name}>
                <Checkbox
                  size="small"
                  checked={draftStates.includes(name)}
                  sx={{ p: 0.5, mr: 1 }}
                />
                <ListItemText primary={name} />
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Items Per Page"
            size="small"
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            sx={{ ...filterFieldSx, width: 140 }}
          >
            {PLAYED_PAGE_SIZE_OPTIONS.map((size) => (
              <MenuItem key={size} value={String(size)}>
                {size}
              </MenuItem>
            ))}
          </TextField>
          <Button
            onClick={onSearch}
            disabled={loading}
            sx={{ ...orangeBtnSx, minWidth: 112, fontWeight: 800, letterSpacing: 0.4 }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'SEARCH'}
          </Button>
        </Stack>

        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.5} alignItems="center">
          <AddToC2cCampaignControls
            userIds={userIds}
            disabled={loading}
            pushLabel="Push to C2C"
            sx={{
              '& .MuiButton-root': {
                ...orangeBtnSx,
                height: 40,
              },
              '& .MuiTextField-root': { width: 220 },
            }}
          />
        </Stack>
      </Stack>
    </>
  );
}
