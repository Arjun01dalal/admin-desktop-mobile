import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import {
  formatCategoryLabel,
  unpackCatalogGames,
} from '@/screens/panel/topGames/helpers';
import type { CatalogGame } from '@/screens/panel/topGames/types';
import { replaceS3WithCloudfront } from '@/utils/cdnUrl';

type AddMode = 'catalog' | 'manual' | 'object';

type Props = {
  categories: string[];
  existingProviders?: string[];
  onAdded: () => Promise<void> | void;
  /** When provided, panel open state is controlled by parent (header button). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const BASE_PROVIDERS = [
  'Plutus-Gaming',
  'In House Games',
  'Qtech',
  'betConstruct',
];

const MANUAL_OPTION = '__manual__';

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

const initialCatalog = {
  gameId: '',
  providerName: '',
  category: '',
  position: '1',
};

const initialManual = {
  ...initialCatalog,
  gameName: '',
  imagePath: '',
};

const objectExample = JSON.stringify(
  {
    gameId: 'EVO-monopoly',
    Name: 'Monopoly',
    providerName: 'EVO',
    status: true,
    imagePath: 'https://example.com/game-image.png',
  },
  null,
  2,
);

type ProviderFieldProps = {
  label: string;
  value: string;
  manual: boolean;
  options: string[];
  loading?: boolean;
  onSelect: (value: string) => void;
  onManualChange: (value: string) => void;
  onManualToggle: (manual: boolean) => void;
};

function ProviderField({
  label,
  value,
  manual,
  options,
  loading,
  onSelect,
  onManualChange,
  onManualToggle,
}: ProviderFieldProps) {
  if (manual) {
    return (
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label={label}
          size="small"
          fullWidth
          value={value}
          onChange={(e) => onManualChange(e.target.value)}
          placeholder="Enter provider name"
        />
        <Button
          size="small"
          onClick={() => onManualToggle(false)}
          sx={{ mt: 0.5, whiteSpace: 'nowrap', textTransform: 'none' }}
        >
          Use dropdown
        </Button>
      </Stack>
    );
  }

  return (
    <FormControl size="small" fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value}
        disabled={loading}
        onChange={(e) => {
          if (e.target.value === MANUAL_OPTION) {
            onManualToggle(true);
            return;
          }
          onSelect(e.target.value);
        }}
      >
        <MenuItem value="">
          {loading ? 'Loading…' : 'Select provider'}
        </MenuItem>
        {options.map((provider) => (
          <MenuItem key={provider} value={provider}>
            {provider}
          </MenuItem>
        ))}
        <MenuItem value={MANUAL_OPTION}>+ Enter manually</MenuItem>
      </Select>
    </FormControl>
  );
}

export function AddTopGamePanel({
  categories,
  existingProviders = [],
  onAdded,
  open: openProp,
  onOpenChange,
}: Props) {
  const [mode, setMode] = useState<AddMode>('catalog');
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = typeof openProp === 'boolean';
  const open = controlled ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };
  const [submitting, setSubmitting] = useState(false);
  const [catalog, setCatalog] = useState(initialCatalog);
  const [manual, setManual] = useState(initialManual);
  const [objectCategory, setObjectCategory] = useState('');
  const [objectPosition, setObjectPosition] = useState('1');
  const [gameObject, setGameObject] = useState(objectExample);
  const [catalogGames, setCatalogGames] = useState<CatalogGame[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    catalogProvider: false,
    manualProvider: false,
  });

  const categoryOptions = useMemo(
    () => categories.filter((category) => category !== 'All'),
    [categories],
  );

  const providerOptions = useMemo(() => {
    const fromCatalog = catalogGames
      .map((game) => game.providerName)
      .filter(Boolean);
    return Array.from(
      new Set([...BASE_PROVIDERS, ...existingProviders, ...fromCatalog]),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [catalogGames, existingProviders]);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      setCatalogLoading(true);
      try {
        const res = await secureApi('ops.casinoGetData', {
          pageNo: 1,
          itemsPerPage: 10000,
          Filters: {},
        });
        if (!active) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load game catalog');
          return;
        }
        setCatalogGames(unpackCatalogGames(res.data));
      } finally {
        if (active) setCatalogLoading(false);
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const parsePosition = (value: string) => {
    const position = Number(value);
    if (!Number.isInteger(position) || position < 1) {
      throw new Error('Position must be a positive whole number');
    }
    return position;
  };

  const requireFields = (
    values: Record<string, string>,
    labels: Record<string, string>,
  ) => {
    const missing = Object.keys(labels).find((key) => !values[key]?.trim());
    if (missing) throw new Error(`${labels[missing]} is required`);
  };

  const submitCatalog = async () => {
    requireFields(catalog, {
      providerName: 'Provider name',
      gameId: 'Game ID',
      category: 'Category',
    });
    const res = await secureApi('topGames.addGameById', {
      gameId: catalog.gameId.trim(),
      providerName: catalog.providerName.trim(),
      category: catalog.category,
      position: parsePosition(catalog.position),
    });
    if (!res.ok) throw new Error(res.message || 'Failed to add game');
    setCatalog(initialCatalog);
    setManualEntry((prev) => ({ ...prev, catalogProvider: false }));
  };

  const submitManual = async () => {
    requireFields(manual, {
      providerName: 'Provider name',
      gameId: 'Game ID',
      gameName: 'Game name',
      category: 'Category',
      imagePath: 'Image URL',
    });
    const res = await secureApi('topGames.addGameDetails', {
      gameId: manual.gameId.trim(),
      gameName: manual.gameName.trim(),
      providerName: manual.providerName.trim(),
      category: manual.category,
      position: parsePosition(manual.position),
      imagePath: manual.imagePath.trim(),
    });
    if (!res.ok) throw new Error(res.message || 'Failed to add game');
    setManual(initialManual);
    setManualEntry((prev) => ({ ...prev, manualProvider: false }));
  };

  const submitObject = async () => {
    if (!objectCategory) throw new Error('Category is required');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(gameObject);
    } catch {
      throw new Error('Game object must be valid JSON');
    }
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error('Game object must be a JSON object');
    }
    if (!parsed.gameId) throw new Error('Game object must include gameId');

    const res = await secureApi('topGames.addGameObject', {
      category: objectCategory,
      position: parsePosition(objectPosition),
      game: parsed,
    });
    if (!res.ok) throw new Error(res.message || 'Failed to add game');
    setGameObject(objectExample);
    setObjectPosition('1');
  };

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      try {
        if (mode === 'catalog') await submitCatalog();
        if (mode === 'manual') await submitManual();
        if (mode === 'object') await submitObject();
        toast.success('Game added successfully');
        await onAdded();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to add game',
        );
      } finally {
        setSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, catalog, manual, objectCategory, objectPosition, gameObject, onAdded],
  );

  const categorySelect = (
    value: string,
    onChange: (value: string) => void,
  ) => (
    <FormControl size="small" fullWidth>
      <InputLabel>Category</InputLabel>
      <Select
        label="Category"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <MenuItem value="">Select category</MenuItem>
        {categoryOptions.map((category) => (
          <MenuItem key={category} value={category}>
            {formatCategoryLabel(category)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  if (controlled && !open) return null;

  return (
    <Box
      sx={{
        mb: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {!controlled ? (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5, cursor: 'pointer' }}
          onClick={() => setOpen(!open)}
        >
          <Box>
            <Typography fontWeight={700}>Add Top Game</Typography>
            <Typography variant="caption" color="text.secondary">
              Add from catalog, enter details, or paste a full object
            </Typography>
          </Box>
          <IconButton
            size="small"
            sx={{
              bgcolor: '#ff9f0a',
              color: '#1a1200',
              '&:hover': { bgcolor: '#e08c00' },
            }}
          >
            {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
      ) : null}

      <Collapse in={open}>
        <Box
          component="form"
          onSubmit={(e) => void handleSubmit(e)}
          sx={{
            px: 2,
            py: 2,
            ...(controlled ? {} : { borderTop: 1, borderColor: 'divider' }),
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_e, next) => {
              if (next) setMode(next);
            }}
            sx={{ my: 2, flexWrap: 'wrap' }}
          >
            <ToggleButton value="catalog" sx={{ textTransform: 'none' }}>
              Catalog Game
            </ToggleButton>
            <ToggleButton value="manual" sx={{ textTransform: 'none' }}>
              Manual Details
            </ToggleButton>
            <ToggleButton value="object" sx={{ textTransform: 'none' }}>
              Full Object
            </ToggleButton>
          </ToggleButtonGroup>

          {mode === 'catalog' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Select the provider from the list (or enter it manually), then
                type the Game ID.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr',
                    md: 'repeat(4, 1fr)',
                  },
                }}
              >
                <ProviderField
                  label="Provider"
                  value={catalog.providerName}
                  manual={manualEntry.catalogProvider}
                  options={providerOptions}
                  loading={catalogLoading}
                  onSelect={(providerName) =>
                    setCatalog((prev) => ({ ...prev, providerName }))
                  }
                  onManualChange={(providerName) =>
                    setCatalog((prev) => ({ ...prev, providerName }))
                  }
                  onManualToggle={(isManual) => {
                    setManualEntry((prev) => ({
                      ...prev,
                      catalogProvider: isManual,
                    }));
                    setCatalog((prev) => ({ ...prev, providerName: '' }));
                  }}
                />
                <TextField
                  label="Game ID"
                  size="small"
                  value={catalog.gameId}
                  onChange={(e) =>
                    setCatalog((prev) => ({ ...prev, gameId: e.target.value }))
                  }
                  placeholder="EVO-monopoly"
                />
                {categorySelect(catalog.category, (category) =>
                  setCatalog((prev) => ({ ...prev, category })),
                )}
                <TextField
                  label="Position"
                  type="number"
                  size="small"
                  inputProps={{ min: 1, step: 1 }}
                  value={catalog.position}
                  onChange={(e) =>
                    setCatalog((prev) => ({
                      ...prev,
                      position: e.target.value,
                    }))
                  }
                />
              </Box>
            </Stack>
          ) : null}

          {mode === 'manual' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Select or enter the provider, type the Game ID, and fill the
                remaining details with an image URL.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: '1fr 1fr',
                    md: 'repeat(4, 1fr)',
                  },
                }}
              >
                <ProviderField
                  label="Provider"
                  value={manual.providerName}
                  manual={manualEntry.manualProvider}
                  options={providerOptions}
                  loading={catalogLoading}
                  onSelect={(providerName) =>
                    setManual((prev) => ({ ...prev, providerName }))
                  }
                  onManualChange={(providerName) =>
                    setManual((prev) => ({ ...prev, providerName }))
                  }
                  onManualToggle={(isManual) => {
                    setManualEntry((prev) => ({
                      ...prev,
                      manualProvider: isManual,
                    }));
                    setManual((prev) => ({ ...prev, providerName: '' }));
                  }}
                />
                <TextField
                  label="Game ID"
                  size="small"
                  value={manual.gameId}
                  onChange={(e) =>
                    setManual((prev) => ({ ...prev, gameId: e.target.value }))
                  }
                  placeholder="EVO-monopoly"
                />
                <TextField
                  label="Game Name"
                  size="small"
                  value={manual.gameName}
                  onChange={(e) =>
                    setManual((prev) => ({ ...prev, gameName: e.target.value }))
                  }
                  placeholder="Monopoly"
                />
                {categorySelect(manual.category, (category) =>
                  setManual((prev) => ({ ...prev, category })),
                )}
                <TextField
                  label="Position"
                  type="number"
                  size="small"
                  inputProps={{ min: 1, step: 1 }}
                  value={manual.position}
                  onChange={(e) =>
                    setManual((prev) => ({
                      ...prev,
                      position: e.target.value,
                    }))
                  }
                />
                <TextField
                  label="Image URL"
                  size="small"
                  value={manual.imagePath}
                  onChange={(e) =>
                    setManual((prev) => ({
                      ...prev,
                      imagePath: e.target.value,
                    }))
                  }
                  placeholder="https://.../game-image.png"
                  sx={{ gridColumn: { md: 'span 3' } }}
                />
              </Box>
              {manual.imagePath.trim() ? (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    component="img"
                    src={replaceS3WithCloudfront(manual.imagePath.trim())}
                    alt="Game preview"
                    sx={{
                      width: 60,
                      height: 60,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: 1,
                      borderColor: 'divider',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Image preview
                  </Typography>
                </Stack>
              ) : null}
            </Stack>
          ) : null}

          {mode === 'object' ? (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Paste the complete game JSON object. It must include a{' '}
                <code>gameId</code>.
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  maxWidth: 520,
                }}
              >
                {categorySelect(objectCategory, setObjectCategory)}
                <TextField
                  label="Position"
                  type="number"
                  size="small"
                  inputProps={{ min: 1, step: 1 }}
                  value={objectPosition}
                  onChange={(e) => setObjectPosition(e.target.value)}
                />
              </Box>
              <TextField
                label="Game Object"
                size="small"
                fullWidth
                multiline
                minRows={8}
                value={gameObject}
                onChange={(e) => setGameObject(e.target.value)}
                InputProps={{
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: 12,
                    bgcolor: 'action.hover',
                  },
                }}
              />
            </Stack>
          ) : null}

          <Stack direction="row" justifyContent="flex-end" mt={2}>
            <Button
              type="submit"
              variant="contained"
              disabled={submitting}
              startIcon={
                submitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <AddIcon />
                )
              }
              sx={orangeBtnSx}
            >
              {submitting ? 'Adding…' : 'Add Game'}
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </Box>
  );
}
