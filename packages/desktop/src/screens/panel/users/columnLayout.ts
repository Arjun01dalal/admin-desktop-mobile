/** Fixed column sizing — keeps Users table compact without clipping actions. */
export function fixedCol(width: number, opts?: { fontSize?: number; px?: number }) {
  const px = opts?.px ?? 0.5;
  return {
    width,
    sx: {
      width,
      minWidth: width,
      maxWidth: width,
      px,
      boxSizing: 'border-box' as const,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      whiteSpace: 'nowrap' as const,
      verticalAlign: 'middle' as const,
      ...(opts?.fontSize != null ? { fontSize: opts.fontSize } : {}),
    },
  };
}

export const INDEX_COL = fixedCol(44);
export const NAME_COL = fixedCol(128, { px: 0.75 });
export const DP_ID_COL = fixedCol(158, { px: 0.75 });
export const BANK_COL = fixedCol(100);
export const APP_COL = fixedCol(52);
export const EMP_COL = fixedCol(100);
export const PLAY_COL = fixedCol(52);
export const MOBILE_COL = {
  width: 168,
  sx: {
    width: 168,
    minWidth: 168,
    maxWidth: 180,
    px: 0.5,
    boxSizing: 'border-box' as const,
    overflow: 'hidden' as const,
    whiteSpace: 'normal' as const,
    verticalAlign: 'middle' as const,
  },
};
export const KYC_COL = fixedCol(64);
export const ACCOUNT_COL = fixedCol(108);
export const AADHAR_COL = fixedCol(108);
export const EMAIL_COL = fixedCol(120);
export const CITY_COL = fixedCol(84);
export const STATE_COL = fixedCol(92);
export const CALLER_COL = fixedCol(96);
export const AMOUNT_COL = fixedCol(78);
export const DATETIME_COL = fixedCol(126, { fontSize: 11 });
export const ACTION_COL = fixedCol(88);
export const REASON_COL = fixedCol(100);

/** @deprecated aliases used by other user-type tables */
export const NAME_COL_WIDTH = NAME_COL.width;
export const NAME_COL_SX = NAME_COL.sx;
export const DP_ID_COL_WIDTH = DP_ID_COL.width;
export const DP_ID_COL_SX = DP_ID_COL.sx;
export const STATE_COL_WIDTH = STATE_COL.width;
export const STATE_COL_SX = STATE_COL.sx;
export const CITY_COL_WIDTH = CITY_COL.width;
export const CITY_COL_SX = CITY_COL.sx;
export const DATETIME_COL_WIDTH = DATETIME_COL.width;
export const DATETIME_COL_SX = DATETIME_COL.sx;
