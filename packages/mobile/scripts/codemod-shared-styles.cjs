#!/usr/bin/env node
/**
 * Codemod: adopt `src/styles/common.ts` presets in screen style sheets.
 *
 * For each target file it rewrites `const styles = StyleSheet.create({...})` to
 * `makeStyles({...})` and drops only those keys whose declaration is *exactly*
 * equivalent to the shared preset (whitespace/comment-insensitive compare).
 * Keys that differ in any way are left in place as local overrides, so the
 * rendered output cannot change.
 *
 * Usage:
 *   node scripts/codemod-shared-styles.cjs --dry [file ...]
 *   node scripts/codemod-shared-styles.cjs [file ...]
 *
 * With no file arguments it processes every .tsx/.ts under src/ that declares a
 * StyleSheet. Idempotent — already-migrated files report zero removals.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const COMMON = path.join(SRC, 'styles', 'common.ts');

// ── Source scanning helpers ────────────────────────────────────────────────────

/** Index just past the matching `}` for the `{` at `open`, skipping strings/comments. */
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

/**
 * Split an object literal body into top-level `key: value` entries.
 * Returns entries with absolute offsets so edits can be applied to the source.
 */
function parseEntries(src, bodyStart, bodyEnd) {
  const entries = [];
  let i = bodyStart;
  while (i < bodyEnd) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i) + 1;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i) + 2;
      continue;
    }
    if (/\s|,/.test(c)) {
      i++;
      continue;
    }
    const key = /^([A-Za-z_$][\w$]*)\s*:/.exec(src.slice(i, i + 80));
    if (!key) return null; // spread, computed key, etc. — bail out, hand-edit
    const keyStart = i;
    let j = i + key[0].length;
    // Walk the value to the top-level comma or the closing brace.
    let depth = 0;
    for (; j < bodyEnd; j++) {
      const d = src[j];
      if (d === '"' || d === "'" || d === '`') {
        const quote = d;
        for (j++; j < bodyEnd; j++) {
          if (src[j] === '\\') j++;
          else if (src[j] === quote) break;
        }
        continue;
      }
      if (d === '{' || d === '[' || d === '(') depth++;
      else if (d === '}' || d === ']' || d === ')') depth--;
      else if (d === ',' && depth === 0) break;
    }
    entries.push({
      name: key[1],
      value: src.slice(i + key[0].length, j),
      start: keyStart,
      end: Math.min(j + 1, bodyEnd), // include trailing comma
    });
    i = j + 1;
  }
  return entries;
}

/** Whitespace- and comment-insensitive form used to compare declarations. */
function normalize(value) {
  const flat = value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, '')
    .replace(/,$/, '');

  // Property order is not semantically meaningful in a style object, so sort the
  // top-level properties before comparing (`{color,fontSize}` == `{fontSize,color}`).
  if (!flat.startsWith('{') || !flat.endsWith('}')) return flat;
  const inner = flat.slice(1, -1);
  const props = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      for (i++; i < inner.length; i++) {
        if (inner[i] === '\\') i++;
        else if (inner[i] === quote) break;
      }
      continue;
    }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ',' && depth === 0) {
      props.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  props.push(inner.slice(start));
  // A spread would make ordering significant — leave those alone.
  if (props.some((p) => p.startsWith('...'))) return flat;
  return `{${props.filter(Boolean).sort().join(',')}}`;
}

/** Locate `<name> = StyleSheet.create({ ... })` / `makeStyles({ ... })`. */
function findSheet(src) {
  const re = /(const\s+\w+\s*=\s*)(StyleSheet\.create|makeStyles)\(\s*\{/g;
  const m = re.exec(src);
  if (!m) return null;
  const braceOpen = src.indexOf('{', m.index + m[1].length);
  const braceClose = matchBrace(src, braceOpen);
  if (braceClose < 0) return null;
  return {
    callStart: m.index + m[1].length,
    callName: m[2],
    callEnd: m.index + m[0].length,
    bodyStart: braceOpen + 1,
    bodyEnd: braceClose,
  };
}

// ── Shared presets ────────────────────────────────────────────────────────────

function loadPresets() {
  const src = fs.readFileSync(COMMON, 'utf8');
  const sheet = findSheet(src);
  const entries = parseEntries(src, sheet.bodyStart, sheet.bodyEnd);
  const map = new Map();
  for (const e of entries) map.set(e.name, normalize(e.value));
  return map;
}

// ── Per-file transform ────────────────────────────────────────────────────────

function importPathFor(file) {
  const rel = path.relative(path.dirname(file), path.join(SRC, 'styles', 'common'));
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function transform(file, presets) {
  const original = fs.readFileSync(file, 'utf8');
  if (path.resolve(file) === COMMON) return null;

  const sheet = findSheet(original);
  if (!sheet) return null;

  const entries = parseEntries(original, sheet.bodyStart, sheet.bodyEnd);
  if (!entries) return { file, skipped: 'unparseable style sheet' };

  const removable = entries.filter((e) => presets.get(e.name) === normalize(e.value));
  if (!removable.length && sheet.callName === 'makeStyles') return null;
  if (!removable.length) return { file, skipped: 'no identical presets' };

  // Splice out matched entries back-to-front so offsets stay valid.
  let out = original;
  for (const e of [...removable].reverse()) {
    let end = e.end;
    while (end < out.length && /[ \t]/.test(out[end])) end++;
    if (out[end] === '\n') end++;
    let start = e.start;
    while (start > 0 && /[ \t]/.test(out[start - 1])) start--;
    out = out.slice(0, start) + out.slice(end);
  }

  // StyleSheet.create -> makeStyles
  if (sheet.callName === 'StyleSheet.create') {
    const re = /(const\s+\w+\s*=\s*)StyleSheet\.create\(/;
    out = out.replace(re, '$1makeStyles(');
  }

  // Ensure the makeStyles import exists.
  if (!/from ['"][^'"]*styles\/common['"]/.test(out)) {
    // Insert after the (possibly multi-line) react-native import.
    const anchor = /^import[\s\S]*?from ['"]react-native['"];?$/m.exec(out);
    if (!anchor) return { file, skipped: 'no react-native import to anchor after' };
    const stmt = `\nimport { makeStyles } from '${importPathFor(file)}';`;
    const at = anchor.index + anchor[0].length;
    out = out.slice(0, at) + stmt + out.slice(at);
  }

  // Drop the now-unused StyleSheet import specifier.
  if (!/\bStyleSheet\s*\./.test(out)) {
    out = out.replace(
      /(\bimport\s*\{)([\s\S]*?)(\}\s*from\s*['"]react-native['"])/,
      (all, a, names, c) => {
        const kept = names
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s && s !== 'StyleSheet');
        if (kept.length === names.split(',').filter((s) => s.trim()).length) return all;
        const oneLine = `${a} ${kept.join(', ')} ${c}`;
        return oneLine.length <= 100 ? oneLine : `${a}\n  ${kept.join(',\n  ')},\n${c}`;
      },
    );
  }

  return {
    file,
    removed: removable.map((e) => e.name),
    linesSaved: original.split('\n').length - out.split('\n').length,
    content: out,
  };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const files = args.filter((a) => !a.startsWith('--'));
  const targets = files.length
    ? files.map((f) => path.resolve(ROOT, f))
    : walk(SRC).filter((f) => /StyleSheet\.create|makeStyles\(/.test(fs.readFileSync(f, 'utf8')));

  const presets = loadPresets();
  let totalLines = 0;
  let changed = 0;

  for (const file of targets) {
    const res = transform(file, presets);
    if (!res) continue;
    const rel = path.relative(ROOT, file);
    if (res.skipped) {
      console.log(`skip  ${rel} — ${res.skipped}`);
      continue;
    }
    changed++;
    totalLines += res.linesSaved;
    console.log(
      `${dry ? 'would ' : ''}fix   ${rel} — -${res.linesSaved} lines, ${res.removed.length} presets`,
    );
    if (!dry) fs.writeFileSync(file, res.content);
  }

  console.log(`\n${changed} files, ${totalLines} lines removed${dry ? ' (dry run)' : ''}`);
}

main();
