import React from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ACCOUNT_TYPES, bankOptionLabel } from '@astro/shared/dailyAccountReport';

import type { AssignFormState, BankFormState, EntryMode, MidFormState } from './types';
import type { BalanceImagePart, BankAccount, MidRecord, SubAdminOption } from './api';
import { styles } from './DailyAccountReportScreen.styles';
import { colors } from '../../../../theme';


type BalanceEntryModalProps = {
  open: boolean;
  saving: boolean;
  mode: EntryMode;
  midLabel: string;
  amount: string;
  remark: string;
  image: BalanceImagePart | null;
  onChangeAmount: (v: string) => void;
  onChangeRemark: (v: string) => void;
  onPickImage: () => void;
  onClose: () => void;
  onSave: () => void;
};

export function BalanceEntryModal({
  open,
  saving,
  mode,
  midLabel,
  amount,
  remark,
  image,
  onChangeAmount,
  onChangeRemark,
  onPickImage,
  onClose,
  onSave,
}: BalanceEntryModalProps) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>
              {mode === 'correct'
                ? 'Correct balance'
                : mode === 'open'
                  ? 'Opening balance'
                  : 'Closing balance'}
            </Text>
            <Text style={styles.modalSub}>{midLabel}</Text>
            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={onChangeAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Remark {mode === 'correct' ? '*' : '(optional)'}</Text>
            <TextInput
              style={styles.input}
              value={remark}
              onChangeText={onChangeRemark}
              placeholder="Note"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity style={styles.ghostBtn} onPress={onPickImage}>
              <Text style={styles.ghostBtnText}>
                {image ? `Image: ${image.name}` : 'Attach screenshot (optional)'}
              </Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.ghostBtn, styles.flex1]} disabled={saving} onPress={onClose}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.flex1, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={onSave}
              >
                <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type BankFormModalProps = {
  open: boolean;
  saving: boolean;
  form: BankFormState;
  setForm: React.Dispatch<React.SetStateAction<BankFormState>>;
  onClose: () => void;
  onSave: () => void;
};

export function BankFormModal({ open, saving, form, setForm, onClose, onSave }: BankFormModalProps) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{form._id ? 'Edit bank' : 'Add bank'}</Text>
            <Text style={styles.label}>Bank name *</Text>
            <TextInput
              style={styles.input}
              value={form.bankName}
              onChangeText={(v) => setForm((c) => ({ ...c, bankName: v }))}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Account holder *</Text>
            <TextInput
              style={styles.input}
              value={form.accountHolderName}
              onChangeText={(v) => setForm((c) => ({ ...c, accountHolderName: v }))}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Account number *</Text>
            <TextInput
              style={styles.input}
              value={form.accountNumber}
              onChangeText={(v) => setForm((c) => ({ ...c, accountNumber: v }))}
              keyboardType="number-pad"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>IFSC *</Text>
            <TextInput
              style={styles.input}
              value={form.ifscCode}
              autoCapitalize="characters"
              onChangeText={(v) => setForm((c) => ({ ...c, ifscCode: v }))}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={form.displayName}
              onChangeText={(v) => setForm((c) => ({ ...c, displayName: v }))}
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.label}>Account type</Text>
            <View style={styles.rowActions}>
              {ACCOUNT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.smallBtn, form.accountType === type && styles.smallBtnPrimary]}
                  onPress={() => setForm((c) => ({ ...c, accountType: type }))}
                >
                  <Text style={form.accountType === type ? styles.smallBtnPrimaryText : styles.smallBtnText}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.ghostBtn, styles.flex1]} disabled={saving} onPress={onClose}>
                <Text style={styles.ghostBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, styles.flex1, saving && { opacity: 0.6 }]}
                disabled={saving}
                onPress={onSave}
              >
                <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type MidFormModalProps = {
  open: boolean;
  saving: boolean;
  form: MidFormState;
  setForm: React.Dispatch<React.SetStateAction<MidFormState>>;
  bankChoices: BankAccount[];
  pickBankOpen: boolean;
  setPickBankOpen: (v: boolean) => void;
  onClose: () => void;
  onSave: () => void;
};

export function MidFormModal({
  open,
  saving,
  form,
  setForm,
  bankChoices,
  pickBankOpen,
  setPickBankOpen,
  onClose,
  onSave,
}: MidFormModalProps) {
  return (
    <>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{form._id ? 'Edit MID' : 'Add MID'}</Text>
              {!form._id ? (
                <>
                  <Text style={styles.label}>MID *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.mid}
                    onChangeText={(v) => setForm((c) => ({ ...c, mid: v }))}
                    placeholderTextColor={colors.muted}
                  />
                </>
              ) : null}
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={form.displayName}
                onChangeText={(v) => setForm((c) => ({ ...c, displayName: v }))}
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={form.phoneNumber}
                onChangeText={(v) => setForm((c) => ({ ...c, phoneNumber: v }))}
                keyboardType="phone-pad"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.label}>UPI</Text>
              <TextInput
                style={styles.input}
                value={form.upiId}
                onChangeText={(v) => setForm((c) => ({ ...c, upiId: v }))}
                autoCapitalize="none"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.label}>Bank account *</Text>
              <TouchableOpacity style={styles.pickerRow} onPress={() => setPickBankOpen(true)}>
                <Text style={form.bankAccountId ? styles.pickerText : styles.pickerMuted}>
                  {form.bankAccountId
                    ? bankOptionLabel(
                        bankChoices.find((b) => b._id === form.bankAccountId) || {
                          _id: form.bankAccountId,
                          bankName: form.bankAccountId,
                          accountHolderName: '',
                          accountNumber: '',
                          ifscCode: '',
                          accountType: '',
                          displayName: form.bankAccountId,
                          status: 'active',
                        },
                      )
                    : 'Select bank'}
                </Text>
              </TouchableOpacity>
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.ghostBtn, styles.flex1]} disabled={saving} onPress={onClose}>
                  <Text style={styles.ghostBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex1, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={onSave}
                >
                  <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pickBankOpen} transparent animationType="fade" onRequestClose={() => setPickBankOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select bank</Text>
            <ScrollView style={styles.optionList}>
              {bankChoices.map((bank) => (
                <TouchableOpacity
                  key={bank._id}
                  style={styles.optionItem}
                  onPress={() => {
                    setForm((c) => ({ ...c, bankAccountId: bank._id }));
                    setPickBankOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{bankOptionLabel(bank)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setPickBankOpen(false)}>
              <Text style={styles.ghostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

type AllotFormModalProps = {
  open: boolean;
  saving: boolean;
  assignMode: 'allot' | 'reassign';
  form: AssignFormState;
  setForm: React.Dispatch<React.SetStateAction<AssignFormState>>;
  activeMids: MidRecord[];
  subAdmins: SubAdminOption[];
  pickMidOpen: boolean;
  setPickMidOpen: (v: boolean) => void;
  pickSubOpen: boolean;
  setPickSubOpen: (v: boolean) => void;
  onClose: () => void;
  onSave: () => void;
};

export function AllotFormModal({
  open,
  saving,
  assignMode,
  form,
  setForm,
  activeMids,
  subAdmins,
  pickMidOpen,
  setPickMidOpen,
  pickSubOpen,
  setPickSubOpen,
  onClose,
  onSave,
}: AllotFormModalProps) {
  return (
    <>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => !saving && onClose()}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>
                {assignMode === 'reassign' ? 'Reassign MID' : 'Allot MID'}
              </Text>
              <Text style={styles.label}>MID *</Text>
              {assignMode === 'allot' ? (
                <TouchableOpacity style={styles.pickerRow} onPress={() => setPickMidOpen(true)}>
                  <Text style={form.midId ? styles.pickerText : styles.pickerMuted}>
                    {form.midLabel || 'Select MID'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={[styles.input, { paddingTop: 12 }]}>{form.midLabel}</Text>
              )}
              <Text style={styles.label}>Sub-admin *</Text>
              <TouchableOpacity style={styles.pickerRow} onPress={() => setPickSubOpen(true)}>
                <Text style={form.subAdminId ? styles.pickerText : styles.pickerMuted}>
                  {form.subAdminLabel || 'Select sub-admin'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.label}>Remark</Text>
              <TextInput
                style={styles.input}
                value={form.remark}
                onChangeText={(v) => setForm((c) => ({ ...c, remark: v }))}
                placeholderTextColor={colors.muted}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.ghostBtn, styles.flex1]} disabled={saving} onPress={onClose}>
                  <Text style={styles.ghostBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, styles.flex1, saving && { opacity: 0.6 }]}
                  disabled={saving}
                  onPress={onSave}
                >
                  <Text style={styles.primaryBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pickMidOpen} transparent animationType="fade" onRequestClose={() => setPickMidOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select MID</Text>
            <ScrollView style={styles.optionList}>
              {activeMids.map((mid) => (
                <TouchableOpacity
                  key={mid._id}
                  style={styles.optionItem}
                  onPress={() => {
                    setForm((c) => ({
                      ...c,
                      midId: mid._id,
                      midLabel: [mid.mid, mid.displayName, mid.upiId].filter(Boolean).join(' · '),
                    }));
                    setPickMidOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>
                    {[mid.mid, mid.displayName].filter(Boolean).join(' · ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setPickMidOpen(false)}>
              <Text style={styles.ghostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={pickSubOpen} transparent animationType="fade" onRequestClose={() => setPickSubOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select sub-admin</Text>
            <ScrollView style={styles.optionList}>
              {subAdmins.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.optionItem}
                  onPress={() => {
                    setForm((c) => ({
                      ...c,
                      subAdminId: sub.id,
                      subAdminLabel: sub.label,
                    }));
                    setPickSubOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{sub.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setPickSubOpen(false)}>
              <Text style={styles.ghostBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
