/** Withdrawal card footer: checks, bot report and beneficiary actions. */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { formatDisplayDate, formatDisplayTime } from '../../utils/dates';
import { BOT_CHECK_HIDDEN_STATUSES } from './constants';
import {
  checkOf,
  checksAllowedFor,
  display,
  extractBeneficiaryAccounts,
  fmtAmount,
  num,
  type Rec,
} from './helpers';
import { styles } from '../WithdrawalScreen.styles';

type WithdrawalCardFooterProps = {
  row: Rec;
  checksDisabled: boolean;
  bulkMode: boolean;
  actionBusy: boolean;
  addBeneBusy: boolean;
  canAddBeneficiary: boolean;
  onBotReport: (row: Rec) => void;
  onAddBeneficiary: (row: Rec) => Promise<void>;
  onCheck: (row: Rec, side: 'first' | 'second', value: boolean) => Promise<void>;
};

export function WithdrawalCardFooter({
  row: r,
  checksDisabled,
  bulkMode,
  actionBusy,
  addBeneBusy,
  canAddBeneficiary,
  onBotReport,
  onAddBeneficiary,
  onCheck,
}: WithdrawalCardFooterProps) {
  if (bulkMode) return null;
  const checksAllowed = checksAllowedFor(r, checksDisabled);
  const checkFirst = checkOf(r, 'checkBy');
  const checkSecond = checkOf(r, 'crossCheckBy');
  const busy = actionBusy;
  const beneList = extractBeneficiaryAccounts(r);
  const showAddBene = canAddBeneficiary;
  const winIn = display(r.playedGames);
  const datePart = r.createdOn ? formatDisplayDate(String(r.createdOn)) : '—';
  const timePart = r.createdOn ? formatDisplayTime(String(r.createdOn)) : '';
  const commission = `₹${fmtAmount(r.commissionAmount)}`;
  const hasBot =
    Boolean(r.validationCheckedAt) && !BOT_CHECK_HIDDEN_STATUSES.has(String(r.status || ''));
  const botPassed = num(r.passedPoints);
  const botTotal = num(r.totalPoints);
  const botOk = botPassed >= 13;
  return (
    <View style={styles.checkBlock}>
      <View style={styles.metaPanel}>
        <View style={styles.metaCols}>
          <View style={[styles.metaCol, styles.metaColFirst, styles.metaColCenter]}>
            <View style={[styles.metaHeadRow, styles.metaHeadRowCenter]}>
              <MaterialCommunityIcons name="calendar-clock" size={13} color={colors.muted} />
              <Text style={styles.metaHead} numberOfLines={1}>
                Date/Time
              </Text>
            </View>
            <Text style={[styles.metaVal, styles.metaValCenter]} numberOfLines={1}>
              {datePart}
            </Text>
            {timePart ? (
              <Text style={[styles.metaValSub, styles.metaValCenter]} numberOfLines={1}>
                {timePart}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaDivider} />
          <View style={[styles.metaCol, styles.metaColCenter]}>
            <View style={[styles.metaHeadRow, styles.metaHeadRowCenter]}>
              <MaterialCommunityIcons name="trophy-outline" size={13} color={colors.muted} />
              <Text style={styles.metaHead} numberOfLines={1}>
                Win In
              </Text>
            </View>
            <Text style={[styles.metaVal, styles.metaValCenter]} numberOfLines={2}>
              {winIn}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={[styles.metaCol, styles.metaColCenter]}>
            <View style={[styles.metaHeadRow, styles.metaHeadRowCenter]}>
              <MaterialCommunityIcons name="cash" size={13} color={colors.muted} />
              <Text style={styles.metaHead} numberOfLines={1}>
                Commission
              </Text>
            </View>
            <Text
              style={[styles.metaVal, styles.metaValEmph, styles.metaValCenter]}
              numberOfLines={1}
            >
              {commission}
            </Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={[styles.metaCol, styles.metaColLast, styles.metaColCenter]}>
            <View style={[styles.metaHeadRow, styles.metaHeadRowCenter]}>
              <MaterialCommunityIcons name="robot-outline" size={13} color={colors.muted} />
              <Text style={styles.metaHead} numberOfLines={1}>
                Bot
              </Text>
            </View>
            {hasBot ? (
              <Text
                style={[
                  styles.metaVal,
                  styles.metaValCenter,
                  botOk ? styles.checkOk : styles.checkNotOk,
                ]}
                numberOfLines={1}
              >
                {botPassed}/{botTotal}
              </Text>
            ) : (
              <Text
                style={[styles.metaVal, styles.metaValSub, styles.metaValCenter]}
                numberOfLines={1}
              >
                —
              </Text>
            )}
          </View>
        </View>
      </View>
      {hasBot ? (
        <View style={styles.botReportRow}>
          <View style={styles.botReportMeta}>
            <Text style={styles.sectionLabel}>Bot Report</Text>
            <Text
              style={[styles.metaVal, botOk ? styles.checkOk : styles.checkNotOk]}
              numberOfLines={1}
            >
              {botPassed}/{botTotal} passed
            </Text>
          </View>
          <TouchableOpacity
            style={styles.botReportBtn}
            onPress={() => onBotReport(r)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons
              name="file-document-outline"
              size={14}
              color={colors.primaryForeground}
            />
            <Text style={styles.botReportBtnText}>Bot Report</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {showAddBene ? (
        <View style={styles.beneCardRow}>
          <View style={styles.beneCardMeta}>
            <Text style={styles.sectionLabel}>Beneficiary</Text>
            <Text style={styles.beneCardValue} numberOfLines={1}>
              {beneList.length > 0
                ? beneList.length === 1
                  ? beneList[0]
                  : `${beneList.length} Bene(s)`
                : 'No Bene'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBeneBtn, (busy || addBeneBusy) && styles.checkBtnDisabled]}
            disabled={busy || addBeneBusy}
            onPress={() => void onAddBeneficiary(r)}
          >
            <MaterialCommunityIcons
              name="account-plus-outline"
              size={14}
              color={colors.primaryForeground}
            />
            <Text style={styles.addBeneBtnText}>Add Bene</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {checksAllowed ? (
        <>
          <View style={styles.checkGroup}>
            <Text style={styles.sectionLabel}>Check</Text>
            {checkFirst ? (
              <View style={styles.checkDoneChip}>
                <Text
                  style={[
                    styles.checkSymbol,
                    checkFirst.status ? styles.checkOk : styles.checkNotOk,
                  ]}
                >
                  {checkFirst.status ? '✓' : '✗'}
                </Text>
                <Text style={styles.checkDoneName} numberOfLines={1}>
                  by {display(checkFirst.name)}
                </Text>
              </View>
            ) : (
              <View style={styles.checkActions}>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnOk, busy && styles.checkBtnDisabled]}
                  disabled={busy}
                  onPress={() => void onCheck(r, 'first', true)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialCommunityIcons name="check" size={18} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnCross, busy && styles.checkBtnDisabled]}
                  disabled={busy}
                  onPress={() => void onCheck(r, 'first', false)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {checkFirst?.status ? (
            <View style={styles.checkGroup}>
              <Text style={styles.sectionLabel}>Cross Check</Text>
              {checkSecond ? (
                <View style={styles.checkDoneChip}>
                  <Text
                    style={[
                      styles.checkSymbol,
                      checkSecond.status ? styles.checkOk : styles.checkNotOk,
                    ]}
                  >
                    {checkSecond.status ? '✓' : '✗'}
                  </Text>
                  <Text style={styles.checkDoneName} numberOfLines={1}>
                    by {display(checkSecond.name)}
                  </Text>
                </View>
              ) : (
                <View style={styles.checkActions}>
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.iconBtnOk, busy && styles.checkBtnDisabled]}
                    disabled={busy}
                    onPress={() => void onCheck(r, 'second', true)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons name="check" size={18} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.iconBtnCross, busy && styles.checkBtnDisabled]}
                    disabled={busy}
                    onPress={() => void onCheck(r, 'second', false)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
