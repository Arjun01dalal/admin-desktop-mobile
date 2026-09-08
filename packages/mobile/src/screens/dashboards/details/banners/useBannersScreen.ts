import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  buildUpdateGameImagePayload,
  type GameImageUpdateTarget,
} from '@astro/shared/updateGameImage';
import type { DataTableColumn } from '../../../../dashboards/ui/DataTable';
import { secureApi } from '../../../../api/client';
import { hasPermission } from '../../../../auth/permissions';
import { replaceS3WithCloudfront } from '../../../../utils/cdnUrl';
import { GAME_LAUNCH_CATEGORY } from './constants';
import {
  EMPTY_ADD,
  asList,
  bannerGameId,
  bannerProvider,
  display,
  isGameBanner,
  type AddForm,
  type Row,
} from './helpers';
import type { SheetAction } from '../RowDetailSheet';

export function useBannersScreen() {
  const canAdd = hasPermission('Add_Banner');
  const canToggle = hasPermission('Toggle_Banner');
  const canDelete = hasPermission('Delete_Banner');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [addMsg, setAddMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchMode, setLaunchMode] = useState<'existing' | 'new'>('existing');
  const [existingGameId, setExistingGameId] = useState('');
  const [existingGameName, setExistingGameName] = useState('');
  const [existingProvider, setExistingProvider] = useState('');
  const [newGameName, setNewGameName] = useState('');
  const [newGameId, setNewGameId] = useState('');
  const [newImagePath, setNewImagePath] = useState('');
  const [newImageKey, setNewImageKey] = useState('');
  const [newGameData, setNewGameData] = useState('');
  const [newType, setNewType] = useState('banner');
  const [newDeepLink, setNewDeepLink] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [launchMsg, setLaunchMsg] = useState('');

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoType, setVideoType] = useState('');
  const [videoUri, setVideoUri] = useState('');
  const [videoName, setVideoName] = useState('');
  const [videoMime, setVideoMime] = useState('video/mp4');
  const [videoMsg, setVideoMsg] = useState('');

  const [positionRow, setPositionRow] = useState<Row | null>(null);
  const [positionDraft, setPositionDraft] = useState('');
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionMsg, setPositionMsg] = useState('');

  const [updateImageOpen, setUpdateImageOpen] = useState(false);
  const [updateImageId, setUpdateImageId] = useState('');
  const [updateImagePath, setUpdateImagePath] = useState('');
  const [updateImageName, setUpdateImageName] = useState('');
  const [updatingImage, setUpdatingImage] = useState(false);
  const [updateImageMsg, setUpdateImageMsg] = useState('');
  const [gameImageTarget, setGameImageTarget] = useState<GameImageUpdateTarget | null>(null);
  const [gameImageSaving, setGameImageSaving] = useState(false);

  const generation = useRef(0);

  const load = useCallback(async () => {
    const currentGeneration = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.bannersGetAll', {});
      if (currentGeneration !== generation.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load banners');
        setRows([]);
        return;
      }
      const list = asList<Row>(res.data).map((banner) => ({
        ...banner,
        imagePath: replaceS3WithCloudfront(banner.imagePath),
      }));
      setSheetRow(null);
      setRows([...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
    } finally {
      if (currentGeneration === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = useCallback(() => {
    setAddForm(EMPTY_ADD);
    setAddMsg('');
    setAddOpen(true);
  }, []);

  const closeAdd = useCallback(() => {
    if (!submitting) setAddOpen(false);
  }, [submitting]);

  const updateAddForm = useCallback((patch: Partial<AddForm>) => {
    setAddForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const openLaunch = useCallback(() => {
    setLaunchMode('existing');
    setExistingGameId('');
    setExistingGameName('');
    setExistingProvider('');
    setNewGameName('');
    setNewGameId('');
    setNewImagePath('');
    setNewImageKey('');
    setNewGameData('');
    setNewType('banner');
    setNewDeepLink('');
    setNewStatus('');
    setLaunchMsg('');
    setLaunchOpen(true);
  }, []);

  const closeLaunch = useCallback(() => {
    if (!submitting) setLaunchOpen(false);
  }, [submitting]);

  const openVideo = useCallback(() => {
    setVideoType('');
    setVideoUri('');
    setVideoName('');
    setVideoMime('video/mp4');
    setVideoMsg('');
    setVideoOpen(true);
  }, []);

  const closeVideo = useCallback(() => {
    if (!submitting) setVideoOpen(false);
  }, [submitting]);

  const pickBannerImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.9,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setAddMsg('Could not read the selected image');
      return;
    }
    const mime = asset.mimeType || 'image/jpeg';
    const name = asset.fileName || `banner_${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`;
    updateAddForm({
      imageDataUrl: `data:${mime};base64,${asset.base64}`,
      fileName: name,
    });
    setAddMsg('');
  }, [updateAddForm]);

  const submitAdd = useCallback(async () => {
    if (!addForm.imageDataUrl) {
      setAddMsg('Choose an image file');
      return;
    }
    if (!addForm.desktopLink.trim()) {
      setAddMsg('Enter desktop link');
      return;
    }
    if (!addForm.gameName.trim()) {
      setAddMsg('Enter game name');
      return;
    }
    if (!addForm.type) {
      setAddMsg('Select type');
      return;
    }
    if (!addForm.category) {
      setAddMsg('Select category');
      return;
    }
    if (addForm.type === 'bonusScreenBanners' && !addForm.bonusTitle.trim()) {
      setAddMsg('Enter banner title');
      return;
    }
    if (addForm.type === 'bonusScreenBanners' && !addForm.bonusSubtitle.trim()) {
      setAddMsg('Enter banner subtitle');
      return;
    }

    setSubmitting(true);
    setAddMsg('');
    try {
      const payload: Record<string, unknown> = {
        iframeUrlMob: addForm.mobilePage,
        iframeUrl: addForm.desktopLink.trim(),
        type: addForm.type,
        File_Name: addForm.fileName,
        Image: addForm.imageDataUrl,
        gameName: addForm.gameName.trim(),
        category: addForm.category,
        deepLink: true,
        mobileRouter: addForm.mobilePage,
        mobileOptions: addForm.mobileOptions,
        status: true,
      };
      if (addForm.type === 'bonusScreenBanners') {
        payload.decryption = {
          title: addForm.bonusTitle.trim(),
          subTitle: addForm.bonusSubtitle.trim(),
        };
      }
      const res = await secureApi<unknown>('ops.bannersCreate', payload);
      if (!res.ok) {
        setAddMsg(res.message || 'Failed to add banner');
        return;
      }
      setAddOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [addForm, load]);

  const submitLaunch = useCallback(async () => {
    setLaunchMsg('');
    setSubmitting(true);
    try {
      if (launchMode === 'existing') {
        if (!existingGameId.trim() || !existingGameName.trim() || !existingProvider) {
          setLaunchMsg('Fill Game ID, Game Name and Provider');
          return;
        }
        const res = await secureApi<unknown>('ops.bannersCreateGameLaunch', {
          gameId: existingGameId.trim(),
          providerName: existingProvider,
          gameName: existingGameName.trim(),
          category: GAME_LAUNCH_CATEGORY,
        });
        if (!res.ok) {
          setLaunchMsg(res.message || 'Failed to add banner');
          return;
        }
      } else {
        if (
          !newGameName.trim() ||
          !newGameId.trim() ||
          !newImagePath.trim() ||
          !newImageKey.trim() ||
          !newGameData.trim() ||
          !newType ||
          newDeepLink === '' ||
          newStatus === ''
        ) {
          setLaunchMsg('Please fill all required fields');
          return;
        }
        let gameData: unknown;
        try {
          gameData = JSON.parse(newGameData);
        } catch {
          setLaunchMsg('Game data must be a valid JSON object');
          return;
        }
        const res = await secureApi<unknown>('ops.bannersCreateWithGameData', {
          gameName: newGameName.trim(),
          category: GAME_LAUNCH_CATEGORY,
          imagePath: newImagePath.trim(),
          imageKey: newImageKey.trim(),
          gameId: newGameId.trim(),
          gameData,
          type: newType,
          deepLink: newDeepLink === 'true',
          status: newStatus === 'true',
        });
        if (!res.ok) {
          setLaunchMsg(res.message || 'Failed to add banner');
          return;
        }
      }
      setLaunchOpen(false);
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [
    existingGameId,
    existingGameName,
    existingProvider,
    launchMode,
    load,
    newDeepLink,
    newGameData,
    newGameId,
    newGameName,
    newImageKey,
    newImagePath,
    newStatus,
    newType,
  ]);

  const pickVideo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    const name =
      asset.fileName ||
      `video_${Date.now()}.${(asset.mimeType || 'video/mp4').split('/')[1] || 'mp4'}`;
    if (!/\.(mp4|webm|mov|m4v|avi)$/i.test(name) && !asset.mimeType?.startsWith('video/')) {
      setVideoMsg('Only video uploads are allowed (mp4, webm, mov, m4v, avi)');
      return;
    }
    let safeName = name;
    if (!/\.(mp4|webm|mov|m4v|avi)$/i.test(safeName)) {
      safeName = `${safeName.replace(/\.[^.]+$/, '') || 'video'}.mp4`;
    }
    setVideoUri(asset.uri);
    setVideoName(safeName);
    setVideoMime(asset.mimeType || 'video/mp4');
    setVideoMsg('');
  }, []);

  const submitVideo = useCallback(async () => {
    if (!videoType) {
      setVideoMsg('Select video type');
      return;
    }
    if (!videoUri || !videoName) {
      setVideoMsg('No file selected');
      return;
    }
    setSubmitting(true);
    setVideoMsg('');
    try {
      const res = await secureApi<unknown>('ops.bannersUploadVideo', {
        videoUri,
        fileName: videoName,
        videoType,
        mimeType: videoMime,
      });
      if (!res.ok) {
        setVideoMsg(res.message || 'Video upload failed');
        return;
      }
      setVideoOpen(false);
      Alert.alert('Success', res.message || 'Tutorial video uploaded successfully');
      void load();
    } finally {
      setSubmitting(false);
    }
  }, [load, videoMime, videoName, videoType, videoUri]);

  const toggleStatus = useCallback(
    (row: Row) => {
      const next = !row.status;
      Alert.alert(
        next ? 'Enable banner' : 'Disable banner',
        `${next ? 'Enable' : 'Disable'} ${display(row.gameName)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: next ? 'Enable' : 'Disable',
            style: next ? 'default' : 'destructive',
            onPress: () => {
              void (async () => {
                const res = await secureApi<unknown>('ops.bannersUpdate', {
                  _id: row._id,
                  status: next,
                });
                if (res.ok) {
                  setSheetRow(null);
                  void load();
                } else {
                  setError(res.message || 'Failed to update status');
                  setSheetRow(null);
                }
              })();
            },
          },
        ],
      );
    },
    [load],
  );

  const openPosition = useCallback((row: Row) => {
    setPositionRow(row);
    setPositionDraft(row.position != null ? String(row.position) : '');
    setPositionMsg('');
    setSheetRow(null);
  }, []);

  const submitPosition = useCallback(async () => {
    const row = positionRow;
    if (!row) return;
    const position = Number(positionDraft);
    if (!position || position < 1 || position > 25) {
      setPositionMsg('Please select a valid position (1-25)');
      return;
    }
    setSavingPosition(true);
    setPositionMsg('');
    try {
      const res = await secureApi<unknown>('ops.bannersUpdatePosition', {
        _id: row._id,
        position,
      });
      if (!res.ok) {
        setPositionMsg(res.message || 'Failed to update position');
        return;
      }
      setPositionRow(null);
      void load();
    } finally {
      setSavingPosition(false);
    }
  }, [load, positionDraft, positionRow]);

  const openUpdateImage = useCallback((row: Row) => {
    if (isGameBanner(row)) {
      const gameId = bannerGameId(row);
      const provider = bannerProvider(row);
      if (!gameId) {
        Alert.alert('Error', 'Game ID is required');
        return;
      }
      if (!provider) {
        Alert.alert('Error', 'Provider is required');
        return;
      }
      setGameImageTarget({
        gameId,
        provider,
        name: row.gameName || gameId,
        currentImageUrl: row.imagePath ? replaceS3WithCloudfront(row.imagePath) : '',
      });
      setSheetRow(null);
      return;
    }
    setUpdateImageId(String(row._id || ''));
    setUpdateImagePath(row.imagePath || '');
    setUpdateImageName(row.gameName || '');
    setUpdateImageMsg('');
    setUpdateImageOpen(true);
    setSheetRow(null);
  }, []);

  const closeUpdateImage = useCallback(() => {
    if (updatingImage) return;
    setUpdateImageOpen(false);
    setUpdateImageId('');
    setUpdateImagePath('');
    setUpdateImageName('');
    setUpdateImageMsg('');
  }, [updatingImage]);

  const submitUpdateImage = useCallback(async () => {
    const imagePath = updateImagePath.trim();
    if (!updateImageId) {
      setUpdateImageMsg('Banner id is missing');
      return;
    }
    if (!imagePath) {
      setUpdateImageMsg('Please enter image URL');
      return;
    }
    setUpdatingImage(true);
    setUpdateImageMsg('');
    try {
      const res = await secureApi<unknown>('ops.bannersUpdateImage', {
        _id: updateImageId,
        imagePath,
      });
      if (!res.ok) {
        setUpdateImageMsg(res.message || 'Failed to update banner image');
        return;
      }
      Alert.alert('Success', 'Banner image updated successfully');
      setUpdateImageOpen(false);
      setUpdateImageId('');
      setUpdateImagePath('');
      setUpdateImageName('');
      void load();
    } finally {
      setUpdatingImage(false);
    }
  }, [load, updateImageId, updateImagePath]);

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
        const res = await secureApi<unknown>('topGames.updateImage', payload);
        if (!res.ok) {
          Alert.alert('Error', res.message || 'Failed to update game image');
          return;
        }
        Alert.alert('Success', 'Game image updated successfully');
        setGameImageTarget(null);
        void load();
      } finally {
        setGameImageSaving(false);
      }
    },
    [gameImageTarget, load],
  );

  const deleteBanner = useCallback(
    (row: Row) => {
      Alert.alert('Delete banner', 'This banner will be permanently removed.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const res = await secureApi<unknown>('ops.bannersDelete', { _id: row._id });
              if (res.ok) {
                setSheetRow(null);
                void load();
              } else {
                setError(res.message || 'Failed to delete banner');
                setSheetRow(null);
              }
            })();
          },
        },
      ]);
    },
    [load],
  );

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_row, index) => String(index + 1) },
      { key: 'gameName', label: 'Game Name', width: 100, render: (row) => display(row.gameName) },
      { key: 'type', label: 'Type', width: 80, render: (row) => display(row.type) },
      {
        key: 'position',
        label: 'Position',
        width: 90,
        align: 'center',
        render: (row) => display(row.position),
      },
      {
        key: 'status',
        label: 'Status',
        width: 90,
        render: (row) => (row.status ? 'Active' : 'Inactive'),
      },
      {
        key: 'imagePath',
        label: 'Image Path',
        width: 220,
        render: (row) => display(row.imagePath),
      },
    ],
    [],
  );

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const actions: SheetAction[] = [];
    if (canToggle) {
      actions.push({
        label: sheetRow.status ? 'Disable' : 'Enable',
        tone: sheetRow.status ? 'warning' : 'primary',
        onPress: () => toggleStatus(sheetRow),
      });
    }
    actions.push(
      {
        label: 'Set position',
        tone: 'primary',
        onPress: () => openPosition(sheetRow),
      },
      {
        label: 'Update Image',
        tone: 'primary',
        onPress: () => openUpdateImage(sheetRow),
      },
    );
    if (canDelete) {
      actions.push({
        label: 'Delete',
        tone: 'warning',
        onPress: () => deleteBanner(sheetRow),
      });
    }
    return actions;
  }, [canDelete, canToggle, deleteBanner, openPosition, openUpdateImage, sheetRow, toggleStatus]);

  return {
    canAdd,
    loading,
    error,
    rows,
    sheetRow,
    setSheetRow,
    load,
    columns,
    sheetActions,
    addOpen,
    addForm,
    addMsg,
    submitting,
    openAdd,
    closeAdd,
    updateAddForm,
    pickBannerImage,
    submitAdd,
    launchOpen,
    launchMode,
    existingGameId,
    existingGameName,
    existingProvider,
    newGameName,
    newGameId,
    newImagePath,
    newImageKey,
    newGameData,
    newType,
    newDeepLink,
    newStatus,
    launchMsg,
    openLaunch,
    closeLaunch,
    setLaunchMode,
    setExistingGameId,
    setExistingGameName,
    setExistingProvider,
    setNewGameName,
    setNewGameId,
    setNewImagePath,
    setNewImageKey,
    setNewGameData,
    setNewType,
    setNewDeepLink,
    setNewStatus,
    submitLaunch,
    videoOpen,
    videoType,
    videoName,
    videoMsg,
    openVideo,
    closeVideo,
    setVideoType,
    pickVideo,
    submitVideo,
    positionRow,
    positionDraft,
    positionMsg,
    savingPosition,
    setPositionRow,
    setPositionDraft,
    submitPosition,
    updateImageOpen,
    updateImageName,
    updateImagePath,
    updateImageMsg,
    updatingImage,
    closeUpdateImage,
    setUpdateImagePath,
    submitUpdateImage,
    gameImageTarget,
    gameImageSaving,
    setGameImageTarget,
    handleGameImageUpdate,
  };
}
