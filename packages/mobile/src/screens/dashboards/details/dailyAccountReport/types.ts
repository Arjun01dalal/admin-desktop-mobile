import type { BankAccount, DaySheetItem, MidAllotment, MidRecord } from './api';

export type TabKey = 'balance' | 'banks' | 'mids' | 'allot';

export type EntryMode = 'open' | 'close' | 'correct';

export type DarListRow = DaySheetItem | BankAccount | MidRecord | MidAllotment;

export type UpdatedBy = { userId: string; userName: string };

export type BankFormState = {
  _id: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: string;
  displayName: string;
  status: string;
};

export type MidFormState = {
  _id: string;
  mid: string;
  displayName: string;
  phoneNumber: string;
  upiId: string;
  bankAccountId: string;
  source: string;
  status: string;
};

export type AssignFormState = {
  midId: string;
  midLabel: string;
  subAdminId: string;
  subAdminLabel: string;
  remark: string;
};

export const EMPTY_BANK_FORM: BankFormState = {
  _id: '',
  bankName: '',
  accountHolderName: '',
  accountNumber: '',
  ifscCode: '',
  accountType: 'savings',
  displayName: '',
  status: 'active',
};

export const EMPTY_MID_FORM: MidFormState = {
  _id: '',
  mid: '',
  displayName: '',
  phoneNumber: '',
  upiId: '',
  bankAccountId: '',
  source: 'manual',
  status: 'active',
};

export const EMPTY_ASSIGN_FORM: AssignFormState = {
  midId: '',
  midLabel: '',
  subAdminId: '',
  subAdminLabel: '',
  remark: '',
};
