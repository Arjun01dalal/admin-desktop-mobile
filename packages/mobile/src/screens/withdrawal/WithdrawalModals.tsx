/** Modal collection for WithdrawalScreen. Parent owns state and API actions. */
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { colors, radius, spacing } from '../../theme';
import { ValidationDetailsBlock } from './ValidationDetails';
import { display, fmtAmount, formatValidationCheckedAt, num, type Rec } from './helpers';
import { styles } from '../WithdrawalScreen.styles';

type WithdrawalModalsProps = {
  validationRow: Rec | null;
  setValidationRow: (row: Rec | null) => void;
  bulkManualOpen: boolean;
  setBulkManualOpen: (open: boolean) => void;
  actionBusy: boolean;
  bulkIds: string[];
  gateways: string[];
  gateway: string;
  setGateway: (v: string) => void;
  mids: Array<{ label: string; mid: string; gateway: string }>;
  mid: string;
  setMid: (v: string) => void;
  modalErr: string;
  setModalErr: (v: string) => void;
  doBulkManual: () => Promise<void>;
  addBeneRow: Rec | null;
  addBeneBusy: boolean;
  setAddBeneRow: (row: Rec | null) => void;
  addBeneSelected: string[];
  setAddBeneSelected: React.Dispatch<React.SetStateAction<string[]>>;
  addBeneSearch: string;
  setAddBeneSearch: (v: string) => void;
  availableBanks: string[];
  addBeneExisting: string[];
  submitAddBene: () => Promise<void>;
  beneOpen: boolean;
  setBeneOpen: (open: boolean) => void;
  beneBusy: boolean;
  beneInput: string;
  setBeneInput: (v: string) => void;
  beneBanks: string[];
  setBeneBanks: React.Dispatch<React.SetStateAction<string[]>>;
  saveBeneBanks: () => Promise<void>;
  approveTarget: { row: Rec | null; bulk: boolean } | null;
  setApproveTarget: (v: { row: Rec | null; bulk: boolean } | null) => void;
  provider: string;
  setProvider: (v: string) => void;
  doBulk: (kind: 'approve', provider: string) => Promise<void>;
  doStatusUpdate: (
    row: Rec,
    status: string,
    remark: string,
    gateway: string,
    mid: string,
    provider?: string,
  ) => Promise<void>;
  qrRow: Rec | null;
  setQrRow: (row: Rec | null) => void;
  qrUrl: string;
  qrRef: React.MutableRefObject<unknown>;
  openUpiApp: (app: 'phonepe' | 'gpay') => Promise<void>;
  downloadQr: () => void;
  gatewayOptions: Array<{ value: string; label: string }>;
  statusModal: { row: Rec; status: string } | null;
  setStatusModal: (v: { row: Rec; status: string } | null) => void;
  remark: string;
  setRemark: (v: string) => void;
};

export function WithdrawalModals(props: WithdrawalModalsProps) {
  const {
    validationRow,
    setValidationRow,
    bulkManualOpen,
    setBulkManualOpen,
    actionBusy,
    bulkIds,
    gateways,
    gateway,
    setGateway,
    mids,
    mid,
    setMid,
    modalErr,
    setModalErr,
    doBulkManual,
    addBeneRow,
    addBeneBusy,
    setAddBeneRow,
    addBeneSelected,
    setAddBeneSelected,
    addBeneSearch,
    setAddBeneSearch,
    availableBanks,
    addBeneExisting,
    submitAddBene,
    beneOpen,
    setBeneOpen,
    beneBusy,
    beneInput,
    setBeneInput,
    beneBanks,
    setBeneBanks,
    saveBeneBanks,
    approveTarget,
    setApproveTarget,
    provider,
    setProvider,
    doBulk,
    doStatusUpdate,
    qrRow,
    setQrRow,
    qrUrl,
    qrRef,
    openUpiApp,
    downloadQr,
    gatewayOptions,
    statusModal,
    setStatusModal,
    remark,
    setRemark,
  } = props;
  return (
    <>
      {/* Bot validation results (desktop ValidationModal parity) */}
      <Modal
        visible={validationRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setValidationRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.validationCard]}>
            <View style={styles.validationHeader}>
              <View style={styles.validationHeaderMain}>
                <Text style={styles.modalTitle}>Bot Report</Text>
                <Text style={styles.validationSub}>
                  Validation Results ({num(validationRow?.passedPoints)}/
                  {num(validationRow?.totalPoints)})
                </Text>
                {validationRow?.validationCheckedAt ? (
                  <Text style={styles.validationCheckedAt}>
                    Checked: {formatValidationCheckedAt(validationRow.validationCheckedAt)}
                  </Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.validationScoreBadge,
                  num(validationRow?.passedPoints) >= Math.max(1, num(validationRow?.totalPoints))
                    ? styles.validationScoreBadgePass
                    : styles.validationScoreBadgeWarn,
                ]}
              >
                <Text style={styles.validationScoreTop}>{num(validationRow?.passedPoints)}</Text>
                <Text style={styles.validationScoreBottom}>
                  of {num(validationRow?.totalPoints)}
                </Text>
              </View>
            </View>
            <ScrollView style={styles.validationList} showsVerticalScrollIndicator={false}>
              {(Array.isArray(validationRow?.validationResults)
                ? (validationRow?.validationResults as Rec[])
                : []
              ).map((v, i) => (
                <View key={String(v._id ?? i)} style={styles.validationItem}>
                  <View style={styles.validationHead}>
                    <View style={styles.validationNameWrap}>
                      <Text style={styles.validationPointLabel}>Point {display(v.point)}</Text>
                      <Text style={styles.validationName}>{display(v.name)}</Text>
                    </View>
                    <View
                      style={[
                        styles.validationStatusPill,
                        {
                          backgroundColor: v.passed
                            ? `${colors.success}22`
                            : `${colors.destructive}22`,
                          borderColor: v.passed ? `${colors.success}55` : `${colors.destructive}55`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.validationStatus,
                          { color: v.passed ? colors.success : colors.destructive },
                        ]}
                      >
                        {v.passed ? 'Passed' : 'Failed'}
                      </Text>
                    </View>
                  </View>
                  {v.reason ? (
                    <Text style={styles.validationReason}>{display(v.reason)}</Text>
                  ) : null}
                  <ValidationDetailsBlock details={v.details} />
                </View>
              ))}
              {!Array.isArray(validationRow?.validationResults) ||
              (validationRow?.validationResults as Rec[]).length === 0 ? (
                <View style={styles.validationEmptyState}>
                  <Text style={styles.validationEmptyTitle}>No validation details available</Text>
                  <Text style={styles.validationReason}>
                    This withdrawal has summary points only, but no per-check breakdown was
                    returned.
                  </Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.pagerBtn} onPress={() => setValidationRow(null)}>
                <Text style={styles.pagerBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Bulk Manual Approve modal (gateway + MID) */}
      <Modal
        visible={bulkManualOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setBulkManualOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Bulk Manual Approve ({bulkIds.length})</Text>
            <Text style={styles.modalSub}>Gateway</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gateways.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gateway === g && styles.chipActive]}
                  onPress={() => setGateway(g)}
                >
                  <Text style={[styles.chipText, gateway === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalSub}>MID</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mids.map((m) => (
                <TouchableOpacity
                  key={m.label}
                  style={[styles.chip, mid === m.mid && styles.chipActive]}
                  onPress={() => {
                    setMid(m.mid);
                    if (!gateway && m.gateway) setGateway(m.gateway);
                  }}
                >
                  <Text style={[styles.chipText, mid === m.mid && styles.chipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setBulkManualOpen(false)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() => void doBulkManual()}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Per-row Add Bene (desktop AddBeneDialog parity) */}
      <Modal
        visible={addBeneRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !addBeneBusy && setAddBeneRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, styles.addBeneCard]}>
            <Text style={styles.modalTitle}>Select Bank Account Name</Text>
            <Text style={styles.addBeneHint}>
              Green = already on beneficiary list. Select one or more banks below.
            </Text>
            {addBeneSelected.length > 0 ? (
              <Text style={styles.addBeneSelectedCount}>
                {addBeneSelected.length} bank(s) selected
              </Text>
            ) : null}
            <TextInput
              style={[styles.modalInput, { minHeight: 40, marginTop: spacing(1) }]}
              value={addBeneSearch}
              onChangeText={setAddBeneSearch}
              placeholder="Search bank name…"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
            {addBeneBusy && availableBanks.length === 0 ? (
              <ActivityIndicator style={{ marginVertical: spacing(4) }} color={colors.primary} />
            ) : availableBanks.length === 0 ? (
              <Text style={styles.muted}>No available banks — use Tools → Add Bene List first</Text>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.addBeneList}
                keyboardShouldPersistTaps="handled"
              >
                {availableBanks
                  .filter((b) => {
                    const q = addBeneSearch.trim().toLowerCase();
                    return !q || b.toLowerCase().includes(q);
                  })
                  .map((bank) => {
                    const already = addBeneExisting.some(
                      (e) => e.trim().toLowerCase() === bank.trim().toLowerCase(),
                    );
                    const isSelected = addBeneSelected.includes(bank);
                    return (
                      <TouchableOpacity
                        key={bank}
                        style={[
                          styles.addBeneItem,
                          already && styles.addBeneItemDone,
                          isSelected && !already && styles.addBeneItemSelected,
                        ]}
                        disabled={already || addBeneBusy}
                        onPress={() => {
                          setAddBeneSelected((prev) =>
                            prev.includes(bank) ? prev.filter((x) => x !== bank) : [...prev, bank],
                          );
                        }}
                      >
                        <Text
                          style={[
                            styles.addBeneCheck,
                            already || isSelected ? styles.checkOk : styles.muted,
                          ]}
                        >
                          {already || isSelected ? '✓' : '○'}
                        </Text>
                        <Text
                          style={[styles.addBeneItemText, already && styles.checkOk]}
                          numberOfLines={1}
                        >
                          {bank}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setAddBeneRow(null)}
                disabled={addBeneBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (addBeneBusy || addBeneSelected.length === 0) && styles.pagerBtnDisabled,
                ]}
                disabled={addBeneBusy || addBeneSelected.length === 0}
                onPress={() => void submitAddBene()}
              >
                {addBeneBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Bene List modal (desktop BeneModal parity — manage available banks) */}
      <Modal
        visible={beneOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !beneBusy && setBeneOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Bene List</Text>
            <View style={{ flexDirection: 'row', gap: spacing(2) }}>
              <TextInput
                style={[styles.modalInput, { flex: 1, marginTop: 0 }]}
                value={beneInput}
                onChangeText={setBeneInput}
                placeholder="Bank / account name…"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  const v = beneInput.trim();
                  if (!v) return;
                  if (beneBanks.some((b) => b.trim().toLowerCase() === v.toLowerCase())) {
                    setBeneInput('');
                    return;
                  }
                  setBeneBanks((prev) => [...prev, v]);
                  setBeneInput('');
                }}
              >
                <Text style={styles.confirmBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 260, marginTop: spacing(2) }}
            >
              {beneBusy && beneBanks.length === 0 ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : beneBanks.length === 0 ? (
                <Text style={styles.muted}>No banks yet — add one above.</Text>
              ) : (
                beneBanks.map((b) => (
                  <View key={b} style={styles.beneRow}>
                    <Text style={styles.beneText}>{b}</Text>
                    <TouchableOpacity
                      onPress={() => setBeneBanks((prev) => prev.filter((x) => x !== b))}
                    >
                      <MaterialCommunityIcons name="close" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setBeneOpen(false)}
                disabled={beneBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, beneBusy && styles.pagerBtnDisabled]}
                disabled={beneBusy}
                onPress={() => void saveBeneBanks()}
              >
                {beneBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Approve modal with withdrawal-provider selection (desktop gateway dropdown parity) */}
      <Modal
        visible={approveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setApproveTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {approveTarget?.bulk
                ? `Bulk Approve (${bulkIds.length})`
                : `Approve — ₹${fmtAmount(approveTarget?.row?.amount)}`}
            </Text>
            <Text style={styles.modalSub}>Refund Provider</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gateways.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, provider === g && styles.chipActive]}
                  onPress={() => setProvider(g)}
                >
                  <Text style={[styles.chipText, provider === g && styles.chipTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setApproveTarget(null)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() => {
                  if (!approveTarget) return;
                  if (!provider) {
                    setModalErr('Select a refund provider');
                    return;
                  }
                  const t = approveTarget;
                  setApproveTarget(null);
                  if (t.bulk) {
                    void doBulk('approve', provider);
                  } else if (t.row) {
                    void doStatusUpdate(t.row, 'Approved', '', '', '', provider);
                  }
                }}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code approve modal (desktop UPIQR popup parity) */}
      <Modal
        visible={qrRow !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setQrRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>QR Code — ₹{fmtAmount(qrRow?.amount)}</Text>
            <View style={{ alignItems: 'center', paddingVertical: spacing(3) }}>
              {qrUrl ? (
                <View
                  style={{ backgroundColor: '#fff', padding: spacing(3), borderRadius: radius.md }}
                >
                  <QRCode value={qrUrl} size={180} getRef={(c) => (qrRef.current = c)} />
                </View>
              ) : null}
              <Text style={[styles.modalSub, { textAlign: 'center' }]}>
                {String(qrRow?.upiId ?? '')}
              </Text>
              <View style={styles.qrIconRow}>
                <TouchableOpacity
                  style={[styles.qrIconBtn, { backgroundColor: '#5f259f' }]}
                  onPress={() => void openUpiApp('phonepe')}
                >
                  <Text style={styles.qrIconText}>Pe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qrIconBtn, { backgroundColor: '#1a73e8' }]}
                  onPress={() => void openUpiApp('gpay')}
                >
                  <Text style={styles.qrIconText}>G</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.qrIconBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={downloadQr}
                >
                  <MaterialCommunityIcons name="download" size={18} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.modalSub}>Gateway</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {gatewayOptions.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  style={[styles.chip, gateway === g.value && styles.chipActive]}
                  onPress={() => {
                    // Desktop parity: changing gateway resets the MID selection.
                    if (g.value !== gateway) setMid('');
                    setGateway(g.value);
                  }}
                >
                  <Text style={[styles.chipText, gateway === g.value && styles.chipTextActive]}>
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={styles.modalSub}>MID</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {mids.map((m) => (
                <TouchableOpacity
                  key={m.label}
                  style={[styles.chip, mid === m.mid && styles.chipActive]}
                  onPress={() => setMid(m.mid)}
                >
                  <Text style={[styles.chipText, mid === m.mid && styles.chipTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setQrRow(null)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() => {
                  if (!qrRow) return;
                  // Desktop QR popup requires gateway + MID before approving.
                  if (!gateway || !mid) {
                    setModalErr('Gateway and MID are required');
                    return;
                  }
                  const r = qrRow;
                  setQrRow(null);
                  // Desktop QR parity: reason marks the approval as done via UPI QR.
                  void doStatusUpdate(r, 'Approved', 'By UPI ID', gateway, mid);
                }}
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Submit to Approve</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status-change modal (remark + gateway/MID when required) */}
      <Modal
        visible={statusModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !actionBusy && setStatusModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{statusModal?.status}</Text>
            <Text style={styles.modalSub}>Remark (required)</Text>
            <TextInput
              style={styles.modalInput}
              value={remark}
              onChangeText={setRemark}
              placeholder="Reason…"
              placeholderTextColor={colors.muted}
              multiline
            />
            {statusModal &&
            !['Approved', 'Reverse', 'Rejected', 'on hold'].includes(statusModal.status) ? (
              <>
                <Text style={styles.modalSub}>Gateway</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {gatewayOptions.map((g) => (
                    <TouchableOpacity
                      key={g.value}
                      style={[styles.chip, gateway === g.value && styles.chipActive]}
                      onPress={() => {
                        // Desktop parity: changing gateway resets the MID selection.
                        if (g.value !== gateway) setMid('');
                        setGateway(g.value);
                      }}
                    >
                      <Text style={[styles.chipText, gateway === g.value && styles.chipTextActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={styles.modalSub}>MID</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {mids.map((m) => (
                    <TouchableOpacity
                      key={m.label}
                      style={[styles.chip, mid === m.mid && styles.chipActive]}
                      onPress={() => setMid(m.mid)}
                    >
                      <Text style={[styles.chipText, mid === m.mid && styles.chipTextActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : null}
            {modalErr ? <Text style={styles.modalErr}>{modalErr}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.pagerBtn}
                onPress={() => setStatusModal(null)}
                disabled={actionBusy}
              >
                <Text style={styles.pagerBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionBusy && styles.pagerBtnDisabled]}
                disabled={actionBusy}
                onPress={() =>
                  statusModal &&
                  void doStatusUpdate(statusModal.row, statusModal.status, remark, gateway, mid)
                }
              >
                {actionBusy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
