/**
 * Click-to-call overlay — mobile port of admin-panel-domains Click2CallBtn modal.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  canShowGtelC2c,
  createGtelCallId,
  extractGtelDispositions,
  getNumericExtension,
  sanitizeGtelPhone,
} from '@astro/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { secureApi } from '../api/client';
import { getStoredUser } from '../lib/webShim';
import { styles } from './GtelClick2CallModal.styles';

export { canShowGtelC2c };

export type GtelC2cTarget = {
  phoneNumber: string;
  userId?: string;
  userName?: string;
  appName?: string;
  lastActivity?: string;
  /** When set, dialer uses campaign path (admin C2C Campaign parity). */
  campaignDataId?: string;
  source?: 'Manual' | 'Campaign';
  /** Number not in DB — POST click-to-call with isProspect: true. */
  isProspect?: boolean;
};

type Props = {
  target: GtelC2cTarget | null;
  onClose: () => void;
  onEnded?: () => void;
  canShowMobile: boolean;
};

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, mono && styles.mono]}
        numberOfLines={1}
        ellipsizeMode="middle"
        selectable
      >
        {value || '—'}
      </Text>
    </View>
  );
}

export function GtelClick2CallModal({ target, onClose, onEnded, canShowMobile }: Props) {
  const insets = useSafeAreaInsets();
  const admin = getStoredUser<Record<string, unknown>>();
  const [starting, setStarting] = useState(false);
  const [hangingUp, setHangingUp] = useState(false);
  const [callId, setCallId] = useState('');
  const [extension, setExtension] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dispositions, setDispositions] = useState<string[]>([]);
  const [disposition, setDisposition] = useState('');
  const [dispLoading, setDispLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState<GtelC2cTarget | null>(null);
  const startedRef = useRef(false);

  const loadDispositions = useCallback(async () => {
    setDispLoading(true);
    try {
      const res = await secureApi('gtel.dispositions', {});
      setDispositions(res.ok ? extractGtelDispositions(res.data) : []);
    } finally {
      setDispLoading(false);
    }
  }, []);

  const startCall = useCallback(
    async (next: GtelC2cTarget) => {
      const phone = sanitizeGtelPhone(next.phoneNumber);
      const ext = getNumericExtension(admin?.extensionId);
      const nextCallId = createGtelCallId();
      const isCampaign = Boolean(next.campaignDataId);
      setStarting(true);
      setMsg('');
      setActive(next);
      try {
        if (!phone) {
          setMsg('Phone number is required');
          onClose();
          return;
        }
        // Campaign dials omit extension; manual / prospect need one.
        if (!isCampaign && !ext) {
          if (next.isProspect) {
            setMsg('Extension not found for prospect call');
            onClose();
            return;
          }
          setCallId(nextCallId);
          setExtension('—');
          setStartedAt(Date.now());
          setElapsed(0);
          setEnded(false);
          setPreview(true);
          setDisposition('');
          void loadDispositions();
          return;
        }
        const res = await secureApi(
          'gtel.clickToCall',
          next.isProspect
            ? {
                callId: nextCallId,
                phoneNumber: phone,
                isProspect: true,
                source: next.source || 'Manual',
                extension: ext,
              }
            : {
                callId: nextCallId,
                phoneNumber: phone,
                ...(isCampaign
                  ? {
                      campaignDataId: next.campaignDataId,
                      source: next.source || 'Campaign',
                      userId: next.userId || '',
                    }
                  : {
                      extension: ext,
                      userId: next.userId || '',
                      subAdminId: String(admin?._id || ''),
                      source: next.source || 'Manual',
                    }),
              },
        );
        if (!res.ok || res.success === false) {
          setMsg(res.message || 'Call could not be initiated');
          onClose();
          return;
        }
        setCallId(nextCallId);
        setExtension(isCampaign ? 'Campaign' : ext);
        setStartedAt(Date.now());
        setElapsed(0);
        setEnded(false);
        setPreview(false);
        setDisposition('');
        setMsg('Call initiated');
        void loadDispositions();
      } finally {
        setStarting(false);
      }
    },
    [admin, loadDispositions, onClose],
  );

  useEffect(() => {
    if (!target) {
      startedRef.current = false;
      setCallId('');
      setActive(null);
      setMsg('');
      setPreview(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void startCall(target);
  }, [target, startCall]);

  useEffect(() => {
    if (!callId || ended || !startedAt) return;
    setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [callId, ended, startedAt]);

  const hangUp = useCallback(
    async (closeAfter: boolean) => {
      if (!callId) return;
      if (!disposition) {
        setMsg('Please select disposition');
        return;
      }
      setHangingUp(true);
      try {
        if (!preview) {
          const dispRes = await secureApi('gtel.updateDisposition', {
            callId,
            disposition,
          });
          const alreadySet = /already set|cannot be changed/i.test(dispRes.message || '');
          if (!dispRes.ok && !alreadySet && dispRes.success === false) {
            setMsg(dispRes.message || 'Failed to update disposition');
            return;
          }
          const statusRes = await secureApi<{ status?: string }>('gtel.callDetails', { callId });
          const status = String(
            (statusRes.data as { status?: string } | undefined)?.status || '',
          ).toUpperCase();
          if (status !== 'COMPLETED') {
            const hangRes = await secureApi('gtel.hangup', { callId });
            if (!hangRes.ok || hangRes.success === false) {
              setMsg(hangRes.message || 'Hang up failed');
              setEnded(true);
              if (closeAfter) onClose();
              return;
            }
          }
        }
        setEnded(true);
        setMsg('Call ended');
        onEnded?.();
        if (closeAfter) onClose();
      } finally {
        setHangingUp(false);
      }
    },
    [callId, disposition, onClose, onEnded, preview],
  );

  if (!target && !callId) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !hangingUp && onClose()}>
      <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, spacing(2)) }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Active Call</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              disabled={hangingUp}
              onPress={() => {
                if (ended || !callId) onClose();
                else void hangUp(true);
              }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {starting ? <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} /> : null}

          {callId ? (
            <View style={styles.timerBanner}>
              <Text style={styles.timerLabel}>Call Timing</Text>
              <Text style={styles.timer}>{formatElapsed(elapsed)}</Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.rows}>
              <InfoRow label="Name" value={active?.userName || '—'} />
              <InfoRow label="Phone" value={canShowMobile ? active?.phoneNumber || '—' : '**********'} />
              <InfoRow label="App Name" value={active?.appName || '—'} />
              <InfoRow label="Extension" value={extension || '—'} />
              <InfoRow label="Last Activity" value={active?.lastActivity || '—'} />
              <InfoRow label="DP ID" value={active?.userId || '—'} mono />
              <InfoRow label="Call ID" value={callId || '—'} mono />
            </View>

            {!ended && callId ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Disposition</Text>
                {dispLoading ? (
                  <Text style={styles.hint}>Loading…</Text>
                ) : (
                  <View style={styles.chipWrap}>
                    {dispositions.map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.chip, disposition === item && styles.chipActive]}
                        onPress={() => setDisposition(item)}
                        disabled={hangingUp}
                      >
                        <Text
                          style={[styles.chipText, disposition === item && styles.chipTextActive]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.hangBtn, hangingUp && { opacity: 0.6 }]}
                  disabled={hangingUp || dispLoading}
                  onPress={() => void hangUp(false)}
                >
                  <Text style={styles.hangBtnText}>
                    {hangingUp ? 'Hanging up…' : 'Hang Up'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : callId ? (
              <Text style={styles.ended}>Call ended</Text>
            ) : null}

            {preview ? (
              <View style={styles.previewBanner}>
                <Text style={styles.previewText}>Extension not found — preview mode</Text>
              </View>
            ) : null}
            {msg && !preview ? <Text style={styles.msg}>{msg}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

