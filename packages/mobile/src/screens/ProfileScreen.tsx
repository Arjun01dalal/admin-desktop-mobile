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
import { getAppVersion } from '../utils/appVersion';
import { styles } from './ProfileScreen.styles';

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
      Alert.alert('Change role', error instanceof Error ? error.message : 'Failed to update role');
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
                  {active ? (
                    <MaterialIcons name="check" size={20} color={colors.primaryForeground} />
                  ) : null}
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
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.root}
      contentContainerStyle={styles.content}
    >
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
        <Text style={styles.version}>App version {getAppVersion()}</Text>
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

