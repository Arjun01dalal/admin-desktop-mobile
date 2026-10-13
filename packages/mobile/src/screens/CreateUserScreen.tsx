/**
 * Create User / Admin / Master — mobile port of CreateUserDialog.
 * Normal users: send OTP → verify → create. Master & Admin skip OTP.
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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CLIENT_NAMES, INDIA_STATES, appCodeForName } from '@astro/shared';
import {
  EMPTY_CREATE_USER_FORM,
  buildCreateUserPayload,
  createUserRequiresOtp,
  validateCreateUserForm,
  validateCreateUserOtp,
  type CreateUserForm,
  type CreateUserFormErrors,
  type CreateUserMode,
} from '@astro/shared/createUserForm';
import { secureApi } from '../api/client';
import { getSessionUser, hasPermission } from '../auth/permissions';
import { colors } from '../theme';
import { styles } from './CreateUserScreen.styles';

type Props = {
  onCreated?: () => void;
};

const APP_OPTIONS = CLIENT_NAMES.map((name) => ({
  value: name as string,
  label: appCodeForName(name),
}));

export function CreateUserScreen({ onCreated }: Props) {
  const canCreateUser = hasPermission('create_new_user');
  const canCreateAdmin = hasPermission('create_admin_user');
  const canCreateMaster = hasPermission('create_master_user');

  const [mode, setMode] = useState<CreateUserMode>(() =>
    canCreateUser ? 'user' : 'admin',
  );
  const isAdmin = mode === 'admin';

  const [form, setForm] = useState<CreateUserForm>(EMPTY_CREATE_USER_FORM);
  const [errors, setErrors] = useState<CreateUserFormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [picker, setPicker] = useState<null | 'app' | 'state'>(null);
  const [pickerQuery, setPickerQuery] = useState('');

  const requiresOtp = createUserRequiresOtp(mode, form.master);

  const setField = <K extends keyof CreateUserForm>(key: K, value: CreateUserForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
    if (key === 'master' && value === true) {
      setOtpStep(false);
      setOtp('');
      setErrors((prev) => ({ ...prev, otp: undefined }));
    }
  };

  const resetForm = () => {
    setForm(EMPTY_CREATE_USER_FORM);
    setErrors({});
    setShowPassword(false);
    setOtpStep(false);
    setOtp('');
  };

  const createUser = async () => {
    const admin = getSessionUser();
    const payload = buildCreateUserPayload(form, mode, {
      _id: admin?._id,
      name: admin?.name,
      empCode: admin?.empCode,
    });
    const res = await secureApi<unknown>(
      isAdmin ? 'users.createSubAdmin' : 'users.create',
      payload,
    );
    if (!res.ok) {
      Alert.alert(res.message || `Failed to create ${isAdmin ? 'admin' : 'user'}`);
      return false;
    }
    Alert.alert(
      res.message ||
        (form.master
          ? 'Master user created successfully'
          : isAdmin
            ? 'Admin created successfully'
            : 'User created successfully'),
    );
    resetForm();
    onCreated?.();
    return true;
  };

  const sendOtp = async () => {
    const mobile = form.mobile.replace(/\D/g, '');
    const res = await secureApi('users.sendWalletOtp', { mobile });
    if (!res.ok || res.success === false) {
      Alert.alert(res.message || 'Failed to send OTP');
      return false;
    }
    Alert.alert(res.message || 'OTP sent successfully');
    return true;
  };

  const verifyOtp = async () => {
    const mobile = form.mobile.replace(/\D/g, '');
    const res = await secureApi('users.verifyBlockOtp', {
      mobile,
      otp: parseInt(otp, 10),
    });
    if (!res.ok || res.success === false) {
      Alert.alert(res.message || 'OTP verification failed');
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (!otpStep) {
      const next = validateCreateUserForm(form, mode);
      setErrors(next);
      if (Object.keys(next).length > 0) return;
    }

    setLoading(true);
    try {
      if (!requiresOtp) {
        await createUser();
        return;
      }
      if (!otpStep) {
        if (await sendOtp()) setOtpStep(true);
        return;
      }
      const otpErr = validateCreateUserOtp(otp);
      if (otpErr) {
        setErrors((prev) => ({ ...prev, otp: otpErr }));
        return;
      }
      if (await verifyOtp()) await createUser();
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
    key: keyof CreateUserForm,
    label: string,
    props?: Partial<React.ComponentProps<typeof TextInput>>,
  ) => {
    if (key === 'master') return null;
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          style={[styles.input, errors[key] && styles.inputError]}
          value={String(form[key] ?? '')}
          onChangeText={(t) => setField(key, t as CreateUserForm[typeof key])}
          placeholder={label}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
        />
        {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
      </View>
    );
  };

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

  const title = otpStep
    ? 'Verify OTP'
    : isAdmin
      ? 'Create Admin User'
      : form.master
        ? 'Create Master User'
        : 'Create New User';

  const primaryLabel = loading
    ? 'Please wait…'
    : otpStep
      ? 'VERIFY & CREATE'
      : requiresOtp
        ? 'SEND OTP'
        : form.master
          ? 'CREATE MASTER'
          : isAdmin
            ? 'CREATE ADMIN'
            : 'CREATE USER';

  const showModeRow = canCreateUser && canCreateAdmin;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {showModeRow && !otpStep ? (
          <View style={styles.modeRow}>
            {(
              [
                { key: 'user' as const, label: 'New User', show: canCreateUser },
                { key: 'admin' as const, label: 'Admin User', show: canCreateAdmin },
              ] as const
            )
              .filter((m) => m.show)
              .map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.modeChip, mode === m.key && styles.modeChipActive]}
                  onPress={() => {
                    setMode(m.key);
                    setErrors({});
                    setOtpStep(false);
                    setOtp('');
                    setForm((prev) => ({ ...prev, master: false }));
                  }}
                >
                  <Text
                    style={[styles.modeChipText, mode === m.key && styles.modeChipTextActive]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {!otpStep && requiresOtp ? (
            <Text style={styles.hint}>OTP will be sent to the new user&apos;s mobile.</Text>
          ) : null}
          {!otpStep && form.master ? (
            <Text style={styles.masterHint}>Master user — OTP is skipped.</Text>
          ) : null}

          {!otpStep ? (
            <>
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
                    <Text style={styles.eye}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              {!isAdmin ? selectField('clientName', 'App Name', 'app') : null}
              {selectField('state', 'State', 'state')}
              {field('city', 'City', { autoCapitalize: 'words' })}

              {!isAdmin && canCreateMaster ? (
                <TouchableOpacity
                  style={[styles.masterCard, form.master && styles.masterCardActive]}
                  onPress={() => setField('master', !form.master)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.masterCheck, form.master && styles.masterCheckOn]}>
                    {form.master ? <Text style={styles.masterCheckMark}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.masterTitle}>Master User</Text>
                    <Text style={styles.masterSub}>Skip OTP · create as master</Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <View style={styles.field}>
              <Text style={styles.hint}>
                OTP sent to {form.mobile}. Enter OTP to create this user.
              </Text>
              <Text style={styles.label}>Enter OTP</Text>
              <TextInput
                style={[styles.input, errors.otp && styles.inputError]}
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/\D/g, '').slice(0, 6));
                  setErrors((prev) => ({ ...prev, otp: undefined }));
                }}
                placeholder="4–6 digit OTP"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {errors.otp ? <Text style={styles.errorText}>{errors.otp}</Text> : null}
            </View>
          )}

          <View style={styles.actionsRow}>
            {otpStep ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                disabled={loading}
                onPress={() => {
                  setOtpStep(false);
                  setOtp('');
                  setErrors((prev) => ({ ...prev, otp: undefined }));
                }}
              >
                <Text style={styles.secondaryBtnText}>Back</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.btnDisabled, { flex: 1 }]}
              onPress={() => void submit()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.submitText}>{primaryLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
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
              showsVerticalScrollIndicator={false}
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
