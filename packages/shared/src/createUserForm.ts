/** Shared Create User / Admin / Master form helpers (admin-panel CreateUserModal). */

export type CreateUserMode = 'user' | 'admin';

export type CreateUserForm = {
  name: string;
  mobile: string;
  password: string;
  clientName: string;
  roleName: string;
  state: string;
  city: string;
  master: boolean;
};

export type CreateUserFormErrors = Partial<Record<keyof CreateUserForm | 'otp', string>>;

export const EMPTY_CREATE_USER_FORM: CreateUserForm = {
  name: '',
  mobile: '',
  password: '',
  clientName: '',
  roleName: '',
  state: '',
  city: '',
  master: false,
};

/** Normal users need OTP; SubAdmin and Master skip OTP. */
export function createUserRequiresOtp(mode: CreateUserMode, master: boolean): boolean {
  return mode !== 'admin' && !master;
}

export function validateCreateUserForm(
  form: CreateUserForm,
  mode: CreateUserMode,
): CreateUserFormErrors {
  const errors: CreateUserFormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.mobile.trim()) errors.mobile = 'Mobile number is required';
  else if (!/^\d{10}$/.test(form.mobile.trim())) {
    errors.mobile = 'Enter valid 10 digit mobile number';
  }
  if (!form.password.trim()) errors.password = 'Password is required';
  else if (form.password.trim().length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }
  if (mode !== 'admin' && !form.clientName.trim()) {
    errors.clientName = 'App Name is required';
  }
  if (!form.state.trim()) errors.state = 'State is required';
  if (!form.city.trim()) errors.city = 'City is required';
  return errors;
}

export function validateCreateUserOtp(otp: string): string | undefined {
  const trimmed = otp.trim();
  if (!trimmed || !/^\d{4,6}$/.test(trimmed)) return 'Enter a valid OTP';
  return undefined;
}

export type CreateUserCreator = {
  _id?: string | null;
  name?: string | null;
  empCode?: string | null;
};

/**
 * Build User/create-user (or SubAdmin) payload.
 * For create-user: includes createdBy + empCode only when empCode is present.
 */
export function buildCreateUserPayload(
  form: CreateUserForm,
  mode: CreateUserMode,
  creator?: CreateUserCreator | null,
): Record<string, unknown> {
  if (mode === 'admin') {
    return omitEmpty({
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      password: form.password,
      roleName: form.roleName.trim(),
      state: form.state.trim(),
      city: form.city.trim(),
    });
  }

  const creatorId = String(creator?._id || '').trim();
  const creatorName = String(creator?.name || '').trim();
  const empCode = String(creator?.empCode || '').trim();

  const raw: Record<string, unknown> = {
    name: form.name.trim(),
    mobile: form.mobile.trim(),
    password: form.password,
    clientName: form.clientName.trim(),
    state: form.state.trim(),
    city: form.city.trim(),
    master: form.master,
  };

  if (creatorId || creatorName) {
    raw.createdBy = {
      ...(creatorId ? { _id: creatorId } : {}),
      ...(creatorName ? { name: creatorName } : {}),
    };
  }

  // Only pass empCode when the logged-in admin has one
  if (empCode) raw.empCode = empCode;

  return omitEmpty(raw);
}

function omitEmpty(raw: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(raw).filter(([key, value]) => {
      if (key === 'master') return value === true;
      if (value && typeof value === 'object') return Object.keys(value as object).length > 0;
      return String(value ?? '').trim() !== '';
    }),
  );
}
