/**
 * Lightweight Narad Ask answer parser — focuses on GFM pipe tables + text.
 * Avoids pulling a full markdown dependency into mobile/desktop.
 */

export type NaradAskTextBlock = { type: 'text'; text: string };
export type NaradAskTableBlock = {
  type: 'table';
  headers: string[];
  rows: string[][];
};
export type NaradAskBlock = NaradAskTextBlock | NaradAskTableBlock;

function isSeparatorRow(line: string): boolean {
  // |---|:---|---:| or ---|---
  const cells = splitPipeRow(line);
  if (!cells.length) return false;
  return cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s+/g, '')));
}

function splitPipeRow(line: string): string[] {
  let raw = String(line || '').trim();
  if (!raw) return [];
  if (raw.startsWith('|')) raw = raw.slice(1);
  if (raw.endsWith('|')) raw = raw.slice(0, -1);
  return raw.split('|').map((c) => c.trim());
}

function looksLikeTableHeader(line: string, next: string | undefined): boolean {
  if (!next || !line.includes('|')) return false;
  return isSeparatorRow(next);
}

/**
 * Parse Ask AI answer into text + table blocks for polished UI rendering.
 */
export function parseNaradAskBlocks(answer: string): NaradAskBlock[] {
  const src = String(answer || '').replace(/\r\n/g, '\n').trim();
  if (!src) return [];

  const lines = src.split('\n');
  const blocks: NaradAskBlock[] = [];
  let textBuf: string[] = [];

  const flushText = () => {
    const text = textBuf.join('\n').trim();
    textBuf = [];
    if (text) blocks.push({ type: 'text', text });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];

    if (looksLikeTableHeader(line, next)) {
      flushText();
      const headers = splitPipeRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && !isSeparatorRow(lines[i])) {
        const cells = splitPipeRow(lines[i]);
        if (cells.some((c) => c.length > 0)) {
          // Normalize column count to header width.
          const row = headers.map((_, idx) => cells[idx] ?? '');
          rows.push(row);
        }
        i += 1;
      }
      if (headers.length) blocks.push({ type: 'table', headers, rows });
      continue;
    }

    textBuf.push(line);
    i += 1;
  }

  flushText();
  return blocks.length ? blocks : [{ type: 'text', text: src }];
}
