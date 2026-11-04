/**
 * Narad Ask — POST https://narad.laxminarayan.live/ask
 * Secure action: gtel.naradAsk
 */

export type NaradAskUser = {
  id: string;
  role: string;
};

export type NaradAskPayload = {
  question: string;
  user: NaradAskUser;
};

export function buildNaradAskPayload(
  question: string,
  user: { id?: string; name?: string; role?: string } | null | undefined,
): NaradAskPayload {
  const q = String(question || '').trim();
  const id =
    String(user?.id || user?.name || '')
      .trim()
      .slice(0, 80) || 'admin';
  const role = String(user?.role || 'admin')
    .trim()
    .slice(0, 64) || 'admin';
  return { question: q, user: { id, role } };
}

/** Best-effort answer text from unknown API envelopes. */
export function extractNaradAskAnswer(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw !== 'object') return String(raw);

  const root = raw as Record<string, unknown>;
  const nested =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;

  const candidates: unknown[] = [
    root.answer,
    root.response,
    root.result,
    root.message,
    root.text,
    root.content,
    nested?.answer,
    nested?.response,
    nested?.result,
    nested?.message,
    nested?.text,
    nested?.content,
    nested,
    root.data,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }

  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}
