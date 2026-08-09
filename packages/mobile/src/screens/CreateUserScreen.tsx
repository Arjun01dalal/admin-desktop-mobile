/**
 * Create User / Admin — mobile port of desktop CreateUserDialog.
 * users.create (User) / users.createSubAdmin (Admin), same validation.
 * Shared resources: CLIENT_NAMES / appCodeForName / INDIA_STATES from @astro/shared.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CLIENT_NAMES, INDIA_STATES, appCodeForName } from '@astro/shared';
import { secureApi } from '../api/client';
import { colors, radius, spacing } from '../theme';

type Mode = 'user' | 'admin';

type Form = {
  name: string;
  mobile: string;
  password: string;
  clientName: string;
  roleName: string;
  state: string;
  city: string;
};

const EMPTY: Form = {
  name: '',
  mobile: '',
  password: '',
  clientName: '',
  roleName: '',
  state: '',
  city: '',
};

const APP_OPTIONS = CLIENT_NAMES.map((name) => ({
  value: name as string,
  label: appCodeForName(name),
}));

export function CreateUserScreen() {
  const [mode, setMode] = useState<Mode>('user');
  const isAdmin = mode === 'admin';
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picker, setPicker] = useState<null | 'app' | 'state'>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const setField = (key: keyof Form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = () => {
    const next: Partial<Record<keyof Form, string>> = {};
    if (!form.name.trim()) next.name = 'Name is required';
    if (!/^\d{10}$/.test(form.mobile.trim())) next.mobile = 'Enter a valid 10-digit mobile';
    if (form.password.trim().length < 6) next.password = 'Min 6 characters';
    if (!isAdmin && !form.clientName) next.clientName = 'App is required';
    if (isAdmin && !form.roleName.trim()) next.roleName = 'Role is required';
    if (!form.state) next.state = 'State is required';
    if (!form.city.trim()) next.city = 'City is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const raw: Record<string, string> = isAdmin
        ? {
            name: form.name,
            mobile: form.mobile,
            password: form.password,
            roleName: form.roleName,
            state: form.state,
            city: form.city,
          }
        : {
            name: form.name,
            mobile: form.mobile,
            password: form.password,
            clientName: form.clientName,
            state: form.state,
            city: form.city,
          };
      const payload = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => String(v).trim() !== ''),
      );
      const res = await secureApi<unknown>(
        isAdmin ? 'users.createSubAdmin' : 'users.create',
        payload,
      );
      if (!res.ok) {
        Alert.alert(res.message || `Failed to create ${isAdmin ? 'admin' : 'user'}`);
        return;
      }
      Alert.alert(
        res.message || (isAdmin ? 'Admin created successfully' : 'User created successfully'),
      );
      setForm(EMPTY);
      setErrors({});
      setShowPassword(false);
    } finally {
      setLoading(false);
    }
  };

  const pickerOptions = useMemo(() => {
    const base =
      picker === 'app'
        ? APP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
        : INDIA_STATES.map((s) => ({ value: s as string, label: s as string }));
    const q = pickerQuery.trim().toLowerCase();
    return q ? base.filter((o) => o.label.toLowerCase().includes(q)) : base;
  }, [picker, pickerQuery]);

  const field = (
    key: keyof Form,
    label: string,
    props?: Partial<React.ComponentProps<typeof TextInput>>,
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, errors[key] && styles.inputError]}
        value={form[key]}
        onChangeText={(t) => setField(key, t)}
        placeholder={label}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
      />
      {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
    </View>
  );

  const selectField = (key: 'clientName' | 'state', label: string, target: 'app' | 'state') => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.selectInput, errors[key] && styles.inputError]}
        onPress={() => {
          setPickerQuery('');
          setPicker(target);
        }}
      >
        <Text style={form[key] ? styles.selectValue : styles.selectPlaceholder}>
          {key === 'clientName' && form.clientName
            ? appCodeForName(form.clientName)
            : form[key] || `Select ${label.toLowerCase()}`}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </TouchableOpacity>
      {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.modeRow}>
          {(['user', 'admin'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeChip, mode === m && styles.modeChipActive]}
              onPress={() => {
                setMode(m);
                setErrors({});
              }}
            >
              <Text style={[styles.modeChipText, mode === m && styles.modeChipTextActive]}>
                {m === 'user' ? 'New User' : 'Admin User'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{isAdmin ? 'Create Admin User' : 'Create New User'}</Text>

          {field('name', 'Name', { autoCapitalize: 'words' })}
          {isAdmin ? field('roleName', 'Role', { autoCapitalize: 'words' }) : null}
          {field('mobile', 'Mobile', {
            keyboardType: 'number-pad',
            maxLength: 10,
            onChangeText: (t: string) => setField('mobile', t.replace(/\D/g, '').slice(0, 10)),
          })}

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[styles.input, styles.passwordRow, errors.password && styles.inputError]}
            >
              <TextInput
                style={styles.passwordInput}
                value={form.password}
                onChangeText={(t) => setField('password', t)}
                placeholder="Min 6 characters"
                placeholderTextColor={colors.muted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Text style={styles.eye}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {!isAdmin ? selectField('clientName', 'App Code', 'app') : null}
          {selectField('state', 'State', 'state')}
          {field('city', 'City', { autoCapitalize: 'words' })}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={() => void submit()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.submitText}>{isAdmin ? 'CREATE ADMIN' : 'CREATE USER'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>
              {picker === 'app' ? 'Select App' : 'Select State'}
            </Text>
            <TextInput
              style={styles.pickerSearch}
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder="Search…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <FlatList
              data={pickerOptions}
              keyExtractor={(o) => o.value}
              style={styles.pickerList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected =
                  picker === 'app' ? form.clientName === item.value : form.state === item.value;
                return (
                  <TouchableOpacity
                    style={[styles.pickerRow, selected && styles.pickerRowActive]}
                    onPress={() => {
                      setField(picker === 'app' ? 'clientName' : 'state', item.value);
                      setPicker(null);
                    }}
                  >
                    <Text style={[styles.pickerRowText, selected && styles.pickerRowTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={styles.pickerClose} onPress={() => setPicker(null)}>
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: spacing(4), paddingBottom: spacing(10) },
  modeRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(3) },
  modeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  modeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeChipText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  modeChipTextActive: { color: colors.primaryForeground },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(4),
  },
  title: { color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: spacing(3) },
  field: { marginBottom: spacing(3) },
  label: { color: colors.muted, fontSize: 12, marginBottom: spacing(1) },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
  },
  inputError: { borderColor: colors.destructive },
  errorText: { color: colors.destructive, fontSize: 11, marginTop: spacing(1) },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
  },
  passwordInput: { flex: 1, color: colors.foreground, fontSize: 14, paddingVertical: spacing(2.5) },
  eye: { fontSize: 16, paddingLeft: spacing(2) },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { color: colors.foreground, fontSize: 14 },
  selectPlaceholder: { color: colors.muted, fontSize: 14 },
  selectChevron: { color: colors.muted, fontSize: 12 },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(2),
  },
  submitText: { color: colors.primaryForeground, fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  btnDisabled: { opacity: 0.6 },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: spacing(5),
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing(3),
    maxHeight: '75%',
  },
  pickerTitle: { color: colors.foreground, fontWeight: '700', fontSize: 15 },
  pickerSearch: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 13,
    marginVertical: spacing(2),
  },
  pickerList: { flexGrow: 0 },
  pickerRow: {
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(2),
    borderRadius: radius.sm,
  },
  pickerRowActive: { backgroundColor: colors.surfaceAlt },
  pickerRowText: { color: colors.foreground, fontSize: 14 },
  pickerRowTextActive: { color: colors.primary, fontWeight: '700' },
  pickerClose: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    marginTop: spacing(2),
  },
  pickerCloseText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
});
