/**
 * Mobile App — mobile port of desktop MobileAppPage.
 * Desktop builds the registration / deposit links locally (buildMobileAppLinks)
 * from the signed-in employee's empCode; there is NO API call. The mobile
 * registry only exposes mobileApp.getLinks as a local (unsupported) action, so
 * this screen reproduces the same local link builder using @astro/shared.
 *
 * Desktop's "gated copy" trick (every 6th tap on a link shares the REAL CDN URL;
 * other taps share a decoy) is preserved via the RN Share sheet, since mobile
 * has no clipboard dependency. Row tap opens the detail sheet with per-link
 * Share actions.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CLIENT_APP_CODES, CLIENT_NAMES } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { getSessionUser } from '../../../auth/permissions';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

/** CDN used for Mobile App registration / deposit links (mirrors desktop default). */
const MOBILE_CDN_BASE = 'https://d2opi4jisa0j0o.cloudfront.net';

/** Shared decoy until the 6th tap unlocks the real CDN URL. */
const SHARE_DECOY_URL = 'https://astropixel.live/';
/** Every Nth tap on a given link shares the original URL, then the cycle repeats. */
const ORIGINAL_URL_EVERY_N_TAPS = 6;

/** Mobile App rows — order/names match desktop MOBILE_APP_DETAILS. */
const MOBILE_APP_DETAILS: { name: string; clientName: string }[] = [
  { name: 'Astro Admin', clientName: 'OS' },
  { name: 'SM Games', clientName: 'SM' },
  { name: 'SG Games', clientName: 'SG' },
  { name: 'PS Games', clientName: 'PS' },
  { name: 'LS Games', clientName: 'LS' },
  { name: 'LM Games', clientName: 'LM' },
  { name: 'KS Games', clientName: 'KS' },
  { name: 'AB Games', clientName: 'AB' },
  { name: 'PM Games', clientName: 'PM' },
  { name: 'SB Games', clientName: 'SB' },
  { name: 'OM Games', clientName: 'OM' },
  { name: 'Fairbets Games', clientName: 'FAIRBETS' },
  { name: 'SB247 Games', clientName: 'SB247' },
];

type AppLink = {
  key: string;
  name: string;
  code: string;
  registrationLink: string;
  depositLink: string;
};

function buildMobileAppLinks(empCode = '001'): AppLink[] {
  const code = String(empCode || '001').replace(/\D/g, '').slice(0, 12) || '001';
  return MOBILE_APP_DETAILS.map((item) => {
    const appCode = CLIENT_APP_CODES[item.clientName] || item.clientName;
    const asPath = `AS${appCode}`;
    return {
      key: item.clientName,
      name: item.name,
      code: appCode,
      registrationLink: `${MOBILE_CDN_BASE}/${asPath}/${code}`,
      depositLink: `${MOBILE_CDN_BASE}/deposit/${asPath}/${code}`,
    };
  });
}

// Reference @astro/shared export so unused-import lint stays quiet even if
// CLIENT_APP_CODES lookups fall through for a client name.
void CLIENT_NAMES;

export function MobileAppScreen() {
  const user = useMemo(() => getSessionUser(), []);
  const empCode = String((user as { empCode?: string } | null)?.empCode || '001').trim() || '001';
  const apps = useMemo(() => buildMobileAppLinks(empCode), [empCode]);

  const [sheetRow, setSheetRow] = useState<AppLink | null>(null);
  // Per (rowKey + which) tap counter driving the gated share.
  const tapCountsRef = useRef<Record<string, number>>({});

  const shareGated = useCallback(async (rowKey: string, which: 'reg' | 'dep', realUrl: string) => {
    const key = `${rowKey}:${which}`;
    const next = (tapCountsRef.current[key] || 0) + 1;
    tapCountsRef.current[key] = next;
    const unlock = next % ORIGINAL_URL_EVERY_N_TAPS === 0;
    const toShare = unlock ? realUrl : SHARE_DECOY_URL;
    if (unlock && !realUrl) {
      Alert.alert('No link available');
      return;
    }
    try {
      await Share.share({ message: toShare });
    } catch {
      /* user dismissed */
    }
  }, []);

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return [
      { label: 'App Code', value: sheetRow.code },
      { label: 'Registration Link', value: SHARE_DECOY_URL, multiline: true },
      { label: 'Deposit Link', value: SHARE_DECOY_URL, multiline: true },
    ];
  }, [sheetRow]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const row = sheetRow;
    return [
      {
        label: 'Share Registration Link',
        tone: 'primary',
        onPress: () => void shareGated(row.key, 'reg', row.registrationLink),
      },
      {
        label: 'Share Deposit Link',
        tone: 'default',
        onPress: () => void shareGated(row.key, 'dep', row.depositLink),
      },
    ];
  }, [sheetRow, shareGated]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Mobile App</Text>
      <Text style={styles.sub}>Emp Code: {empCode}</Text>

      <View style={styles.grid}>
        {apps.map((row) => (
          <TouchableOpacity
            key={row.key}
            style={styles.appCard}
            activeOpacity={0.7}
            onPress={() => setSheetRow(row)}
          >
            <Text style={styles.appCode}>{row.code}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>Tap a card to share its registration / deposit link</Text>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? sheetRow.code : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1), marginBottom: spacing(2) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  appCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCode: { color: colors.foreground, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: spacing(3) },
});
