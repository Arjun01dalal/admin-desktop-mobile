/**
 * C2C Campaign "Call Start" — fetch next lead, then dial via GtelClick2CallModal
 * (admin-panel-domains CampaignCallStartModal parity, mobile-optimized).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { extractC2cNextCampaignCall, type C2cNextCampaignCall } from '@astro/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { secureApi } from '../api/client';
import { maskMobile } from '../utils/display';
import { GtelClick2CallModal, type GtelC2cTarget } from './GtelClick2CallModal';
import { styles } from './CampaignCallStartModal.styles';

type Props = {
  open: boolean;
  onClose: () => void;
  canShowMobile: boolean;
};

export function CampaignCallStartModal({ open, onClose, canShowMobile }: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState<C2cNextCampaignCall | null>(null);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNext(null);
    try {
      const res = await secureApi('campaign.nextCall', {});
      if (!res.ok) {
        setError(res.message || 'No next call available');
        return;
      }
      const parsed = extractC2cNextCampaignCall(res.data);
      if (!parsed) {
        setError('No pending campaign call found');
        return;
      }
      setNext(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load next call');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setNext(null);
      setError(null);
      setC2cTarget(null);
      return;
    }
    void loadNext();
  }, [open, loadNext]);

  const startDial = () => {
    if (!next?.phoneNumber) return;
    setC2cTarget({
      phoneNumber: next.phoneNumber,
      userId: next.userId,
      userName: next.name,
      appName: next.appName,
      lastActivity: next.lastActivity,
      campaignDataId: next.campaignDataId,
      source: 'Campaign',
    });
  };

  const openAuth = () => {
    const url = String(next?.authUrl || '').trim();
    if (url) void Linking.openURL(url);
  };

  return (
    <>
      <Modal visible={open && !c2cTarget} transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing(4)) }]}>
            <View style={styles.handle} />
            <Text style={styles.title}>Campaign Call Start</Text>
            <Text style={styles.sub}>Next assigned lead from active C2C campaigns</Text>

            {loading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing(6) }} />
            ) : next ? (
              <View style={styles.card}>
                <Text style={styles.name}>{next.name || '—'}</Text>
                <Text style={styles.line}>
                  {maskMobile(next.phoneNumber, canShowMobile)}
                  {next.appName ? ` · ${next.appName}` : ''}
                </Text>
                {next.userId ? <Text style={styles.muted}>User: {next.userId}</Text> : null}
                {next.lastActivity ? (
                  <Text style={styles.muted}>Last activity: {next.lastActivity}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.empty}>{error || 'No calls in queue'}</Text>
            )}

            {error && next ? <Text style={styles.err}>{error}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
                <Text style={styles.btnGhostText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => void loadNext()}
                disabled={loading}
              >
                <Text style={styles.btnGhostText}>Refresh</Text>
              </TouchableOpacity>
              {next?.authUrl ? (
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={openAuth}>
                  <Text style={styles.btnGhostText}>Auth URL</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.btn}
                onPress={startDial}
                disabled={!next?.phoneNumber || loading}
              >
                <Text style={styles.btnText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <GtelClick2CallModal
        target={c2cTarget}
        canShowMobile={canShowMobile}
        onClose={() => setC2cTarget(null)}
        onEnded={() => {
          setC2cTarget(null);
          void loadNext();
        }}
      />
    </>
  );
}
