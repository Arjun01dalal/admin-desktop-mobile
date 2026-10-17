/** Call row card — menu Gtel Calls + Dashboard→Calls (callerDashMode). */
import React, { memo } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import {
  formatGtelDuration,
  getGtelAppName,
  getGtelCallId,
  getGtelCallSource,
  getGtelCallerEmpCode,
  getGtelCity,
  getGtelDpiId,
  getGtelPersonalConnectIntent,
  getGtelPlayedLabel,
  getGtelState,
  getGtelUserEmpCode,
  getGtelUsername,
  gtelDispositionTone,
  gtelStatusTone,
  isGtelFlaggedCall,
  isGtelRowAlert,
  maskGtelPhone,
  type GtelCall,
} from '@astro/shared';

import { StatusPill } from '../../../../components/StatusPill';
import { formatGtelTs } from './format';
import { styles } from './styles';

export type GtelCallCardProps = {
  call: GtelCall;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  canShowC2c: boolean;
  canShowRecording: boolean;
  /** Dashboard → Calls: admin Caller Calls columns. */
  callerDashMode?: boolean;
  flaggedMediaLoading?: boolean;
  onOpenReport: (userId?: string, userName?: string) => void;
  onStartC2c: (call: GtelCall) => void;
  onOpenDetails: (callId?: string) => void;
  onOpenFlaggedMedia?: (call: GtelCall) => void;
};

export const GtelCallCard = memo(function GtelCallCard({
  call,
  index,
  page,
  pageSize,
  canShowMobile,
  canShowC2c,
  canShowRecording,
  callerDashMode,
  flaggedMediaLoading,
  onOpenReport,
  onStartC2c,
  onOpenDetails,
  onOpenFlaggedMedia,
}: GtelCallCardProps) {
  const dpi = getGtelDpiId(call);
  const name = getGtelUsername(call);
  const flagged = isGtelFlaggedCall(call);
  const alert = isGtelRowAlert(call) || flagged;
  const disposition = call.disposition || '';
  const phone = maskGtelPhone(call.phoneNumber, canShowMobile);
  const app = getGtelAppName(call);
  const ext = call.extension || '—';
  const when = formatGtelTs(call.callDate || call.clickedAt || call.createdOn);
  const duration = formatGtelDuration(call.duration);
  const place = `${getGtelState(call)} / ${getGtelCity(call)}`;
  const statusLabel = call.statusByDialer || call.status || '—';
  const tone = gtelStatusTone(statusLabel);
  const callId = getGtelCallId(call);
  const played = getGtelPlayedLabel(call);
  const intent = getGtelPersonalConnectIntent(call);
  const source = getGtelCallSource(call);

  if (callerDashMode) {
    return (
      <View style={[styles.card, alert && styles.cardAlert]}>
        <View style={[styles.cardAccent, tone === 'answer' && styles.cardAccentOk]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderMain}>
              <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <StatusPill label={statusLabel} tone={tone} />
          </View>

          {dpi !== '—' ? (
            <TouchableOpacity onPress={() => onOpenReport(dpi, name)}>
              <Text style={styles.cardLink} numberOfLines={1}>
                DP ID · {dpi}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.cardMetaMuted}>DP ID · —</Text>
          )}

          <Text style={styles.cardMetaMuted} numberOfLines={1}>
            Call ID · {callId}
          </Text>

          {disposition ? (
            <StatusPill
              label={disposition}
              tone={gtelDispositionTone(disposition)}
              style={styles.cardDisp}
            />
          ) : (
            <Text style={styles.cardMetaMuted}>Disposition · —</Text>
          )}

          <Text style={styles.cardMetaMuted} numberOfLines={2}>
            Personal Connect · {intent}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={2}>
            Played · {played}
          </Text>

          <View style={styles.cardMetaGrid}>
            {source !== '—' ? (
              <Text style={styles.cardMetaMuted} numberOfLines={1}>
                {source}
              </Text>
            ) : null}
            <Text style={styles.cardMetaMuted} numberOfLines={1}>
              {when}
            </Text>
            {duration !== '—' ? (
              <Text style={styles.cardDuration} numberOfLines={1}>
                {duration}
              </Text>
            ) : null}
          </View>

          <View style={styles.cardActions}>
            {dpi !== '—' ? (
              <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenReport(dpi, name)}>
                <Text style={styles.actionBtnText}>Report</Text>
              </TouchableOpacity>
            ) : null}
            {canShowC2c && call.phoneNumber ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnGhost]}
                onPress={() => onStartC2c(call)}
              >
                <Text style={styles.actionBtnGhostText}>Call</Text>
              </TouchableOpacity>
            ) : null}
            {flagged ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnFlagged]}
                disabled={flaggedMediaLoading}
                onPress={() => onOpenFlaggedMedia?.(call)}
              >
                <Text style={styles.actionBtnFlaggedText}>
                  {flaggedMediaLoading ? 'Loading…' : 'Media'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, alert && styles.cardAlert]}>
      <View style={[styles.cardAccent, tone === 'answer' && styles.cardAccentOk]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderMain}>
            <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <StatusPill label={statusLabel} tone={tone} />
        </View>

        <View style={styles.cardMetaGrid}>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {phone}
          </Text>
          {app !== '—' ? (
            <Text style={styles.cardMetaMuted} numberOfLines={1}>
              {app}
            </Text>
          ) : null}
          {ext !== '—' ? (
            <Text style={styles.cardMetaMuted} numberOfLines={1}>
              Ext {ext}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardMetaGrid}>
          <Text style={styles.cardMetaMuted} numberOfLines={1}>
            {when}
          </Text>
          {duration !== '—' ? (
            <Text style={styles.cardDuration} numberOfLines={1}>
              {duration}
            </Text>
          ) : null}
        </View>

        <Text style={styles.cardMetaMuted} numberOfLines={1}>
          Emp {getGtelCallerEmpCode(call)} / {getGtelUserEmpCode(call)}
          {place !== '— / —' ? ` · ${place}` : ''}
        </Text>

        {disposition ? (
          <StatusPill
            label={disposition}
            tone={gtelDispositionTone(disposition)}
            style={styles.cardDisp}
          />
        ) : null}

        <View style={styles.cardActions}>
          {dpi !== '—' ? (
            <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenReport(dpi, name)}>
              <Text style={styles.actionBtnText}>Report</Text>
            </TouchableOpacity>
          ) : null}
          {canShowC2c && call.phoneNumber ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={() => onStartC2c(call)}
            >
              <Text style={styles.actionBtnGhostText}>Call</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGhost]}
            onPress={() => void onOpenDetails(call.callId || call._id)}
          >
            <Text style={styles.actionBtnGhostText}>Details</Text>
          </TouchableOpacity>
          {canShowRecording && call.recordingUrl ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnGhost]}
              onPress={() => void Linking.openURL(String(call.recordingUrl))}
            >
              <Text style={styles.actionBtnGhostText}>Rec</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
});
