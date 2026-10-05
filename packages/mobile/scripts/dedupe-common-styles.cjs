#!/usr/bin/env node
/**
 * Drop makeStyles() keys that already match styles/common.ts, and promote
 * keys that repeat identically across many screens into common.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const COMMON = path.join(SRC, 'styles', 'common.ts');
const MIN_PROMOTE = 6;

function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i) + 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      for (i++; i < src.length; i++) {
        if (src[i] === '\\') i++;
        else if (src[i] === quote) break;
      }
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalize(text) {
  return text.replace(/\s+/g, ' ').replace(/,\s*}/g, ' }').replace(/,\s*]/g, ' ]').trim();
}

function parseObjectProps(src, open) {
  const close = matchBrace(src, open);
  if (close < 0) return { close: -1, props: [] };
  const inner = src.slice(open + 1, close);
  const props = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && /[\s,]/.test(inner[i])) i++;
    if (i >= inner.length) break;
    if (inner[i] === '/' && inner[i + 1] === '/') {
      const nl = inner.indexOf('\n', i);
      i = nl < 0 ? inner.length : nl + 1;
      continue;
    }
    const nameMatch = inner.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
    if (!nameMatch) break;
    const name = nameMatch[1];
    const nameStart = open + 1 + i;
    i += nameMatch[0].length;
    while (i < inner.length && /\s/.test(inner[i])) i++;
    const valueStartInInner = i;
    const absValueStart = open + 1 + valueStartInInner;
    let valueEnd;
    if (inner[i] === '{' || inner[i] === '[' || inner[i] === '(') {
      valueEnd = matchBrace(src, absValueStart) + 1;
    } else {
      let j = absValueStart;
      while (j < src.length && src[j] !== ',' && src[j] !== '}') {
        if (src[j] === '{' || src[j] === '(' || src[j] === '[') {
          j = matchBrace(src, j);
          if (j < 0) break;
        }
        if (src[j] === '"' || src[j] === "'" || src[j] === '`') {
          const q = src[j];
          j++;
          while (j < src.length && src[j] !== q) {
            if (src[j] === '\\') j++;
            j++;
          }
        }
        j++;
      }
      valueEnd = j;
    }
    const valueText = src.slice(absValueStart, valueEnd).trim();
    let absEnd = valueEnd;
    while (absEnd < src.length && /[\s,]/.test(src[absEnd]) && src[absEnd] !== '}') absEnd++;
    props.push({
      name,
      nameStart,
      absEnd,
      valueText,
      norm: normalize(valueText),
      full: src.slice(nameStart, absEnd),
    });
    i = absEnd - (open + 1);
  }
  return { close, props };
}

function findCreate(src, fn) {
  const re = new RegExp(`${fn}\\(\\s*\\{`);
  const m = src.match(re);
  if (!m) return null;
  const open = src.indexOf('{', m.index);
  return { index: m.index, open, ...parseObjectProps(src, open) };
}

function stripThemeImports(src) {
  const body = src.replace(/^import[\s\S]*?from ['"][^'"]+['"];?/gm, '');
  const tokens = ['colors', 'radius', 'spacing', 'tint'].filter((t) =>
    new RegExp(`\\b${t}\\b`).test(body),
  );
  src = src.replace(/^import \{ [^}]* \} from '[^']*theme';\n/m, (line) => {
    if (!tokens.length) return '';
    return `import { ${tokens.join(', ')} } from ${line.split(' from ')[1]}`;
  });
  if (!/\btint\b/.test(body)) {
    src = src.replace(/^import \{ tint \} from '[^']*';\n/m, '');
  }
  if (!/\bStyleSheet\b/.test(body)) {
    src = src.replace(/^import \{ StyleSheet \} from 'react-native';\n/m, '');
  }
  return src;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.styles.ts')) out.push(p);
  }
  return out;
}

const commonSrc = fs.readFileSync(COMMON, 'utf8');
const commonObj = findCreate(commonSrc, 'StyleSheet\\.create');
if (!commonObj) throw new Error('common StyleSheet.create not found');
const commonMap = new Map(commonObj.props.map((p) => [p.name, p]));

const files = walk(SRC).filter((f) => f !== COMMON);
const occurrences = new Map(); // key -> Map(norm -> {count, sample})

const parsedFiles = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const obj = findCreate(src, 'makeStyles');
  if (!obj) continue;
  parsedFiles.push({ file, src, obj });
  for (const p of obj.props) {
    if (!occurrences.has(p.name)) occurrences.set(p.name, new Map());
    const byVal = occurrences.get(p.name);
    if (!byVal.has(p.norm)) byVal.set(p.norm, { count: 0, sample: p });
    byVal.get(p.norm).count++;
  }
}

const promote = [];
for (const [name, byVal] of occurrences) {
  if (commonMap.has(name)) continue;
  const values = [...byVal.values()].sort((a, b) => b.count - a.count);
  const top = values[0];
  const total = values.reduce((s, v) => s + v.count, 0);
  if (top.count >= MIN_PROMOTE && top.count === total) {
    promote.push({ name, sample: top.sample, count: top.count });
  }
}

if (promote.length) {
  const insertAt = commonObj.close;
  const block = promote
    .map((p) => `  ${p.name}: ${p.sample.valueText},`)
    .join('\n');
  const nextCommon =
    commonSrc.slice(0, insertAt) +
    `\n  // ── Repeated across screens ──────────────────────────────────────────\n${block}\n` +
    commonSrc.slice(insertAt);
  fs.writeFileSync(COMMON, nextCommon);
  for (const p of promote) commonMap.set(p.name, p.sample);
}

let strippedKeys = 0;
let filesTouched = 0;
for (const { file, src, obj } of parsedFiles) {
  const drop = new Set(
    obj.props.filter((p) => commonMap.has(p.name) && commonMap.get(p.name).norm === p.norm).map((p) => p.name),
  );
  if (!drop.size) continue;
  const keep = obj.props.filter((p) => !drop.has(p.name));
  strippedKeys += drop.size;
  const inner =
    keep.length === 0
      ? ''
      : `\n${keep.map((p) => `  ${p.name}: ${p.valueText},`).join('\n')}\n`;
  let out = src.slice(0, obj.open + 1) + inner + src.slice(obj.close);
  out = stripThemeImports(out);
  if (out !== src) {
    fs.writeFileSync(file, out);
    filesTouched++;
  }
}

console.log(
  `promoted ${promote.length} keys to common (${promote.map((p) => `${p.name}×${p.count}`).join(', ') || 'none'})`,
);
console.log(`stripped ${strippedKeys} duplicate keys from ${filesTouched} files`);
