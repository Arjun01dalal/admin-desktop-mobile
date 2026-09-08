const CALLING_BOT_ORIGIN = 'https://helper.callingbot.live';
const REQUEST_TIMEOUT_MS = 60_000;

export type IncomingCall = {
  sid: string;
  from?: string;
  to?: string;
  direction?: string;
  status?: string;
  start_time?: string;
  duration?: string | number;
  recording_url?: string | null;
};

export type CallSummaryFlag = {
  flag?: unknown;
  reason?: string;
  level?: unknown;
  required?: unknown;
  value?: unknown;
  detected?: unknown;
  types?: string[];
};

export type CallAnalysis = {
  summary?: unknown;
  transcript?: string;
  next_best_action?: unknown;
  threat?: CallSummaryFlag;
  priority?: CallSummaryFlag;
  human_intervention?: CallSummaryFlag;
  satisfaction?: CallSummaryFlag;
  frustration?: CallSummaryFlag;
  nuisance?: CallSummaryFlag;
  repeated_complaint?: CallSummaryFlag;
  pii_details?: CallSummaryFlag;
};

export type CallSummaryPayload = CallAnalysis & {
  analysis?: CallAnalysis;
};

export type CallSummaryData = {
  status?: string;
  message?: string;
  call_sid?: string;
  data?: CallSummaryPayload;
};

type IncomingCallsResponse = {
  calls?: IncomingCall[];
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseIncomingCall(value: unknown): IncomingCall | null {
  if (!isRecord(value) || typeof value.sid !== 'string' || !value.sid.trim()) return null;
  return {
    sid: value.sid,
    from: typeof value.from === 'string' ? value.from : undefined,
    to: typeof value.to === 'string' ? value.to : undefined,
    direction: typeof value.direction === 'string' ? value.direction : undefined,
    status: typeof value.status === 'string' ? value.status : undefined,
    start_time: typeof value.start_time === 'string' ? value.start_time : undefined,
    duration:
      typeof value.duration === 'string' || typeof value.duration === 'number'
        ? value.duration
        : undefined,
    recording_url: typeof value.recording_url === 'string' ? value.recording_url : null,
  };
}

async function requestJson(
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${CALLING_BOT_ORIGIN}${path}`, {
      ...init,
      signal: controller.signal,
    });
    return {
      response,
      data: await response.json().catch(() => null),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function listIncomingCalls(
  since: string,
  until?: string,
): Promise<IncomingCallsResponse> {
  const params = new URLSearchParams({ since });
  if (until) params.set('until', until);
  const path = `/incoming-calls?${params.toString()}`;
  const { response, data } = await requestJson(path);
  if (!response.ok) {
    throw new Error(`Failed to load incoming calls (HTTP ${response.status})`);
  }

  const calls =
    isRecord(data) && Array.isArray(data.calls)
      ? data.calls.map(parseIncomingCall).filter((call): call is IncomingCall => call !== null)
      : [];
  return {
    calls,
    message: isRecord(data) && typeof data.message === 'string' ? data.message : undefined,
  };
}

export async function processIncomingCall(callSid: string): Promise<{
  response: Response;
  data: CallSummaryData | null;
}> {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(callSid)) {
    throw new Error('Invalid call SID');
  }
  const { response, data } = await requestJson('/process-call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ call_sid: callSid }),
  });
  return {
    response,
    data: isRecord(data) ? (data as CallSummaryData) : null,
  };
}
