/** Duplicate choice + change-details flow for C2C campaigns. */
import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';

import type { C2cCallerOption, C2cCampaign } from '@astro/shared';

import { colors } from '../../../../theme';
import {
  C2cCampaignFormModal,
  type C2cCampaignFormValues,
} from './C2cCampaignFormModal';
import { styles } from './styles';

type Props = {
  choiceOpen: boolean;
  formOpen: boolean;
  source: C2cCampaign | null;
  duplicating: boolean;
  formValues: C2cCampaignFormValues;
  callers: C2cCallerOption[];
  onClose: () => void;
  onKeepSame: () => void;
  onChangeDetails: () => void;
  onFormChange: (next: C2cCampaignFormValues) => void;
  onSubmitForm: () => void;
};

export function C2cDuplicateModals({
  choiceOpen,
  formOpen,
  source,
  duplicating,
  formValues,
  callers,
  onClose,
  onKeepSame,
  onChangeDetails,
  onFormChange,
  onSubmitForm,
}: Props) {
  return (
    <>
      <Modal
        visible={choiceOpen}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Duplicate campaign</Text>
            <Text style={styles.modalBody}>
              {source?.campaignName
                ? `Duplicate “${source.campaignName}” with the same details, or change name / callers / status first?`
                : 'Keep the same details, or change name / callers / status first?'}
            </Text>
            <View style={styles.modalActionsCol}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={onChangeDetails}
                disabled={duplicating}
              >
                <Text style={styles.modalBtnPrimaryText}>Change details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={onKeepSame}
                disabled={duplicating}
              >
                {duplicating ? (
                  <ActivityIndicator color={colors.foreground} />
                ) : (
                  <Text style={styles.modalBtnGhostText}>Keep same</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnGhost]}
                onPress={onClose}
                disabled={duplicating}
              >
                <Text style={styles.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <C2cCampaignFormModal
        visible={formOpen}
        title="Duplicate — change details"
        submitLabel="Duplicate"
        values={formValues}
        callers={callers}
        saving={duplicating}
        onChange={onFormChange}
        onClose={onClose}
        onSubmit={onSubmitForm}
      />
    </>
  );
}
