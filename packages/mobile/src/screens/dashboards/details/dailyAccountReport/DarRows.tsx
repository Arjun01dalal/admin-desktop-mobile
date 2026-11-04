import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { formatBalanceAmount } from '@astro/shared/dailyAccountReport';

import type { BankAccount, DaySheetItem, MidAllotment, MidRecord } from './api';
import { styles } from './DailyAccountReportScreen.styles';
import { daySheetStatusTone } from './helpers';
import type { EntryMode } from './types';

export function DaySheetRow({
  row,
  onEntry,
}: {
  row: DaySheetItem;
  onEntry: (row: DaySheetItem, mode: EntryMode) => void;
}) {
  const tone = daySheetStatusTone(row);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.mid || row.midId}</Text>
      <Text style={styles.cardMeta}>
        {row.subAdminName || row.subAdminId || '—'} · {row.date}
      </Text>
      <View style={[styles.status, { backgroundColor: tone.bg }]}>
        <Text style={[styles.statusText, { color: tone.color }]}>{tone.label}</Text>
      </View>
      <Text style={styles.cardMeta}>
        Open: {formatBalanceAmount(row.open?.amount)} · Close: {formatBalanceAmount(row.close?.amount)}
      </Text>
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.smallBtn, styles.smallBtnPrimary]}
          onPress={() => onEntry(row, 'open')}
        >
          <Text style={styles.smallBtnPrimaryText}>{row.open ? 'Edit open' : 'Open'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.smallBtn, styles.smallBtnPrimary]}
          onPress={() => onEntry(row, 'close')}
        >
          <Text style={styles.smallBtnPrimaryText}>{row.close ? 'Edit close' : 'Close'}</Text>
        </TouchableOpacity>
        {row.open || row.close ? (
          <TouchableOpacity style={styles.smallBtn} onPress={() => onEntry(row, 'correct')}>
            <Text style={styles.smallBtnText}>Correct</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

export function BankRow({ row, onPress }: { row: BankAccount; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle}>{row.displayName || row.bankName || row._id}</Text>
      <Text style={styles.cardMeta}>
        {row.accountHolderName} · {row.accountNumber} · {row.ifscCode}
      </Text>
      <Text style={styles.cardMeta}>{row.status || 'active'}</Text>
    </TouchableOpacity>
  );
}

export function MidRow({ row, onPress }: { row: MidRecord; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle}>{row.mid}</Text>
      <Text style={styles.cardMeta}>
        {row.displayName || '—'} · {row.phoneNumber || '—'}
      </Text>
      <Text style={styles.cardMeta}>
        {row.bankLabel || row.bankAccountId} · {row.status || 'active'}
      </Text>
    </TouchableOpacity>
  );
}

export function AllotRow({
  row,
  onReassign,
  onRevoke,
}: {
  row: MidAllotment;
  onReassign: () => void;
  onRevoke: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{row.mid || row.midId}</Text>
      <Text style={styles.cardMeta}>
        {row.subAdminName || row.subAdminId} · Emp {row.empCode || '—'}
      </Text>
      <View style={styles.rowActions}>
        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={onReassign}>
          <Text style={styles.smallBtnPrimaryText}>Reassign</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, styles.smallBtnDanger]} onPress={onRevoke}>
          <Text style={styles.smallBtnDangerText}>Revoke</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
