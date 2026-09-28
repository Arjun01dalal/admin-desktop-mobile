/**
 * Comment lists and local row patches shared by desktop and mobile.
 * Screens keep their own dialogs; this module only updates the row in memory
 * after the API succeeds, so the full user list is not refetched.
 */

export type CommentWho = { userId?: string; userName?: string };

export type RowComment = {
  comment?: string;
  commented_by?: string;
  userName?: string;
  who?: CommentWho | any;
  createdOn?: string;
  createdAt?: string;
  date?: string;
};

export type KycCheckStamp = { name?: string; date?: string };

export type KycFieldPatch = {
  comment: string;
  accountNumber: string;
  ifsc: string;
  aadhaarNumber: string;
  upiId: string;
};

const REGISTRATION_COMMENT_KEYS = [
  'newRegistrationComments',
  'registrationComments',
  'comments',
] as const;

const NON_PERFORMING_COMMENT_KEYS = [
  'nonPerformingComments',
  'nonPerformingComment',
  'newRegistrationComments',
  'comments',
] as const;

/** First truthy list on the row. A non-array value stops the lookup, matching `||`. */
export function firstCommentList<T = RowComment>(
  row: object | null | undefined,
  keys: readonly string[],
): T[] {
  if (!row) return [];
  const rec = row as Record<string, unknown>;
  for (const key of keys) {
    const raw = rec[key];
    if (!raw) continue;
    return Array.isArray(raw) ? (raw as T[]) : [];
  }
  return [];
}

export function registrationCommentsOf<T = RowComment>(row: object | null | undefined): T[] {
  return firstCommentList<T>(row, REGISTRATION_COMMENT_KEYS);
}

export function nonPerformingCommentsOf<T = RowComment>(row: object | null | undefined): T[] {
  return firstCommentList<T>(row, NON_PERFORMING_COMMENT_KEYS);
}

export function withRegistrationComment<T extends object>(row: T, entry: RowComment): T {
  return {
    ...row,
    newRegistrationComments: [...registrationCommentsOf<RowComment>(row), entry],
  };
}

export function kycApprovedRowPatch(fields: KycFieldPatch) {
  return {
    kyc: true as const,
    currentKycNote: fields.comment.trim(),
    accountNumber: fields.accountNumber.trim(),
    ifsc: fields.ifsc.trim(),
    aadhaarNumber: fields.aadhaarNumber.trim(),
    upiId: fields.upiId.trim(),
  };
}

export function kycRejectedRowPatch(by: { name?: string }, at = new Date().toISOString()) {
  return {
    kycRejectCheckBy: { name: by.name, date: at } satisfies KycCheckStamp,
  };
}

export function kycManualRowPatch(fields: KycFieldPatch, by: { name?: string }, at = new Date().toISOString()) {
  return {
    currentKycNote: fields.comment.trim(),
    accountNumber: fields.accountNumber.trim(),
    aadhaarNumber: fields.aadhaarNumber.trim(),
    upiId: fields.upiId.trim(),
    ifsc: fields.ifsc.trim(),
    kycManualCheckBy: { name: by.name, date: at } satisfies KycCheckStamp,
  };
}
