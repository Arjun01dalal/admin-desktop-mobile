/**
 * Collapsible C2C campaign picker + push.
 * Loads active campaigns via campaign.list; pushes via campaign.addData { userIds }.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  buildC2cCampaignListQuery,
  extractC2cCampaignList,
  type C2cCampaign,
} from '@astro/shared';
import { secureApi } from '../api/client';
import { colors, radius, spacing } from '../theme';
import { makeStyles } from '../styles/common';
import { pushUserIdsToC2cCampaign } from '../utils/c2cCampaignPush';

type Props = {
  /** User mongo ids to POST as userIds. */
  userIds: string[];
  /** Optional label override for the action button count. */
  countLabel?: number;
  disabled?: boolean;
};

export function AddToC2cCampaignPanel({ userIds, countLabel, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<C2cCampaign[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState('');
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageOk, setMessageOk] = useState(false);

  const loadCampaigns = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await secureApi(
        'campaign.list',
        buildC2cCampaignListQuery({
          pageNo: 1,
          itemsPerPage: 100,
          isActive: true,
        }),
      );
      if (!res.ok) {
        setListError(res.message || 'Failed to load C2C campaigns');
        setCampaigns([]);
        return;
      }
      const { items } = extractC2cCampaignList(res.data);
      setCampaigns(items.filter((c) => c._id));
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load C2C campaigns');
      setCampaigns([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadCampaigns();
  }, [open, loadCampaigns]);

  const count = countLabel ?? userIds.length;
  const selected = campaigns.find((c) => c._id === campaignId);

  const onPush = async () => {
    setMessage('');
    setMessageOk(false);
    setPushing(true);
    try {
      const res = await pushUserIdsToC2cCampaign(campaignId, userIds);
      const text = res.message || (res.ok ? 'Users added to C2C campaign' : 'Failed to add users');
      setMessage(text);
      setMessageOk(res.ok);
      Alert.alert(res.ok ? 'C2C Campaign' : 'C2C failed', text);
    } finally {
      setPushing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
      >
        <Text style={styles.headerText}>
          Add to C2C Campaign
          {selected ? ` · ${selected.campaignName}` : ''}
          {count ? ` · ${count}` : ''} {open ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.card}>
          <Text style={styles.label}>C2C Campaign List</Text>
          {loadingList ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : listError ? (
            <Text style={styles.error}>{listError}</Text>
          ) : campaigns.length === 0 ? (
            <Text style={styles.hint}>No active C2C campaigns.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {campaigns.map((c) => {
                  const id = c._id;
                  const active = campaignId === id;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCampaignId(active ? '' : id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                        {c.campaignName || id}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <Text style={styles.hint}>
            Pushes {count} user{count === 1 ? '' : 's'} into the selected C2C campaign.
          </Text>

          <TouchableOpacity
            style={[
              styles.btn,
              (pushing || disabled || !campaignId || !userIds.length) && styles.btnDisabled,
            ]}
            onPress={() => void onPush()}
            disabled={pushing || disabled || !campaignId || !userIds.length}
          >
            <Text style={styles.btnText}>
              {pushing ? 'Pushing…' : `Add ${count || ''} to C2C`}
            </Text>
          </TouchableOpacity>

          {message ? (
            <Text style={[styles.msg, messageOk ? styles.msgOk : styles.msgError]}>{message}</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = makeStyles({
  wrap: { marginTop: spacing(2), marginBottom: spacing(3) },
  header: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  headerText: { color: colors.foreground, fontSize: 13, fontWeight: '800' },
  card: {
    marginTop: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing(3),
    gap: spacing(2),
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  spinner: { marginVertical: spacing(2) },
  chipRow: { flexDirection: 'row', gap: spacing(1.5), paddingVertical: spacing(0.5) },
  chip: {
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    maxWidth: 220,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(255,159,10,0.15)' },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  error: { color: colors.destructive, fontSize: 12 },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: colors.primaryForeground, fontSize: 13, fontWeight: '800' },
  msg: { fontSize: 12, textAlign: 'center', fontWeight: '600' },
  msgOk: { color: colors.success },
  msgError: { color: colors.destructive },
});
