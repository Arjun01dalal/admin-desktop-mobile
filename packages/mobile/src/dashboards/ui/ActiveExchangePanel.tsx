/** Active Exaltation panel — main Dashboard only (port of desktop ActiveExchangePanel). */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { secureApi } from '../../api/client';
import { colors, radius, spacing } from '../../theme';
import { Button } from '../../components/UI';
import {
  PANEL_LABELS,
  activeExchangeJyotishLabel,
} from '../jyotish/jyotishMapping';

const EXCHANGES = [
  { original: 'AAA', jyotish: 'Ascendant' },
  { original: 'FALCON', jyotish: 'Phalguni' },
  { original: 'JETFAIR', jyotish: 'Jyeshtha' },
] as const;

type Props = {
  activeExchangeName?: string;
  onUpdated?: () => void;
};

export function ActiveExchangePanel({ activeExchangeName, onUpdated }: Props) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const targetExchange = selected || activeExchangeName || '';

  const update = async () => {
    setConfirming(false);
    if (!targetExchange) {
      setMessage({ text: 'Choose an exaltation type', error: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await secureApi('dashboard.activeExchangeUpdate', {
        exchangeName: targetExchange,
      });
      if (!res.ok) {
        setMessage({ text: res.message || 'Failed to update exaltation', error: true });
        return;
      }
      setMessage({ text: res.message || 'Exaltation updated', error: false });
      setSelected('');
      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{PANEL_LABELS.title}</Text>
      <Text style={styles.currentLabel}>
        {PANEL_LABELS.activeName}:{' '}
        <Text style={styles.currentValue}>
          {activeExchangeJyotishLabel(activeExchangeName)}
        </Text>
      </Text>

      <View style={styles.chipRow}>
        {EXCHANGES.map((ex) => {
          const active = selected === ex.original;
          return (
            <TouchableOpacity
              key={ex.original}
              onPress={() => {
                setSelected(active ? '' : ex.original);
                setConfirming(false);
                setMessage(null);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {ex.jyotish}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>
            Switch active exaltation to {activeExchangeJyotishLabel(targetExchange)}?
          </Text>
          <View style={styles.confirmButtons}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setConfirming(false)}
              style={styles.smallBtn}
            />
            <Button
              title="Confirm"
              onPress={() => void update()}
              loading={saving}
              style={styles.smallBtn}
            />
          </View>
        </View>
      ) : (
        <Button
          title="Update"
          onPress={() => {
            setMessage(null);
            if (!targetExchange) {
              setMessage({ text: 'Choose an exaltation type', error: true });
              return;
            }
            setConfirming(true);
          }}
          loading={saving}
          style={styles.smallBtn}
        />
      )}

      {message ? (
        <Text style={[styles.message, message.error ? styles.msgError : styles.msgOk]}>
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3.5),
    marginBottom: spacing(3),
  },
  title: { color: colors.foreground, fontSize: 15, fontWeight: '800', marginBottom: spacing(1.5) },
  currentLabel: { color: colors.muted, fontSize: 13, marginBottom: spacing(2.5) },
  currentValue: { color: colors.primary, fontWeight: '800' },
  chipRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3), flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.primaryForeground },
  confirmRow: { gap: spacing(2) },
  confirmText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  confirmButtons: { flexDirection: 'row', gap: spacing(2) },
  smallBtn: { height: 40, alignSelf: 'flex-start' },
  message: { marginTop: spacing(2), fontSize: 12, fontWeight: '600' },
  msgError: { color: colors.destructive },
  msgOk: { color: colors.success },
});
