/**
 * Profile / account screen — opened from the header avatar.
 * Shows identity (name, mobile, email) plus SOS, reveal-codes, theme, logout.
 */
import React, { useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import {
  buildSosEnablePayload,
  canShowSos,
  getRoleName,
  isSosExemptRole,
} from '../auth/permissions';
import { useSos } from '../auth/useSosGuard';
import { secureApi } from '../api/client';
import { getRoleOptions } from '../auth/roleSelection';
import { RevealCodesOtpModal } from '../components/RevealCodesOtpModal';
import { useRevealCodes } from '../context/useRevealCodes';
import {
  colors,
  getThemeMode,
  radius,
  reloadAppForTheme,
  setThemeMode,
  spacing,
  type ThemeMode,
} from '../theme';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

function display(value: unknown): string {
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function ThemePicker() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode());

  const pick = (next: ThemeMode) => {
    if (next === mode) return;
    setMode(next);
    void (async () => {
      await setThemeMode(next);
      await reloadAppForTheme();
    })();
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>Theme</Text>
      <View style={styles.themeChips}>
        {THEME_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.themeChip, mode === opt.value && styles.themeChipActive]}
            onPress={() => pick(opt.value)}
          >
            <Text style={[styles.themeChipText, mode === opt.value && styles.themeChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function RevealCodesRow() {
  const reveal = useRevealCodes();
  const [otpOpen, setOtpOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.actionRow}
        onPress={() => {
          if (reveal.active) {
            reveal.clear();
            return;
          }
          setOtpOpen(true);
        }}
        accessibilityLabel={reveal.active ? 'Hide original names' : 'Reveal original names'}
      >
        <MaterialIcons
          name={reveal.active ? 'visibility' : 'visibility-off'}
          size={22}
          color={colors.foreground}
        />
        <View style={styles.actionTextWrap}>
          <Text style={styles.actionTitle}>
            {reveal.active ? 'Hide original names' : 'Reveal original names'}
          </Text>
          <Text style={styles.actionSub}>
            {reveal.active
              ? 'Showing real / reversal text (tap to hide)'
              : 'OTP unlock to show real names instead of Jyotish labels'}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
      </TouchableOpacity>
      <RevealCodesOtpModal visible={otpOpen} onClose={() => setOtpOpen(false)} />
    </>
  );
}

function ChangeRoleRow() {
  const { user, switchRole } = useAuth();
  const options = getRoleOptions(user);
  const [open, setOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState(String(user?.Role_ID || ''));
  const [busy, setBusy] = useState(false);

  if (options.length === 0) return null;

  const submit = async () => {
    if (!selectedRoleId || busy) return;
    setBusy(true);
    try {
      await switchRole(selectedRoleId);
      setOpen(false);
      Alert.alert('Role updated', 'Your menu and permissions have been refreshed.');
    } catch (error) {
      Alert.alert(
        'Change role',
        error instanceof Error ? error.message : 'Failed to update role',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.actionRow}
        onPress={() => {
          setSelectedRoleId(String(user?.Role_ID || ''));
          setOpen(true);
        }}
      >
        <MaterialIcons name="swap-horiz" size={22} color={colors.foreground} />
        <View style={styles.actionTextWrap}>
          <Text style={styles.actionTitle}>Change role</Text>
          <Text style={styles.actionSub}>{getRoleName(user) || 'Select active role'}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.roleModal}>
            <Text style={styles.roleModalTitle}>Change Role</Text>
            <Text style={styles.roleModalSub}>Select the role you want to use</Text>
            {options.map((role) => {
              const active = selectedRoleId === role.id;
              return (
                <TouchableOpacity
                  key={role.id}
                  style={[styles.roleOption, active && styles.roleOptionActive]}
                  disabled={busy}
                  onPress={() => setSelectedRoleId(role.id)}
                >
                  <Text style={[styles.roleOptionText, active && styles.roleOptionTextActive]}>
                    {role.name}
                  </Text>
                  {active ? <MaterialIcons name="check" size={20} color={colors.primaryForeground} /> : null}
                </TouchableOpacity>
              );
            })}
            <View style={styles.roleActions}>
              <TouchableOpacity
                style={styles.roleCancel}
                disabled={busy}
                onPress={() => setOpen(false)}
              >
                <Text style={styles.roleCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleSubmit, (!selectedRoleId || busy) && { opacity: 0.55 }]}
                disabled={!selectedRoleId || busy}
                onPress={() => void submit()}
              >
                {busy ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.roleSubmitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function SosRow() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const { sosEnabled, setSosEnabled, refresh, markOriginator } = useSos();
  const sosExempt = isSosExemptRole();
  if (!(canShowSos() || (sosEnabled && sosExempt))) return null;

  const sendSos = async () => {
    if (busy) return;
    const built = buildSosEnablePayload();
    if (!built.ok) {
      Alert.alert('SOS', built.message);
      return;
    }
    setBusy(true);
    try {
      const res = await secureApi('auth.sosFlag', built.payload);
      if (!res.ok) {
        Alert.alert('SOS', res.message || 'Failed to send SOS alert');
        return;
      }
      setSosEnabled(true);
      markOriginator();
      if (!sosExempt) {
        Alert.alert('SOS', 'SOS alert sent. Support will contact you shortly.');
        logout();
      } else {
        await refresh();
        Alert.alert('SOS', 'SOS alert sent. Support will contact you shortly.');
      }
    } catch (err) {
      Alert.alert('SOS', err instanceof Error ? err.message : 'Failed to send SOS alert');
    } finally {
      setBusy(false);
    }
  };

  const unblockUsers = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await secureApi('auth.sosFlag', { enabled: false, type: 'all' });
      if (!res.ok) {
        Alert.alert('SOS', res.message || 'Failed to unblock users');
        return;
      }
      setSosEnabled(false);
      await refresh();
      Alert.alert('SOS', 'Users unblocked. SOS lock cleared.');
    } catch (err) {
      Alert.alert('SOS', err instanceof Error ? err.message : 'Failed to unblock users');
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.sosBtn, sosEnabled && styles.sosBtnActive]}
      disabled={busy}
      accessibilityLabel={sosEnabled ? 'Unblock users' : 'Send SOS alert'}
      onPress={() => {
        if (sosEnabled) {
          Alert.alert('Unblock users', 'Clear the SOS lock for everyone?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unblock', style: 'destructive', onPress: () => void unblockUsers() },
          ]);
          return;
        }
        Alert.alert(
          'SOS',
          `Emergency support — use only when you need immediate help from the admin team.\n\nLogged in as ${String(
            user?.name || user?.mobile || 'Admin',
          )}.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send SOS', style: 'destructive', onPress: () => void sendSos() },
          ],
        );
      }}
    >
      <MaterialIcons name="sos" size={22} color="#fff" />
      <Text style={styles.sosBtnText}>
        {busy ? '…' : sosEnabled ? 'Unblock users' : 'Send SOS'}
      </Text>
    </TouchableOpacity>
  );
}

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const role = getRoleName(user) || '—';
  const email = user?.email;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <MaterialIcons name="person" size={40} color={colors.primaryForeground} />
        </View>
        <Text style={styles.name}>{display(user?.name)}</Text>
        <Text style={styles.role}>{display(role)}</Text>
      </View>

      <View style={styles.card}>
        <InfoRow icon="person" label="Name" value={display(user?.name)} />
        <InfoRow icon="phone" label="Mobile" value={display(user?.mobile)} />
        <InfoRow icon="email" label="Email" value={display(email)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Account</Text>
        <ChangeRoleRow />
        <RevealCodesRow />
        <ThemePicker />
        <SosRow />
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            Alert.alert('Logout', 'Sign out of Astro Admin?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Logout', style: 'destructive', onPress: logout },
            ]);
          }}
        >
          <MaterialIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <MaterialIcons name={icon} size={20} color={colors.muted} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue} selectable>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: {
    padding: spacing(4),
    paddingBottom: spacing(10),
    gap: spacing(4),
  },
  avatarWrap: { alignItems: 'center', marginTop: spacing(2), marginBottom: spacing(1) },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(2),
  },
  name: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  role: { color: colors.muted, fontSize: 13, marginTop: spacing(1) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(3),
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(3) },
  infoText: { flex: 1 },
  infoLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: { color: colors.foreground, fontSize: 15, marginTop: 2, fontWeight: '600' },
  section: { gap: spacing(2) },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  themeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  themeChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  themeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  themeChipText: { color: colors.foreground, fontSize: 13, fontWeight: '600' },
  themeChipTextActive: { color: colors.primaryForeground },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(1),
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { color: colors.foreground, fontSize: 15, fontWeight: '600' },
  actionSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing(5),
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  roleModal: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  roleModalTitle: { color: colors.foreground, fontSize: 20, fontWeight: '800' },
  roleModalSub: { color: colors.muted, fontSize: 13, marginBottom: spacing(1) },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(3),
  },
  roleOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleOptionText: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  roleOptionTextActive: { color: colors.primaryForeground },
  roleActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(2), marginTop: spacing(2) },
  roleCancel: { paddingHorizontal: spacing(4), paddingVertical: spacing(2.5) },
  roleCancelText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  roleSubmit: {
    minWidth: 96,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
  },
  roleSubmitText: { color: colors.primaryForeground, fontSize: 14, fontWeight: '800' },
  sosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: colors.destructive,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
  },
  sosBtnActive: { backgroundColor: colors.success },
  sosBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.4 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(2),
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(4),
  },
  logoutBtnText: { color: colors.destructive, fontSize: 14, fontWeight: '700' },
});
