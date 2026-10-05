/**
 * Ludo Player Wise RTP — mobile port of desktop LudoPlayerWiseRtpPage /
 * admin-panel-domains LudoPlayerWiseRtp.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { secureApi } from '../../../api/client';
import { parseLudoGameOptions } from '../../../dashboards/gameMetrics';
import { toDisplayText } from '../../../dashboards/jyotish/jyotishMapping';
import { colors, spacing} from '../../../theme';
import { RowDetailSheet, type SheetField } from './RowDetailSheet';
import { styles } from './LudoPlayerWiseRtpScreen.styles';

type GameOption = { value: string; label: string };

type RtpUserRow = {
  userId?: string;
  gameId?: string;
  rtp?: number | string;
  houseEdge?: number | string;
  source?: string;
  operatorId?: string;
  updatedOn?: number | string;
  name?: string;
  mobile?: string;
  [key: string]: unknown;
};

type GameBound = { minRtp?: number; maxRtp?: number };
type GameBoundsMap = Record<string, GameBound>;

function unpackPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return {};
  const obj = data as Record<string, unknown>;
  if (obj.payload && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
    return obj.payload as Record<string, unknown>;
  }
  return obj;
}

function extractList(payload: unknown): RtpUserRow[] {
  if (Array.isArray(payload)) return payload as RtpUserRow[];
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  for (const key of ['overrides', 'data', 'users', 'list', 'items'] as const) {
    if (Array.isArray(obj[key])) return obj[key] as RtpUserRow[];
  }
  return [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function formatUpdatedOn(value?: number | string) {
  if (value === undefined || value === null || value === '') return '—';
  const ts = Number(value);
  if (Number.isNaN(ts)) return String(value);
  return new Date(ts).toLocaleString('en-IN');
}

function formatRtpBound(value?: number) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(3);
}

export function LudoPlayerWiseRtpScreen() {
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const initialGameId =
    typeof params.gameId === 'string' && params.gameId !== 'All' ? params.gameId : '';
  const initialOptions = Array.isArray(params.gameOptions)
    ? (params.gameOptions as GameOption[])
        .map((option) => ({
          value: String(option.value ?? ''),
          label: String(option.label ?? option.value ?? ''),
        }))
        .filter((option) => option.value && option.value !== 'All')
    : [];

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RtpUserRow[]>([]);
  const [gameBounds, setGameBounds] = useState<GameBoundsMap>({});
  const [showGameBounds, setShowGameBounds] = useState(false);
  const [gameOptions, setGameOptions] = useState<GameOption[]>(initialOptions);
  const [filterGameId, setFilterGameId] = useState(initialGameId);
  const [filterUserId, setFilterUserId] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  const [selected, setSelected] = useState<RtpUserRow | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formUserId, setFormUserId] = useState('');
  const [formGameId, setFormGameId] = useState('');
  const [formRtp, setFormRtp] = useState('');

  const filteredRows = useMemo(() => {
    const q = searchUserId.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const userId = String(row?.userId ?? '').toLowerCase();
      const gameId = String(row?.gameId ?? '').toLowerCase();
      const source = String(row?.source ?? '').toLowerCase();
      return userId.includes(q) || gameId.includes(q) || source.includes(q);
    });
  }, [rows, searchUserId]);

  const gameBoundEntries = useMemo(
    () =>
      Object.entries(gameBounds).sort(([a], [b]) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' }),
      ),
    [gameBounds],
  );

  const loadGameIds = useCallback(async () => {
    if (initialOptions.length) {
      setGameOptions(initialOptions);
      return;
    }
    const res = await secureApi('dashboard.ludoGameIds', {});
    if (!res.ok) return;
    const options = parseLudoGameOptions(res.data).filter(
      (option) => option.value && option.value !== 'All',
    );
    setGameOptions(options);
  }, [initialOptions]);

  const fetchUsersRtp = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi('dashboard.ludoPlayerRtpUsers', {});
      if (!res.ok) {
        setRows([]);
        setGameBounds({});
        setError(res.message || 'Failed to fetch player RTP list');
        return;
      }
      const payload = unpackPayload(res.data);
      const opts = parseLudoGameOptions(payload.supportedGames);
      if (opts.length) setGameOptions(opts.filter((g) => g.value !== 'All'));

      const bounds =
        payload.gameBounds && typeof payload.gameBounds === 'object' && !Array.isArray(payload.gameBounds)
          ? (payload.gameBounds as GameBoundsMap)
          : {};
      setGameBounds(bounds);

      const list = extractList(payload);
      const userId = filterUserId.trim().toLowerCase();
      const gameId = filterGameId.trim().toLowerCase();
      setRows(
        list.filter((row) => {
          const rowUserId = String(row?.userId ?? '').toLowerCase();
          const rowGameId = String(row?.gameId ?? '').toLowerCase();
          if (userId && !rowUserId.includes(userId)) return false;
          if (gameId && rowGameId !== gameId) return false;
          return true;
        }),
      );
    } catch {
      setRows([]);
      setGameBounds({});
      setError('Failed to fetch player RTP list');
    } finally {
      setLoading(false);
    }
  }, [filterGameId, filterUserId]);

  useEffect(() => {
    void loadGameIds();
    void fetchUsersRtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load
  }, []);

  const openCreateDialog = useCallback(
    (row?: RtpUserRow) => {
      setFormUserId(String(row?.userId ?? ''));
      setFormGameId(String(row?.gameId ?? filterGameId ?? gameOptions[0]?.value ?? ''));
      setFormRtp(row?.rtp !== undefined && row?.rtp !== null ? String(row.rtp) : '');
      setSelected(null);
      setDialogOpen(true);
    },
    [filterGameId, gameOptions],
  );

  const handleSaveRtp = useCallback(async () => {
    const userId = formUserId.trim();
    const gameId = formGameId.trim();
    const rtp = Number(formRtp);
    if (!userId) {
      Alert.alert('User ID is required');
      return;
    }
    if (!gameId) {
      Alert.alert('Game ID is required');
      return;
    }
    if (formRtp === '' || Number.isNaN(rtp)) {
      Alert.alert('Please enter a valid RTP value');
      return;
    }
    setSaving(true);
    try {
      const res = await secureApi('dashboard.ludoPlayerRtpUsersSet', { userId, gameId, rtp });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to save player RTP');
        return;
      }
      Alert.alert(res.message || 'Player RTP saved successfully');
      setDialogOpen(false);
      void fetchUsersRtp();
    } finally {
      setSaving(false);
    }
  }, [formUserId, formGameId, formRtp, fetchUsersRtp]);

  const sheetFields: SheetField[] = useMemo(() => {
    if (!selected) return [];
    return [
      { label: 'User ID', value: display(selected.userId) },
      { label: 'Game ID', value: display(selected.gameId) },
      { label: 'RTP', value: display(selected.rtp) },
      { label: 'House Edge', value: display(selected.houseEdge) },
      { label: 'Source', value: display(selected.source) },
      { label: 'Operator', value: display(selected.operatorId) },
      { label: 'Updated On', value: formatUpdatedOn(selected.updatedOn) },
      { label: 'Name', value: display(selected.name) },
      { label: 'Mobile', value: display(selected.mobile) },
    ];
  }, [selected]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void fetchUsersRtp()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>{toDisplayText('Player Wise RTP')}</Text>
      <Text style={styles.sub}>Total: {filteredRows.length}</Text>

      <TextInput
        style={styles.input}
        value={filterUserId}
        onChangeText={setFilterUserId}
        placeholder="Filter User ID"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={searchUserId}
        onChangeText={setSearchUserId}
        placeholder="Search userId / gameId / source"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
      />

      <Text style={styles.filterLabel}>Game</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <TouchableOpacity
          style={[styles.chip, !filterGameId && styles.chipActive]}
          onPress={() => setFilterGameId('')}
        >
          <Text style={[styles.chipText, !filterGameId && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {gameOptions.map((option) => {
          const active = filterGameId === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilterGameId(option.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => void fetchUsersRtp()}
          disabled={loading}
        >
          <Text style={styles.actionBtnPrimaryText}>{loading ? 'Loading…' : 'Apply'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnAccent]}
          onPress={() => openCreateDialog()}
        >
          <Text style={styles.actionBtnAccentText}>Set Player RTP</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {gameBoundEntries.length > 0 ? (
        <View style={styles.boundsBox}>
          <TouchableOpacity
            style={styles.boundsHeader}
            onPress={() => setShowGameBounds((v) => !v)}
          >
            <Text style={styles.boundsTitle}>Game Bounds ({gameBoundEntries.length})</Text>
            <Text style={styles.boundsToggle}>{showGameBounds ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
          {showGameBounds
            ? gameBoundEntries.map(([gameId, bound]) => (
                <View key={gameId} style={styles.boundCard}>
                  <Text style={styles.boundGame}>{gameId}</Text>
                  <View style={styles.boundRow}>
                    <Text style={styles.boundMin}>Min {formatRtpBound(bound?.minRtp)}</Text>
                    <Text style={styles.boundMax}>Max {formatRtpBound(bound?.maxRtp)}</Text>
                  </View>
                </View>
              ))
            : null}
        </View>
      ) : null}

      {loading && !filteredRows.length ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing(6) }} />
      ) : null}

      {!loading && !filteredRows.length && !error ? (
        <Text style={styles.empty}>No player RTP records found</Text>
      ) : null}

      <View style={styles.list}>
        {filteredRows.map((row, index) => (
          <TouchableOpacity
            key={`${row.userId}-${row.gameId}-${index}`}
            style={styles.card}
            onPress={() => setSelected(row)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardIndex}>{index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {display(row.userId)}
              </Text>
              <TouchableOpacity
                style={styles.editChip}
                onPress={() => openCreateDialog(row)}
              >
                <Text style={styles.editChipText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.cardMeta}>Game: {display(row.gameId)}</Text>
            <Text style={styles.cardMeta}>RTP: {display(row.rtp)}</Text>
            <Text style={styles.cardMeta}>Updated: {formatUpdatedOn(row.updatedOn)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <RowDetailSheet
        visible={!!selected}
        title={display(selected?.userId)}
        fields={sheetFields}
        actions={[
          {
            label: 'Edit RTP',
            onPress: () => {
              if (selected) openCreateDialog(selected);
            },
          },
        ]}
        onClose={() => setSelected(null)}
      />

      <Modal
        visible={dialogOpen}
        transparent
        animationType="slide"
        onRequestClose={() => !saving && setDialogOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => !saving && setDialogOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Set Player RTP</Text>
            <TextInput
              style={styles.input}
              value={formUserId}
              onChangeText={setFormUserId}
              placeholder="User ID"
              placeholderTextColor={colors.muted}
              editable={!saving}
              autoCapitalize="none"
            />
            <Text style={styles.filterLabel}>Game ID</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {gameOptions.map((option) => {
                const active = formGameId === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFormGameId(option.value)}
                    disabled={saving}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              value={formRtp}
              onChangeText={setFormRtp}
              placeholder="RTP e.g. 0.95"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              editable={!saving}
            />
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setDialogOpen(false)}
                disabled={saving}
              >
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, saving && styles.btnDisabled]}
                onPress={() => void handleSaveRtp()}
                disabled={saving}
              >
                <Text style={styles.formBtnPrimaryText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

