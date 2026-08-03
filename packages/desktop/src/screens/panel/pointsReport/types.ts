export type PointsReportDoc = {
  _id?: string;
  userName?: string;
  userBankName?: string;
  userId?: string;
  clientName?: string;
  userMobile?: string;
  balance?: number | string;
  tag?: string;
  reason?: string;
  mid?: string;
  remakr?: string;
  remark?: string;
  createdOn?: string;
  [key: string]: unknown;
};

export type PointsReportRow = {
  _id: string;
  subadminName?: string;
  realName?: string;
  subadminMobile?: string;
  creditCount?: number;
  totalBalanceGiven?: number;
  debitCount?: number;
  totalBalanceRemove?: number;
  documents?: PointsReportDoc[];
  [key: string]: unknown;
};
