import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ImageIcon from '@mui/icons-material/Image';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { hasPermission, Permissions } from '@/auth/permissions';
import { CommonTable, type CommonTableColumn } from '@/components/CommonTable';
import { TablePanel } from '@/components/TablePanel';
import { asList, useReportQuery } from '@/screens/panel/shared';
import { AddGameLaunchBannerModal } from '@/screens/panel/banners/AddGameLaunchBannerModal';
import { GameImageUploadCell } from '@/screens/panel/topGames/GameImageUploadCell';
import { UpdateGameImageDialog } from '@/screens/panel/topGames/UpdateGameImageDialog';
import {
  buildUpdateGameImagePayload,
  type GameImageUpdateTarget,
} from '@/screens/panel/topGames/updateGameImage';
import { replaceS3WithCloudfront } from '@/utils/cdnUrl';
import {
  BANNER_CATEGORY_OPTIONS,
  BANNER_TYPE_OPTIONS,
  MOBILE_PAGE_OPTIONS,
  MOBILE_PARAM_OPTIONS,
  VIDEO_TYPE_OPTIONS,
} from '@/screens/panel/banners/constants';

type BannerRow = {
  _id: string;
  imagePath?: string;
  gameName?: string;
  gameId?: string;
  providerName?: string;
  type?: string;
  status?: boolean;
  position?: number;
  [key: string]: unknown;
};

function isGameBanner(row: BannerRow): boolean {
  if (row.type === 'game') return true;
  if (String(row.category || '') === 'gameLaunch') return true;
  return Boolean(String(row.gameId || '').trim());
}

function bannerGameId(row: BannerRow): string {
  return String(row.gameId || '').trim();
}

function bannerProvider(row: BannerRow): string {
  return String(row.providerName || row.provider || '').trim();
}

type AddForm = {
  imageDataUrl: string;
  fileName: string;
  desktopLink: string;
  gameName: string;
  mobilePage: string;
  mobileOptions: string;
  type: string;
  category: string;
  bonusTitle: string;
  bonusSubtitle: string;
};

const EMPTY_ADD: AddForm = {
  imageDataUrl: '',
  fileName: '',
  desktopLink: '',
  gameName: '',
  mobilePage: '',
  mobileOptions: '',
  type: '',
  category: '',
  bonusTitle: '',
  bonusSubtitle: '',
};

const POSITION_OPTIONS = Array.from({ length: 25 }, (_, i) => i + 1);

const fieldSx = {
  minWidth: 88,
  width: 96,
  '& .MuiInputBase-root': { bgcolor: 'background.paper', fontSize: 12 },
};

const orangeBtnSx = {
  bgcolor: '#ff9f0a',
  color: '#1a1200',
  fontWeight: 700,
  textTransform: 'none' as const,
  '&:hover': { bgcolor: '#e08c00' },
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function BannersPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [addBannerOpen, setAddBannerOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [form, setForm] = useState<AddForm>(EMPTY_ADD);
  const [videoType, setVideoType] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState('');
  const [positionDrafts, setPositionDrafts] = useState<Record<string, string>>({});
  const [savingPositionId, setSavingPositionId] = useState('');
  const [updateImageOpen, setUpdateImageOpen] = useState(false);
  const [updateImageId, setUpdateImageId] = useState('');
  const [updateImagePath, setUpdateImagePath] = useState('');
  const [updateImageName, setUpdateImageName] = useState('');
  const [gameImageTarget, setGameImageTarget] = useState<GameImageUpdateTarget | null>(null);
  const [gameImageSaving, setGameImageSaving] = useState(false);
  const [updatingImage, setUpdatingImage] = useState(false);

  const canAdd = hasPermission(Permissions.Add_Banner);
  const canToggle = hasPermission(Permissions.Toggle_Banner);
  const canDelete = hasPermission(Permissions.Delete_Banner);

  const buildPayload = useCallback(() => ({}), []);
  const unpack = useCallback((res: { data?: unknown }) => {
    const list = asList<BannerRow>(res.data).map((banner) => ({
      ...banner,
      imagePath: replaceS3WithCloudfront(banner.imagePath),
    }));
    const sorted = [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return { rows: sorted };
  }, []);

  const { rows, loading, load, setRows } = useReportQuery<BannerRow>({
    action: 'ops.bannersGetAll',
    buildPayload,
    unpack,
    errorMessage: 'Failed to load banners',
  });

  const openAdd = useCallback(() => {
    setForm(EMPTY_ADD);
    setAddOpen(true);
  }, []);

  const openDelete = useCallback((row: BannerRow) => {
    setActiveId(row._id);
    setDeleteOpen(true);
  }, []);

  const handleImageFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm((prev) => ({
        ...prev,
        imageDataUrl: dataUrl,
        fileName: file.name,
      }));
    } catch {
      toast.error('Failed to read image file');
    }
  }, []);

  const handleCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!form.imageDataUrl) {
        toast.error('Choose an image file');
        return;
      }
      if (!form.desktopLink.trim()) {
        toast.error('Enter desktop link');
        return;
      }
      if (!form.gameName.trim()) {
        toast.error('Enter game name');
        return;
      }
      if (!form.type) {
        toast.error('Select type');
        return;
      }
      if (!form.category) {
        toast.error('Select category');
        return;
      }
      if (form.type === 'bonusScreenBanners' && !form.bonusTitle.trim()) {
        toast.error('Enter banner title');
        return;
      }
      if (form.type === 'bonusScreenBanners' && !form.bonusSubtitle.trim()) {
        toast.error('Enter banner subtitle');
        return;
      }

      setSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          iframeUrlMob: form.mobilePage,
          iframeUrl: form.desktopLink.trim(),
          type: form.type,
          File_Name: form.fileName,
          Image: form.imageDataUrl,
          gameName: form.gameName.trim(),
          category: form.category,
          deepLink: true,
          mobileRouter: form.mobilePage,
          mobileOptions: form.mobileOptions,
          status: true,
        };
        if (form.type === 'bonusScreenBanners') {
          payload.decryption = {
            title: form.bonusTitle.trim(),
            subTitle: form.bonusSubtitle.trim(),
          };
        }

        const res = await secureApi('ops.bannersCreate', payload);
        if (!res.ok) {
          toast.error(res.message || 'Failed to add banner');
          return;
        }
        toast.success('Banner added');
        setAddOpen(false);
        setForm(EMPTY_ADD);
        void load();
      } finally {
        setSubmitting(false);
      }
    },
    [form, load],
  );

  const handleVideoSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!videoType) {
        toast.error('Select video type');
        return;
      }
      if (!videoFile) {
        toast.error('No file selected');
        return;
      }
      setSubmitting(true);
      try {
        const videoBase64 = await readFileAsBase64(videoFile);
        const res = await secureApi('ops.bannersUploadVideo', {
          videoBase64,
          fileName: videoFile.name,
          videoType,
          mimeType: videoFile.type || 'video/mp4',
        });
        if (!res.ok) {
          toast.error(res.message || 'Video upload failed');
          return;
        }
        toast.success(res.message || 'Tutorial video uploaded successfully');
        setVideoOpen(false);
        setVideoType('');
        setVideoFile(null);
        void load();
      } catch {
        toast.error('Failed to read video file');
      } finally {
        setSubmitting(false);
      }
    },
    [videoFile, videoType, load],
  );

  const handleToggleStatus = useCallback(
    async (row: BannerRow, next: boolean) => {
      setTogglingId(row._id);
      try {
        const res = await secureApi('ops.bannersUpdate', { _id: row._id, status: next });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update status');
          return;
        }
        setRows((prev) =>
          prev.map((item) => (item._id === row._id ? { ...item, status: next } : item)),
        );
      } finally {
        setTogglingId('');
      }
    },
    [setRows],
  );

  const handleUpdatePosition = useCallback(
    async (row: BannerRow) => {
      const raw = positionDrafts[row._id] ?? String(row.position ?? '');
      const position = Number(raw);
      if (!position || position < 1 || position > 25) {
        toast.error('Please select a valid position (1-25)');
        return;
      }
      setSavingPositionId(row._id);
      try {
        const res = await secureApi('ops.bannersUpdatePosition', { _id: row._id, position });
        if (!res.ok) {
          toast.error(res.message || 'Failed to update position');
          return;
        }
        toast.success('Position updated');
        void load();
      } finally {
        setSavingPositionId('');
      }
    },
    [positionDrafts, load],
  );

  const openUpdateImage = useCallback((row: BannerRow) => {
    if (isGameBanner(row)) {
      const gameId = bannerGameId(row);
      const provider = bannerProvider(row);
      if (!gameId) {
        toast.error('Game ID is required');
        return;
      }
      if (!provider) {
        toast.error('Provider is required');
        return;
      }
      setGameImageTarget({
        gameId,
        provider,
        name: row.gameName || gameId,
        currentImageUrl: row.imagePath ? replaceS3WithCloudfront(row.imagePath) : '',
      });
      return;
    }
    setUpdateImageId(row._id);
    setUpdateImagePath(row.imagePath || '');
    setUpdateImageName(row.gameName || '');
    setUpdateImageOpen(true);
  }, []);

  const handleGameImageUpdate = useCallback(
    async (imagePath: string) => {
      if (!gameImageTarget) return;
      setGameImageSaving(true);
      try {
        const payload = buildUpdateGameImagePayload(
          gameImageTarget.gameId,
          imagePath,
          gameImageTarget.provider,
        );
        const res = await secureApi('topGames.updateImage', payload);
        if (!res.ok) {
          toast.error(res.message || 'Failed to update game image');
          return;
        }
        toast.success('Game image updated successfully');
        setGameImageTarget(null);
        void load();
      } finally {
        setGameImageSaving(false);
      }
    },
    [gameImageTarget, load],
  );

  const closeUpdateImage = useCallback(() => {
    if (updatingImage) return;
    setUpdateImageOpen(false);
    setUpdateImageId('');
    setUpdateImagePath('');
    setUpdateImageName('');
  }, [updatingImage]);

  const handleUpdateImage = useCallback(async () => {
    const imagePath = updateImagePath.trim();
    if (!updateImageId) {
      toast.error('Banner id is missing');
      return;
    }
    if (!imagePath) {
      toast.error('Please enter image URL');
      return;
    }

    setUpdatingImage(true);
    try {
      const res = await secureApi('ops.bannersUpdateImage', {
        _id: updateImageId,
        imagePath,
      });
      if (!res.ok) {
        toast.error(res.message || 'Failed to update banner image');
        return;
      }
      toast.success('Banner image updated successfully');
      setUpdateImageOpen(false);
      setUpdateImageId('');
      setUpdateImagePath('');
      setUpdateImageName('');
      void load();
    } finally {
      setUpdatingImage(false);
    }
  }, [load, updateImageId, updateImagePath]);

  const handleDelete = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await secureApi('ops.bannersDelete', { _id: activeId });
      if (!res.ok) {
        toast.error(res.message || 'Failed to delete banner');
        return;
      }
      toast.success('Banner deleted');
      setDeleteOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [activeId, load]);

  const columns = useMemo<CommonTableColumn<BannerRow>[]>(() => {
    const cols: CommonTableColumn<BannerRow>[] = [
      {
        id: 'index',
        label: '#',
        width: 56,
        render: (_row, index) => index + 1,
      },
      {
        id: 'image',
        label: 'Image',
        width: 108,
        render: (row) => {
          if (!row.imagePath && !isGameBanner(row)) return '—';
          const src = row.imagePath ? replaceS3WithCloudfront(row.imagePath) : null;
          const isVideo =
            Boolean(src) &&
            (src!.toLowerCase().includes('.mp4') || src!.toLowerCase().includes('video'));

          if (isGameBanner(row)) {
            return (
              <GameImageUploadCell
                imageUrl={src}
                alt={row.gameName || bannerGameId(row) || 'Banner game'}
                disabled={gameImageSaving || !bannerGameId(row)}
                onUpdate={() => openUpdateImage(row)}
                variant="wide"
                isVideo={isVideo}
              />
            );
          }

          if (!src) return '—';
          return (
            <GameImageUploadCell
              imageUrl={src}
              alt={row.gameName || 'Banner'}
              disabled={updatingImage}
              onUpdate={() => openUpdateImage(row)}
              variant="wide"
              isVideo={isVideo}
            />
          );
        },
      },
      {
        id: 'gameName',
        label: 'Game Name',
        width: 120,
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              maxWidth: 110,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mx: 'auto',
            }}
            title={row.gameName || undefined}
          >
            {row.gameName || '—'}
          </Typography>
        ),
      },
    ];

    if (canToggle) {
      cols.push({
        id: 'status',
        label: 'Status',
        width: 90,
        render: (row) => (
          <Switch
            size="small"
            checked={Boolean(row.status)}
            disabled={togglingId === row._id}
            onChange={(_e, checked) => void handleToggleStatus(row, checked)}
            color="warning"
          />
        ),
      });
    }

    cols.push(
      {
        id: 'type',
        label: 'Type',
        width: 100,
        render: (row) => (
          <Typography
            sx={{
              fontSize: 12,
              maxWidth: 90,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mx: 'auto',
            }}
            title={row.type || undefined}
          >
            {row.type || '—'}
          </Typography>
        ),
      },
      {
        id: 'position',
        label: 'Position',
        width: 140,
        render: (row) => {
          const draft = positionDrafts[row._id];
          const current = draft ?? String(row.position ?? '');
          const selectValue = current && POSITION_OPTIONS.includes(Number(current)) ? current : '';

          return (
            <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
              <TextField
                select
                size="small"
                value={selectValue}
                onChange={(e) =>
                  setPositionDrafts((prev) => ({ ...prev, [row._id]: e.target.value }))
                }
                sx={fieldSx}
              >
                <MenuItem value="">—</MenuItem>
                {POSITION_OPTIONS.map((n) => (
                  <MenuItem key={n} value={String(n)}>
                    {n}
                  </MenuItem>
                ))}
              </TextField>
              <IconButton
                size="small"
                aria-label="Save position"
                disabled={savingPositionId === row._id}
                onClick={() => void handleUpdatePosition(row)}
                sx={{ color: '#ff9f0a' }}
              >
                <SaveIcon fontSize="small" />
              </IconButton>
            </Stack>
          );
        },
      },
    );

    cols.push({
      id: 'action',
      label: 'Action',
      width: 100,
      render: (row) => (
        <Stack direction="row" spacing={0.25} justifyContent="center">
          <Tooltip title="Update image" arrow>
            <IconButton
              size="small"
              aria-label="Update banner image"
              onClick={() => openUpdateImage(row)}
              sx={{ color: '#ff9f0a' }}
            >
              <ImageIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {canDelete ? (
            <Tooltip title="Delete banner" arrow>
              <IconButton
                size="small"
                aria-label="Delete"
                onClick={() => openDelete(row)}
                sx={{ color: '#f44336' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      ),
    });

    return cols;
  }, [
    canToggle,
    canDelete,
    togglingId,
    handleToggleStatus,
    positionDrafts,
    savingPositionId,
    handleUpdatePosition,
    openUpdateImage,
    openDelete,
    gameImageSaving,
    updatingImage,
  ]);

  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1.5}
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          Banners List
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {canAdd ? (
            <>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openAdd}
                sx={orangeBtnSx}
              >
                Add
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setAddBannerOpen(true)}
                sx={orangeBtnSx}
              >
                Add Banner
              </Button>
              <Button
                variant="contained"
                startIcon={<VideoCallIcon />}
                onClick={() => {
                  setVideoType('');
                  setVideoFile(null);
                  setVideoOpen(true);
                }}
                sx={orangeBtnSx}
              >
                Upload Video
              </Button>
            </>
          ) : null}
          <Button
            variant="outlined"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={() => void load()}
            disabled={loading}
            sx={{
              borderColor: 'rgba(255,255,255,0.28)',
              color: '#e8e8ea',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#ff9f0a',
                bgcolor: 'rgba(255,159,10,0.08)',
              },
            }}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      <TablePanel>
        <CommonTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row._id}
          loading={loading}
          emptyMessage="No banners found"
          stickyHeader
          dense
          minWidth={1000}
          maxHeight="100%"
        />
      </TablePanel>

      <Dialog
        open={addOpen}
        onClose={() => !submitting && setAddOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <form onSubmit={(e) => void handleCreate(e)}>
          <DialogTitle>Add</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <TextField
                type="file"
                size="small"
                fullWidth
                inputProps={{ accept: 'image/*' }}
                onChange={(e) => void handleImageFile(e as ChangeEvent<HTMLInputElement>)}
                helperText={form.fileName || 'Choose banner image'}
              />
              <TextField
                label="Desktop Link"
                size="small"
                fullWidth
                value={form.desktopLink}
                onChange={(e) => setForm((prev) => ({ ...prev, desktopLink: e.target.value }))}
              />
              <TextField
                label="Game Name"
                size="small"
                fullWidth
                value={form.gameName}
                onChange={(e) => setForm((prev) => ({ ...prev, gameName: e.target.value }))}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="mobile-page-label">Mobile Page</InputLabel>
                  <Select
                    labelId="mobile-page-label"
                    label="Mobile Page"
                    value={form.mobilePage}
                    onChange={(e) => setForm((prev) => ({ ...prev, mobilePage: e.target.value }))}
                  >
                    {MOBILE_PAGE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                  <InputLabel id="mobile-options-label">Mobile Page Options</InputLabel>
                  <Select
                    labelId="mobile-options-label"
                    label="Mobile Page Options"
                    value={form.mobileOptions}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, mobileOptions: e.target.value }))
                    }
                  >
                    {MOBILE_PARAM_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value || 'none'} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl size="small" fullWidth required>
                  <InputLabel id="banner-type-label">Select Type</InputLabel>
                  <Select
                    labelId="banner-type-label"
                    label="Select Type"
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    {BANNER_TYPE_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" fullWidth required>
                  <InputLabel id="banner-category-label">Category</InputLabel>
                  <Select
                    labelId="banner-category-label"
                    label="Category"
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    {BANNER_CATEGORY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              {form.type === 'bonusScreenBanners' ? (
                <>
                  <TextField
                    label="Banner Title"
                    size="small"
                    fullWidth
                    value={form.bonusTitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, bonusTitle: e.target.value }))}
                  />
                  <TextField
                    label="Banner Subtitle"
                    size="small"
                    fullWidth
                    value={form.bonusSubtitle}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, bonusSubtitle: e.target.value }))
                    }
                  />
                </>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? 'Saving…' : 'Submit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <AddGameLaunchBannerModal
        open={addBannerOpen}
        onClose={() => setAddBannerOpen(false)}
        onSuccess={() => void load()}
      />

      <Dialog open={updateImageOpen} onClose={closeUpdateImage} fullWidth maxWidth="sm">
        <DialogTitle>
          Update Banner Image
          {updateImageName ? ` — ${updateImageName}` : ''}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label="Image URL"
            placeholder="https://d1abp4kt5r84bg.cloudfront.net/..."
            value={updateImagePath}
            onChange={(event) => setUpdateImagePath(event.target.value)}
          />
          {updateImagePath.trim() ? (
            <Box
              sx={{
                mt: 2,
                p: 1,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {updateImagePath.toLowerCase().includes('.mp4') ||
              updateImagePath.toLowerCase().includes('video') ? (
                <Box
                  component="video"
                  controls
                  src={replaceS3WithCloudfront(updateImagePath.trim())}
                  sx={{ width: '100%', maxHeight: 180, display: 'block' }}
                />
              ) : (
                <Box
                  component="img"
                  src={replaceS3WithCloudfront(updateImagePath.trim())}
                  alt="Banner preview"
                  sx={{
                    width: '100%',
                    maxHeight: 180,
                    objectFit: 'contain',
                    borderRadius: 1,
                    display: 'block',
                  }}
                />
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" onClick={closeUpdateImage} disabled={updatingImage}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleUpdateImage()}
            disabled={updatingImage}
            sx={orangeBtnSx}
          >
            {updatingImage ? <CircularProgress size={16} color="inherit" /> : 'Update Image'}
          </Button>
        </DialogActions>
      </Dialog>

      <UpdateGameImageDialog
        open={!!gameImageTarget}
        loading={gameImageSaving}
        target={gameImageTarget}
        onClose={() => setGameImageTarget(null)}
        onSubmit={(path) => void handleGameImageUpdate(path)}
      />

      <Dialog
        open={videoOpen}
        onClose={() => !submitting && setVideoOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <form onSubmit={(e) => void handleVideoSubmit(e)}>
          <DialogTitle>Upload Video</DialogTitle>
          <DialogContent>
            <Stack spacing={2} pt={1}>
              <FormControl size="small" fullWidth required>
                <InputLabel id="video-type-label">Video Type</InputLabel>
                <Select
                  labelId="video-type-label"
                  label="Video Type"
                  value={videoType}
                  onChange={(e) => setVideoType(e.target.value)}
                >
                  {VIDEO_TYPE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                type="file"
                size="small"
                fullWidth
                inputProps={{ accept: 'video/*' }}
                onChange={(e) => {
                  const input = e.target as HTMLInputElement;
                  setVideoFile(input.files?.[0] ?? null);
                }}
                helperText={videoFile?.name || 'Choose video file'}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setVideoOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting} sx={orangeBtnSx}>
              {submitting ? 'Uploading…' : 'Submit'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => !submitting && setDeleteOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This banner will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDelete()}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
