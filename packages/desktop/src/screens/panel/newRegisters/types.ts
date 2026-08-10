export type NestedCaller = {
  name?: string;
  Dp_ID?: string;
} | null;

export type RegistrationComment = {
  comment?: string;
  who?: { userId?: string; userName?: string };
  createdOn?: string;
  createdAt?: string;
  date?: string;
};

export type RegistrationCallLog = {
  who?: { userId?: string; userName?: string };
  createdOn?: string;
  createdAt?: string;
  date?: string;
  status?: string;
};

export type UserRow = {
  _id?: string;
  name?: string;
  userComesFrom?: string;
  balance?: number | string;
  activeUser?: string;
  userBankName?: string;
  clientName?: string;
  played?: string;
  encryptedUserName?: string;
  mobile?: string;
  userMobile?: string;
  kyc?: boolean;
  accountNumber?: string;
  aadhaarNumber?: string;
  email?: string;
  city?: string;
  state?: string;
  previousCaller?: NestedCaller;
  currentCaller?: NestedCaller;
  empCode?: string;
  referredCode?: string;
  referralCodeUser?: string;
  deviceType?: string;
  currentAppVersion?: string;
  createdOn?: string;
  createdAt?: string;
  bonusWalletBalance?: number | string;
  blockUser?: boolean;
  block?: boolean;
  blockUserReason?: string;
  aadharAddress?: Record<string, unknown>;
  newRegistrationComments?: RegistrationComment[];
  registrationComments?: RegistrationComment[];
  comments?: RegistrationComment[];
  callLogsForNewRegistration?: RegistrationCallLog[];
  callLogs?: RegistrationCallLog[];
};

export type UsersListResponse = {
  users?: UserRow[];
  items?: UserRow[];
  total?: number;
  count?: number;
  totalPages?: number;
};

export type NewRegistersAdmin = {
  _id?: string;
  name?: string;
  empCode?: string;
  extensionId?: string[];
  serverId?: string | number;
  clientName?: string | string[];
  allotedApps?: string | string[];
  accessibleStates?: string[];
};

export type ActiveStatusFilter = 'All' | 'Active' | 'InActive';
export type NewRegistrationFilter = 'True' | 'False';
