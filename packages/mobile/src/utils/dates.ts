/** Date helpers — mirror desktop utils/dates.ts (IST-based). */
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
}

export function daysAgoIST(days: number): string {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000 - days * 86_400_000)
    .toISOString()
    .split('T')[0];
}

export function monthStartIST(): string {
  const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
