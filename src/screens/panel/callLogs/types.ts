export type CallLogRow = {
  _id?: string;
  call_sid?: string;
  client_name?: string;
  caller_user_id?: string;
  phone_number?: string;
  app_name?: string;
  state?: string;
  city?: string;
  email?: string;
  status?: string;
  call_duration?: number | string;
  recording_url?: string;
  bot_id?: number | string;
  completed_at?: string;
  comments?: string;
  commented_by?: string;
  deleted_by?: string;
  deleted_at?: string;
  last_played_date?: string;
  language?: string;
  reason?: string;
};

export type BotStatusSummary = {
  status?: Record<string, Record<string, number>>;
  'in-progress-bots-states'?: Record<string, string>;
};

export type CallLogsListResponse = {
  calls?: CallLogRow[];
  pagination?: { totalCount?: number; totalPages?: number };
};

export type CallLogsFilterState = {
  startDate: string;
  endDate: string;
  page: number;
  itemsPerPage: number;
  mobNo: string;
  dpId: string;
  sid: string;
  state: string;
  selectedStatus: string;
  selectedBotId: string;
  commentFilter: string;
};

export type DialerLead = {
  first_name: string;
  last_name: string;
  phone_number: string;
  city: string;
  state: string;
  email: string;
  comments: string;
  province: string;
};

/** Whitelist of fields sent to external dialer (data minimization). */
export type DialerConnectDetails = {
  call_sid?: string;
  client_name?: string;
  phone_number?: string;
  city?: string;
  state?: string;
  app_name?: string;
  caller_user_id?: string;
  _id?: string;
};

export const MAX_COMMENT_LENGTH = 500;
export const MAX_EXCEL_LEADS = 5000;
