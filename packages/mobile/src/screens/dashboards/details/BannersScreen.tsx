/**
 * Banners List — port of desktop BannersPage / Laxmi Banner Games.
 * Header actions (Add_Banner permission): Add, Add Banner, Upload Video.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import {
  BANNER_CATEGORY_OPTIONS,
  BANNER_TYPE_OPTIONS,
  GAME_LAUNCH_CATEGORY,
  GAME_LAUNCH_PROVIDERS,
  MOBILE_PAGE_OPTIONS,
  MOBILE_PARAM_OPTIONS,
  VIDEO_TYPE_OPTIONS,
} from './bannersConstants';

type Row = {
  _id?: string;
  imagePath?: string;
  gameName?: string;
  type?: string;
  status?: boolean;
  position?: number;
  [key: string]: unknown;
};

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

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['payload', 'items', 'data']) {
      const v = obj[key];
      if (Array.isArray(v)) return v as T[];
      if (v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).items)) {
        return (v as Record<string, unknown>).items as T[];
      }
    }
  }
  return [];
}

function ChipSelect({
  options,
  value,
  onChange,
}: {
  options: readonly { value: string; label: string }[] | readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const normalized = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  return (
    <View style={styles.chipsRow}>
      {normalized.map((o, oi) => (
        <TouchableOpacity
          key={`chip-${oi}-${o.value || o.label}`}
          style={[styles.chip, value === o.value && styles.chipActive]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[styles.chipText, value === o.value && styles.chipTextActive]}>
            {o.label || 'None'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ModalShell({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function BannersScreen() {
  const canAdd = hasPermission('Add_Banner');
  const canToggle = hasPermission('Toggle_Banner');
  const canDelete = hasPermission('Delete_Banner');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);

  // Add (image banner)
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>(EMPTY_ADD);
  const [addMsg, setAddMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Add Banner (game launch)
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

  // Upload Video
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoType, setVideoType] = useState('');
  const [videoUri, setVideoUri] = useState('');
  const [videoName, setVideoName] = useState('');
  const [videoMime, setVideoMime] = useState('video/mp4');
  const [videoMsg, setVideoMsg] = useState('');

  // Set position
  const [positionRow, setPositionRow] = useState<Row | null>(null);
  const [positionDraft, setPositionDraft] = useState('');
  const [savingPosition, setSavingPosition] = useState(false);
  const [positionMsg, setPositionMsg] = useState('');
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.bannersGetAll', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load banners');
        setRows([]);
        return;
      }
      const list = asList<Row>(res.data);
      const sorted = [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      setSheetRow(null);
      setRows(sorted);
    } finally {
      if (gen === genRef.current) setLoading(false);
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

  const openVideo = useCallback(() => {
    setVideoType('');
    setVideoUri('');
    setVideoName('');
    setVideoMime('video/mp4');
    setVideoMsg('');
    setVideoOpen(true);
  }, []);

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
    const name =
      asset.fileName ||
      `banner_${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`;
    setAddForm((prev) => ({
      ...prev,
      imageDataUrl: `data:${mime};base64,${asset.base64}`,
      fileName: name,
    }));
    setAddMsg('');
  }, []);

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
    load,
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
  }, [videoType, videoUri, videoName, videoMime, load]);

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

  const submitPosition = useCallback(async () => {
    const row = positionRow;
    if (!row) return;
    const position = Number(positionDraft);
    if (!position || position < 1) {
      setPositionMsg('Please enter a valid position');
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
  }, [positionRow, positionDraft, load]);

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
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'gameName', label: 'Game Name', width: 100, render: (r) => display(r.gameName) },
      { key: 'type', label: 'Type', width: 80, render: (r) => display(r.type) },
      {
        key: 'position',
        label: 'Position',
        width: 90,
        align: 'center',
        render: (r) => display(r.position),
      },
      { key: 'status', label: 'Status', width: 90, render: (r) => (r.status ? 'Active' : 'Inactive') },
      { key: 'imagePath', label: 'Image Path', width: 220, render: (r) => display(r.imagePath) },
    ],
    [],
  );

  const sheetActions: SheetAction[] = [];
  if (sheetRow) {
    if (canToggle) {
      sheetActions.push({
        label: sheetRow.status ? 'Disable' : 'Enable',
        tone: sheetRow.status ? 'warning' : 'primary',
        onPress: () => toggleStatus(sheetRow),
      });
    }
    sheetActions.push({
      label: 'Set position',
      tone: 'primary',
      onPress: () => {
        setPositionRow(sheetRow);
        setPositionDraft(sheetRow.position != null ? String(sheetRow.position) : '');
        setPositionMsg('');
        setSheetRow(null);
      },
    });
    if (canDelete) {
      sheetActions.push({
        label: 'Delete',
        tone: 'warning',
        onPress: () => deleteBanner(sheetRow),
      });
    }
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Banners List</Text>
      <Text style={styles.sub}>Total: {rows.length.toLocaleString('en-IN')}</Text>

      {canAdd ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.actionRow}
          contentContainerStyle={styles.actionRowContent}
        >
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openLaunch}>
            <Text style={styles.addBtnText}>Add Banner</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openVideo}>
            <Text style={styles.addBtnText}>Upload Video</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No banners found</Text>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const active = Boolean(row.status);
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.gameName)}
                </Text>
                <Text style={[styles.statusPill, active ? styles.statusOn : styles.statusOff]}>
                  {active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Type: {display(row.type)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  Pos: {display(row.position)}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details & actions</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.gameName) : ''}
        imageUri={sheetRow?.imagePath || undefined}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(sheetRow, 0),
                  multiline: c.key === 'imagePath',
                }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <ModalShell
        visible={positionRow !== null}
        title={`Set position${positionRow ? ` — ${display(positionRow.gameName)}` : ''}`}
        onClose={() => setPositionRow(null)}
      >
        <TextInput
          style={styles.input}
          value={positionDraft}
          onChangeText={setPositionDraft}
          placeholder="Position (1-25)"
          placeholderTextColor={colors.muted}
          keyboardType="numeric"
        />
        <View style={styles.chipsRow}>
          {POSITION_OPTIONS.map((n) => (
            <TouchableOpacity
              key={n}
              style={[styles.chip, positionDraft === String(n) && styles.chipActive]}
              onPress={() => setPositionDraft(String(n))}
            >
              <Text
                style={[styles.chipText, positionDraft === String(n) && styles.chipTextActive]}
              >
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {positionMsg ? <Text style={styles.modalMsg}>{positionMsg}</Text> : null}
        <TouchableOpacity
          style={[styles.submitBtn, savingPosition && styles.btnDisabled]}
          disabled={savingPosition}
          onPress={() => void submitPosition()}
        >
          <Text style={styles.submitBtnText}>{savingPosition ? 'Saving…' : 'Save'}</Text>
        </TouchableOpacity>
      </ModalShell>

      {/* Add — image banner (Laxmi "Add") */}
      <ModalShell visible={addOpen} title="Add" onClose={() => !submitting && setAddOpen(false)}>
        <Text style={styles.fieldLabel}>Banner Image *</Text>
        <TouchableOpacity style={styles.pickBtn} onPress={() => void pickBannerImage()}>
          <Text style={styles.pickBtnText}>
            {addForm.fileName ? `Selected: ${addForm.fileName}` : 'Choose image'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.fieldLabel}>Desktop Link *</Text>
        <TextInput
          style={styles.input}
          value={addForm.desktopLink}
          onChangeText={(v) => setAddForm((p) => ({ ...p, desktopLink: v }))}
          placeholder="https://…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        <Text style={styles.fieldLabel}>Game Name *</Text>
        <TextInput
          style={styles.input}
          value={addForm.gameName}
          onChangeText={(v) => setAddForm((p) => ({ ...p, gameName: v }))}
          placeholder="Game name"
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.fieldLabel}>Mobile Page</Text>
        <ChipSelect
          options={MOBILE_PAGE_OPTIONS}
          value={addForm.mobilePage}
          onChange={(v) => setAddForm((p) => ({ ...p, mobilePage: v }))}
        />
        <Text style={styles.fieldLabel}>Mobile Page Options</Text>
        <ChipSelect
          options={MOBILE_PARAM_OPTIONS}
          value={addForm.mobileOptions}
          onChange={(v) => setAddForm((p) => ({ ...p, mobileOptions: v }))}
        />
        <Text style={styles.fieldLabel}>Select Type *</Text>
        <ChipSelect
          options={BANNER_TYPE_OPTIONS}
          value={addForm.type}
          onChange={(v) => setAddForm((p) => ({ ...p, type: v }))}
        />
        <Text style={styles.fieldLabel}>Category *</Text>
        <ChipSelect
          options={BANNER_CATEGORY_OPTIONS}
          value={addForm.category}
          onChange={(v) => setAddForm((p) => ({ ...p, category: v }))}
        />
        {addForm.type === 'bonusScreenBanners' ? (
          <>
            <Text style={styles.fieldLabel}>Banner Title *</Text>
            <TextInput
              style={styles.input}
              value={addForm.bonusTitle}
              onChangeText={(v) => setAddForm((p) => ({ ...p, bonusTitle: v }))}
              placeholder="Title"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Banner Subtitle *</Text>
            <TextInput
              style={styles.input}
              value={addForm.bonusSubtitle}
              onChangeText={(v) => setAddForm((p) => ({ ...p, bonusSubtitle: v }))}
              placeholder="Subtitle"
              placeholderTextColor={colors.muted}
            />
          </>
        ) : null}
        {addMsg ? <Text style={styles.modalMsg}>{addMsg}</Text> : null}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          disabled={submitting}
          onPress={() => void submitAdd()}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
        </TouchableOpacity>
      </ModalShell>

      {/* Add Banner — game launch */}
      <ModalShell
        visible={launchOpen}
        title="Add Banner"
        onClose={() => !submitting && setLaunchOpen(false)}
      >
        <Text style={styles.fieldLabel}>Banner Type</Text>
        <View style={styles.chipsRow}>
          {(
            [
              { value: 'existing', label: 'Already Exists' },
              { value: 'new', label: 'New' },
            ] as const
          ).map((o) => (
            <TouchableOpacity
              key={o.value}
              style={[styles.chip, launchMode === o.value && styles.chipActive]}
              onPress={() => setLaunchMode(o.value)}
            >
              <Text style={[styles.chipText, launchMode === o.value && styles.chipTextActive]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {launchMode === 'existing' ? (
          <>
            <Text style={styles.fieldLabel}>Game ID *</Text>
            <TextInput
              style={styles.input}
              value={existingGameId}
              onChangeText={setExistingGameId}
              placeholder="Game ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Game Name *</Text>
            <TextInput
              style={styles.input}
              value={existingGameName}
              onChangeText={setExistingGameName}
              placeholder="Game name"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Provider *</Text>
            <ChipSelect
              options={GAME_LAUNCH_PROVIDERS}
              value={existingProvider}
              onChange={setExistingProvider}
            />
          </>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Game Name *</Text>
            <TextInput
              style={styles.input}
              value={newGameName}
              onChangeText={setNewGameName}
              placeholder="Game name"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.fieldLabel}>Game ID *</Text>
            <TextInput
              style={styles.input}
              value={newGameId}
              onChangeText={setNewGameId}
              placeholder="Game ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Image Path *</Text>
            <TextInput
              style={styles.input}
              value={newImagePath}
              onChangeText={setNewImagePath}
              placeholder="https://…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Image Key *</Text>
            <TextInput
              style={styles.input}
              value={newImageKey}
              onChangeText={setNewImageKey}
              placeholder="Image key"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Game Data (JSON) *</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={newGameData}
              onChangeText={setNewGameData}
              placeholder='{"key":"value"}'
              placeholderTextColor={colors.muted}
              multiline
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Type *</Text>
            <ChipSelect
              options={[
                { value: 'banner', label: 'Banner' },
                { value: 'game', label: 'Game' },
              ]}
              value={newType}
              onChange={setNewType}
            />
            <Text style={styles.fieldLabel}>Deep Link *</Text>
            <ChipSelect
              options={[
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' },
              ]}
              value={newDeepLink}
              onChange={setNewDeepLink}
            />
            <Text style={styles.fieldLabel}>Status *</Text>
            <ChipSelect
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={newStatus}
              onChange={setNewStatus}
            />
          </>
        )}
        {launchMsg ? <Text style={styles.modalMsg}>{launchMsg}</Text> : null}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          disabled={submitting}
          onPress={() => void submitLaunch()}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
        </TouchableOpacity>
      </ModalShell>

      {/* Upload Video */}
      <ModalShell
        visible={videoOpen}
        title="Upload Video"
        onClose={() => !submitting && setVideoOpen(false)}
      >
        <Text style={styles.fieldLabel}>Video Type *</Text>
        <ChipSelect options={VIDEO_TYPE_OPTIONS} value={videoType} onChange={setVideoType} />
        <Text style={styles.fieldLabel}>Video File *</Text>
        <TouchableOpacity style={styles.pickBtn} onPress={() => void pickVideo()}>
          <Text style={styles.pickBtnText}>
            {videoName ? `Selected: ${videoName}` : 'Choose video'}
          </Text>
        </TouchableOpacity>
        {videoMsg ? <Text style={styles.modalMsg}>{videoMsg}</Text> : null}
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          disabled={submitting}
          onPress={() => void submitVideo()}
        >
          <Text style={styles.submitBtnText}>{submitting ? 'Uploading…' : 'Submit'}</Text>
        </TouchableOpacity>
      </ModalShell>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  actionRow: { marginTop: spacing(3), flexGrow: 0 },
  actionRowContent: { gap: spacing(2), paddingRight: spacing(2) },
  addBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3.5),
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  statusOn: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.18)' },
  statusOff: { color: '#991b1b', backgroundColor: 'rgba(220,38,38,0.18)' },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing(5),
    paddingVertical: spacing(10),
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTouch: { ...StyleSheet.absoluteFillObject },
  modalSheet: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md * 2,
    padding: spacing(4),
    maxHeight: '100%',
  },
  modalScroll: { flexGrow: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(3), marginBottom: spacing(1) },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  pickBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
  },
  pickBtnText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(1) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
  btnDisabled: { opacity: 0.5 },
  submitBtn: {
    marginTop: spacing(4),
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  submitBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
});
