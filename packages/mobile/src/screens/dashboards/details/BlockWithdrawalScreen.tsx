/**
 * Block Withdrawal — mobile port of desktop BlockWithdrawalPage / Laxmi BlockWithdrawal.
 * Card list + bottom sheets for add/edit (limit / full / remove).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import {
  formatWithdrawalDate,
  formatWithdrawalMoney,
  isFullWithdrawalBlock,
  normalizeWithdrawalBlockRows,
  parseWithdrawalAmount,
  type WithdrawalBlockAddMode,
  type WithdrawalBlockEditMode,
  type WithdrawalBlockItem,
} from '@astro/shared';
import { colors } from '../../../theme';
import { secureApi } from '../../../api/client';
import { PAGE_SIZE_OPTIONS } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { styles } from './BlockWithdrawalScreen.styles';

export function BlockWithdrawalScreen() {
  const [userIdDraft, setUserIdDraft] = useState('');
  const [appliedUserId, setAppliedUserId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[1] ?? 25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<WithdrawalBlockItem[]>([]);
  const [sheetRow, setSheetRow] = useState<WithdrawalBlockItem | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addAmount, setAddAmount] = useState('');
  const [addMode, setAddMode] = useState<WithdrawalBlockAddMode>('limit');

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<WithdrawalBlockItem | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMode, setEditMode] = useState<WithdrawalBlockEditMode>('update');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('ops.withdrawalBlockGetAll', {
        pageNo: page,
        itemsPerPage: pageSize,
        filter: { userId: appliedUserId.trim() },
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load withdrawal blocks');
        setRows([]);
        return;
      }
      const parsed = normalizeWithdrawalBlockRows(res.data);
      setRows(parsed.rows);
      setTotal(parsed.total);
      setTotalPages(Math.max(1, parsed.totalPages));
      setSheetRow(null);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, appliedUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setAddUserId('');
    setAddAmount('');
    setAddMode('limit');
    setFormMsg('');
    setAddOpen(true);
  };

  const openEdit = (item: WithdrawalBlockItem) => {
    setEditItem(item);
    setEditMode(isFullWithdrawalBlock(item.amount) ? 'full' : 'update');
    setEditAmount(isFullWithdrawalBlock(item.amount) ? '' : String(item.amount ?? ''));
    setFormMsg('');
    setEditOpen(true);
  };

  const handleAdd = async () => {
    const userId = addUserId.trim();
    if (!userId) {
      setFormMsg('User ID is required');
      return;
    }
    const body: { userId: string; amount?: number } = { userId };
    if (addMode === 'limit') {
      const amount = parseWithdrawalAmount(addAmount);
      if (amount === null || Number.isNaN(amount)) {
        setFormMsg('Enter a valid amount (0 or more)');
        return;
      }
      body.amount = amount as number;
    }
    setSaving(true);
    setFormMsg('');
    try {
      const res = await secureApi('ops.withdrawalBlockAdd', body);
      if (!res.ok) {
        setFormMsg(res.message || 'Failed to add block');
        return;
      }
      Alert.alert('Success', addMode === 'full' ? 'Full block added' : 'Limit added');
      setAddOpen(false);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem?.userId) return;
    let body: { userId: string; action: 'update' | 'remove'; amount?: number | null };
    if (editMode === 'remove') body = { userId: editItem.userId, action: 'remove' };
    else if (editMode === 'full') body = { userId: editItem.userId, action: 'update', amount: null };
    else {
      const amount = parseWithdrawalAmount(editAmount);
      if (amount === null || Number.isNaN(amount)) {
        setFormMsg('Enter a valid amount (0 or more)');
        return;
      }
      body = { userId: editItem.userId, action: 'update', amount: amount as number };
    }
    setSaving(true);
    setFormMsg('');
    try {
      const res = await secureApi('ops.withdrawalBlockEdit', body);
      if (!res.ok) {
        setFormMsg(res.message || 'Failed to update');
        return;
      }
      Alert.alert(
        'Success',
        editMode === 'remove'
          ? 'Restriction removed'
          : editMode === 'full'
            ? 'Updated to full block'
            : 'Limit updated',
      );
      setEditOpen(false);
      setSheetRow(null);
      void load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Block Withdrawal</Text>
          <Text style={styles.sub}>{total.toLocaleString('en-IN')} restrictions</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Text style={styles.addBtnText}>＋ Block</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBox}>
        <Text style={styles.fieldLabel}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userIdDraft}
          onChangeText={setUserIdDraft}
          placeholder="Search by user ID"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          onSubmitEditing={() => {
            setAppliedUserId(userIdDraft.trim());
            setPage(1);
          }}
        />
        <Text style={styles.fieldLabel}>Per page</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.chip, pageSize === opt && styles.chipActive]}
              onPress={() => {
                setPageSize(opt);
                setPage(1);
              }}
            >
              <Text style={[styles.chipText, pageSize === opt && styles.chipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.filterActions}>
          <TouchableOpacity
            style={[styles.formBtn, styles.formBtnGhost]}
            onPress={() => {
              setUserIdDraft('');
              setAppliedUserId('');
              setPage(1);
            }}
          >
            <Text style={styles.formBtnGhostText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.formBtn, styles.formBtnPrimary]}
            onPress={() => {
              setAppliedUserId(userIdDraft.trim());
              setPage(1);
            }}
          >
            <Text style={styles.formBtnPrimaryText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? <Text style={styles.hint}>No withdrawal blocks found</Text> : null}

      <View style={styles.list}>
        {rows.map((row, index) => {
          const full = isFullWithdrawalBlock(row.amount);
          return (
            <TouchableOpacity
              key={row._id || `${row.userId}-${index}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
                <Text style={[styles.statusPill, full ? styles.pillDanger : styles.pillOk]}>
                  {full ? 'Full Block' : 'Amount Limit'}
                </Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {row.userId}
              </Text>
              {(row.userName || row.name) ? (
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {row.userName || row.name}
                </Text>
              ) : null}
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft}>
                  {full ? 'All blocked' : `₹${formatWithdrawalMoney(row.amount)}`}
                </Text>
                <Text style={styles.cardSplitRight}>
                  {formatWithdrawalDate(row.updatedAt || row.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow?.userId || ''}
        fields={
          sheetRow
            ? ([
                { label: 'User ID', value: sheetRow.userId },
                { label: 'Name', value: sheetRow.userName || sheetRow.name || '—' },
                {
                  label: 'Type',
                  value: isFullWithdrawalBlock(sheetRow.amount) ? 'Full Block' : 'Amount Limit',
                },
                {
                  label: 'Amount',
                  value: isFullWithdrawalBlock(sheetRow.amount)
                    ? 'All blocked'
                    : `₹${formatWithdrawalMoney(sheetRow.amount)}`,
                },
                {
                  label: 'Updated',
                  value: formatWithdrawalDate(sheetRow.updatedAt || sheetRow.createdAt),
                },
              ] as SheetField[])
            : []
        }
        actions={
          sheetRow
            ? ([
                {
                  label: 'Edit',
                  tone: 'primary',
                  onPress: () => openEdit(sheetRow),
                },
              ] as SheetAction[])
            : []
        }
        onClose={() => setSheetRow(null)}
      />

      {/* Add modal */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => !saving && setAddOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => !saving && setAddOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Block Withdrawal</Text>
            <Text style={styles.fieldLabel}>User ID</Text>
            <TextInput
              style={styles.input}
              value={addUserId}
              onChangeText={setAddUserId}
              placeholder="User ID"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
            />
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, addMode === 'limit' && styles.modeBtnActive]}
                onPress={() => setAddMode('limit')}
              >
                <Text style={[styles.modeBtnText, addMode === 'limit' && styles.modeBtnTextActive]}>
                  Amount Limit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, styles.modeBtnDanger, addMode === 'full' && styles.modeBtnDangerActive]}
                onPress={() => setAddMode('full')}
              >
                <Text style={[styles.modeBtnText, addMode === 'full' && styles.modeBtnTextDanger]}>
                  Full Block
                </Text>
              </TouchableOpacity>
            </View>
            {addMode === 'limit' ? (
              <>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={addAmount}
                  onChangeText={setAddAmount}
                  keyboardType="decimal-pad"
                  placeholder="5000"
                  placeholderTextColor={colors.muted}
                />
              </>
            ) : null}
            {formMsg ? <Text style={styles.formMsg}>{formMsg}</Text> : null}
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setAddOpen(false)} disabled={saving}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, saving && styles.btnDisabled]}
                onPress={() => void handleAdd()}
                disabled={saving}
              >
                <Text style={styles.formBtnPrimaryText}>{saving ? 'Saving…' : 'Add Block'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => !saving && setEditOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => !saving && setEditOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Edit Block</Text>
            <Text style={styles.sub}>User: {editItem?.userId}</Text>
            <Text style={styles.fieldLabel}>Action</Text>
            <View style={styles.modeRow}>
              {(['update', 'full', 'remove'] as WithdrawalBlockEditMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.modeBtn,
                    mode === 'remove' && styles.modeBtnDanger,
                    editMode === mode && (mode === 'remove' ? styles.modeBtnDangerActive : styles.modeBtnActive),
                  ]}
                  onPress={() => setEditMode(mode)}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      editMode === mode &&
                        (mode === 'remove' ? styles.modeBtnTextDanger : styles.modeBtnTextActive),
                    ]}
                  >
                    {mode === 'update' ? 'Update' : mode === 'full' ? 'Full' : 'Remove'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {editMode === 'update' ? (
              <>
                <Text style={styles.fieldLabel}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={editAmount}
                  onChangeText={setEditAmount}
                  keyboardType="decimal-pad"
                  placeholder="10000"
                  placeholderTextColor={colors.muted}
                />
              </>
            ) : null}
            {formMsg ? <Text style={styles.formMsg}>{formMsg}</Text> : null}
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setEditOpen(false)} disabled={saving}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.formBtn,
                  editMode === 'remove' ? styles.formBtnDanger : styles.formBtnPrimary,
                  saving && styles.btnDisabled,
                ]}
                onPress={() => void handleEdit()}
                disabled={saving}
              >
                <Text style={styles.formBtnPrimaryText}>
                  {saving ? 'Saving…' : editMode === 'remove' ? 'Remove' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {rows.length > 0 ? (
        <View style={styles.pager}>
          <Text
            style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
            onPress={() => page > 1 && setPage((p) => p - 1)}
          >
            ‹ Prev
          </Text>
          <Text style={styles.pagerLabel}>
            Page {page} / {totalPages}
          </Text>
          <Text
            style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
            onPress={() => page < totalPages && setPage((p) => p + 1)}
          >
            Next ›
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

