import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import {
  darTodayIstDate,
  mergeDaySheetWithAllotments,
  validateBalanceImageFile,
  type BalanceType,
} from '@astro/shared/dailyAccountReport';

import type { EntryMode, UpdatedBy } from './types';
import {
  correctDailyBalance,
  darApiErrorMessage,
  fetchActiveAllotments,
  fetchDaySheet,
  upsertDailyBalance,
  type BalanceImagePart,
  type DaySheetItem,
} from './api';

type Args = {
  enabled: boolean;
  viewAllAllotments: boolean;
  updatedBy: UpdatedBy;
  allotmentVersion: number;
};

export function useDarDaySheet({
  enabled,
  viewAllAllotments,
  updatedBy,
  allotmentVersion,
}: Args) {
  const [date, setDate] = useState(darTodayIstDate());
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetItems, setSheetItems] = useState<DaySheetItem[]>([]);
  const [sheetError, setSheetError] = useState('');
  const [midFilter, setMidFilter] = useState('');
  const [allotCount, setAllotCount] = useState(0);
  const sheetGen = useRef(0);

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>('open');
  const [entryMidId, setEntryMidId] = useState('');
  const [entryMidLabel, setEntryMidLabel] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryRemark, setEntryRemark] = useState('');
  const [entryRowId, setEntryRowId] = useState('');
  const [entryImage, setEntryImage] = useState<BalanceImagePart | null>(null);
  const [entrySaving, setEntrySaving] = useState(false);

  const loadSheet = useCallback(async () => {
    if (!enabled) return;
    if (!viewAllAllotments && !updatedBy.userId) {
      setSheetError('User id missing — re-login and try again');
      setSheetItems([]);
      return;
    }
    const gen = ++sheetGen.current;
    setSheetLoading(true);
    setSheetError('');
    const scopeSubAdminId = viewAllAllotments ? undefined : updatedBy.userId;
    try {
      const [active, sheet] = await Promise.all([
        fetchActiveAllotments({ ...(scopeSubAdminId ? { subAdminId: scopeSubAdminId } : {}) }),
        fetchDaySheet({ date, ...(scopeSubAdminId ? { subAdminId: scopeSubAdminId } : {}) }),
      ]);
      if (gen !== sheetGen.current) return;
      const merged = mergeDaySheetWithAllotments({
        allotments: active.items,
        sheetItems: sheet.items,
        date,
        fallbackSubAdminId: updatedBy.userId,
        fallbackSubAdminName: updatedBy.userName,
      });
      setSheetItems(merged);
      setAllotCount(active.total || active.items.length);
      if (!merged.length) {
        setSheetError(
          viewAllAllotments
            ? 'No active MID allotments yet — allot a MID first'
            : 'No phones allotted to you for this date',
        );
      }
    } catch (error) {
      if (gen !== sheetGen.current) return;
      setSheetItems([]);
      setSheetError(darApiErrorMessage(error, 'Failed to load day sheet'));
    } finally {
      if (gen === sheetGen.current) setSheetLoading(false);
    }
  }, [date, enabled, updatedBy.userId, updatedBy.userName, viewAllAllotments]);

  useEffect(() => {
    void loadSheet();
  }, [loadSheet, allotmentVersion]);

  const filteredSheet = useMemo(() => {
    const q = midFilter.trim().toLowerCase();
    if (!q) return sheetItems;
    return sheetItems.filter(
      (item) =>
        item.mid.toLowerCase().includes(q) ||
        item.midId.toLowerCase().includes(q) ||
        item.subAdminName.toLowerCase().includes(q),
    );
  }, [midFilter, sheetItems]);

  const openEntry = (item: DaySheetItem, mode: EntryMode) => {
    const row = mode === 'close' ? item.close : mode === 'open' ? item.open : item.open || item.close;
    setEntryMode(mode);
    setEntryMidId(item.midId);
    setEntryMidLabel(item.mid || item.midId);
    setEntryAmount(
      row && mode === 'correct'
        ? String(row.amount)
        : mode !== 'correct' && row
          ? String(row.amount)
          : '',
    );
    setEntryRemark(mode === 'correct' ? '' : row?.remark || '');
    setEntryRowId(row?._id || '');
    setEntryImage(null);
    setEntryOpen(true);
  };

  const pickBalanceImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach a screenshot.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType || 'image/jpeg';
    const size = asset.fileSize || 0;
    const err = validateBalanceImageFile({ type, size: size || 1 });
    if (err && size > 0) {
      Alert.alert('Invalid image', err);
      return;
    }
    setEntryImage({
      uri: asset.uri,
      name: asset.fileName || `balance.${type.includes('png') ? 'png' : 'jpg'}`,
      type,
      size,
    });
  };

  const submitEntry = async () => {
    const amountNum = Number(String(entryAmount).replace(/,/g, ''));
    if (!entryMidId) {
      Alert.alert('MID required');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum < 0) {
      Alert.alert('Enter a valid amount');
      return;
    }
    if (entryMode === 'correct' && !entryRemark.trim()) {
      Alert.alert('Remark is required for correction');
      return;
    }
    setEntrySaving(true);
    try {
      if (entryMode === 'correct') {
        await correctDailyBalance({
          _id: entryRowId,
          amount: amountNum,
          remark: entryRemark.trim(),
          image: entryImage,
          updatedBy,
        });
        Alert.alert('Saved', 'Balance corrected');
      } else {
        try {
          await upsertDailyBalance({
            midId: entryMidId,
            type: entryMode as BalanceType,
            amount: amountNum,
            date,
            remark: entryRemark.trim() || undefined,
            image: entryImage,
            updatedBy,
          });
          Alert.alert(
            'Saved',
            entryMode === 'open' ? 'Opening balance saved' : 'Closing balance saved',
          );
        } catch (error) {
          const status = (error as { status?: number })?.status;
          if (status === 409) {
            const sheet = await fetchDaySheet({
              date,
              midId: entryMidId,
              ...(updatedBy.userId ? { subAdminId: updatedBy.userId } : {}),
            });
            const sheetRow = sheet.items.find((row) => row.midId === entryMidId) || sheet.items[0];
            const existing = entryMode === 'open' ? sheetRow?.open : sheetRow?.close;
            if (existing?._id) {
              setEntryMode('correct');
              setEntryRowId(existing._id);
              setEntryAmount(String(amountNum));
              setEntryRemark('');
              Alert.alert('Already recorded', 'Enter a remark to correct this balance.');
              return;
            }
          }
          throw error;
        }
      }
      setEntryOpen(false);
      await loadSheet();
    } catch (error) {
      Alert.alert('Error', darApiErrorMessage(error, 'Failed to save balance'));
    } finally {
      setEntrySaving(false);
    }
  };

  return {
    date,
    setDate,
    midFilter,
    setMidFilter,
    sheetLoading,
    sheetError,
    filteredSheet,
    allotCount,
    setAllotCount,
    loadSheet,
    openEntry,
    entryOpen,
    setEntryOpen,
    entryMode,
    entryMidLabel,
    entryAmount,
    setEntryAmount,
    entryRemark,
    setEntryRemark,
    entryImage,
    entrySaving,
    pickBalanceImage,
    submitEntry,
  };
}
