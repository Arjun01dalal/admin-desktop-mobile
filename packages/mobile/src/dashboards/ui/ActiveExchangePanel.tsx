/** Active Exaltation panel — main Dashboard only (port of desktop ActiveExchangePanel). */
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { secureApi } from '../../api/client';
import { Button } from '../../components/UI';
import { useRevealCodes } from '../../context/useRevealCodes';
import {
  ACTIVE_EXCHANGE_MAP,
  PANEL_LABELS,
  activeExchangeJyotishLabel,
  toDisplayText,
} from '../jyotish/jyotishMapping';
import { styles } from './ActiveExchangePanel.styles';

type Props = {
  activeExchangeName?: string;
  onUpdated?: () => void;
};

export function ActiveExchangePanel({ activeExchangeName, onUpdated }: Props) {
  useRevealCodes();
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
      <Text style={styles.title}>{toDisplayText(PANEL_LABELS.title)}</Text>
      <Text style={styles.currentLabel}>
        {toDisplayText(PANEL_LABELS.activeName)}:{' '}
        <Text style={styles.currentValue}>{activeExchangeJyotishLabel(activeExchangeName)}</Text>
      </Text>

      <View style={styles.chipRow}>
        {ACTIVE_EXCHANGE_MAP.map((ex) => {
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
                {toDisplayText(ex.jyotish)}
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

