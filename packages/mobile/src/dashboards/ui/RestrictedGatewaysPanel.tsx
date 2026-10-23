/**
 * Restricted Gateway — mobile parity with admin WhatsAppOnlyGateways.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  buildRestrictedGatewaysSetPayload,
  dedupeGatewayNames,
  extractDepositGatewayOptions,
  extractRestrictedGatewayNames,
  mergeGatewayOptions,
} from '@astro/shared';

import { styles } from './RestrictedGatewaysPanel.styles';
import { getStoredUser } from '../../lib/webShim';
import { secureApi } from '../../api/client';
import { colors } from '../../theme';


export function RestrictedGatewaysPanel() {
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowedNames, setAllowedNames] = useState<string[]>([]);

  const [modalLoading, setModalLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gatewayOptions, setGatewayOptions] = useState<string[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [filterText, setFilterText] = useState('');
  const [err, setErr] = useState('');

  const loadAllowed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await secureApi('restrictedGateways.get', {});
      if (!res.ok) {
        setAllowedNames([]);
        return;
      }
      setAllowedNames(extractRestrictedGatewayNames(res.data));
    } catch {
      setAllowedNames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllowed();
  }, [loadAllowed]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setModalLoading(true);
      setOptionsLoading(true);
      setErr('');
      try {
        const res = await secureApi('restrictedGateways.get', {});
        if (cancelled) return;
        if (!res.ok) {
          setErr(res.message || 'Failed to load saved gateways');
          setSelectedNames([]);
          setSavedNames([]);
        } else {
          const selected = extractRestrictedGatewayNames(res.data);
          setSelectedNames(selected);
          setSavedNames(selected);
          setGatewayOptions((prev) => mergeGatewayOptions(prev, selected));
          setAllowedNames(selected);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setModalLoading(false);
      }

      try {
        const res = await secureApi('depositProviders.list', {});
        if (cancelled) return;
        if (res.ok) {
          const options = extractDepositGatewayOptions(res.data);
          setSelectedNames((selected) => {
            setGatewayOptions(mergeGatewayOptions(options, selected));
            return selected;
          });
        }
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggleName = (name: string) => {
    setSelectedNames((prev) => {
      const key = name.toLowerCase();
      const has = prev.some((n) => n.toLowerCase() === key);
      return has ? prev.filter((n) => n.toLowerCase() !== key) : dedupeGatewayNames([...prev, name]);
    });
  };

  const handleSave = async () => {
    const payload = buildRestrictedGatewaysSetPayload(selectedNames, {
      userId: String(admin?._id || ''),
      userName: String(admin?.name || 'Admin'),
    });
    if (!payload.names.length) {
      setErr('Select at least one gateway');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await secureApi('restrictedGateways.set', payload);
      if (!res.ok) {
        setErr(res.message || 'Failed to save');
        return;
      }
      setSavedNames(payload.names);
      setAllowedNames(payload.names);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredOptions = gatewayOptions.filter((n) =>
    n.toLowerCase().includes(filterText.trim().toLowerCase()),
  );

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>Restricted Gateway</Text>
            <Text style={styles.sub}>Allowed gateways from GET API</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => setOpen(true)}>
            <Text style={styles.editBtnText}>Edit Gateways</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : allowedNames.length ? (
          <View style={styles.chips}>
            {allowedNames.map((name) => (
              <View key={name} style={styles.chip}>
                <Text style={styles.chipText}>{name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            No restricted gateways configured yet. Tap Edit Gateways to set.
          </Text>
        )}
      </View>

      {open ? (
        <Modal
          visible
          animationType="slide"
          transparent
          onRequestClose={() => !saving && setOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Restricted Gateway</Text>
              {modalLoading ? (
                <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
              ) : (
                <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
                  <Text style={styles.sectionLabel}>Currently allowed (GET)</Text>
                  <View style={styles.chips}>
                    {savedNames.length ? (
                      savedNames.map((name) => (
                        <View key={name} style={styles.chip}>
                          <Text style={styles.chipText}>{name}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.empty}>No gateways saved yet.</Text>
                    )}
                  </View>

                  <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
                    Edit selection{optionsLoading ? ' · loading providers…' : ''}
                  </Text>
                  <TextInput
                    style={styles.search}
                    value={filterText}
                    onChangeText={setFilterText}
                    placeholder="Search deposit gateway"
                    placeholderTextColor={colors.muted}
                  />
                  <View style={styles.chips}>
                    {selectedNames.map((name) => (
                      <TouchableOpacity
                        key={`sel-${name}`}
                        style={[styles.chip, styles.chipSelected]}
                        onPress={() => toggleName(name)}
                      >
                        <Text style={styles.chipText}>{name} ×</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.optionList}>
                    {filteredOptions.map((name) => {
                      const selected = selectedNames.some(
                        (n) => n.toLowerCase() === name.toLowerCase(),
                      );
                      return (
                        <TouchableOpacity
                          key={name}
                          style={[styles.optionRow, selected && styles.optionRowOn]}
                          onPress={() => toggleName(name)}
                        >
                          <Text style={styles.optionText}>
                            {selected ? '✓ ' : ''}
                            {name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.meta}>
                    Editing: {selectedNames.length} selected · {gatewayOptions.length} provider
                    options
                  </Text>
                  {err ? <Text style={styles.error}>{err}</Text> : null}
                </ScrollView>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  disabled={saving}
                  onPress={() => setOpen(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (saving || modalLoading) && { opacity: 0.6 }]}
                  disabled={saving || modalLoading}
                  onPress={() => void handleSave()}
                >
                  <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
