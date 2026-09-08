#!/usr/bin/env node
/**
 * Codemod: move a screen's `const styles = makeStyles({...})` block out of the
 * component file into a co-located `<Screen>.styles.ts`.
 *
 * Rendering logic and styling then live in separate modules, which is the point
 * of the split — the component file keeps only JSX + behaviour. The style object
 * is moved verbatim, so output cannot change.
 *
 * Usage:
 *   node scripts/codemod-extract-styles.cjs --dry <file ...>
 *   node scripts/codemod-extract-styles.cjs <file ...>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** Index of the matching `}` for the `{` at `open`, skipping strings/comments. */
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

function relImport(fromFile, toAbs) {
  const rel = path.relative(path.dirname(fromFile), toAbs);
  const posix = rel.split(path.sep).join('/');
  return posix.startsWith('.') ? posix : `./${posix}`;
}

function transform(file, dry) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /^const styles = (makeStyles|StyleSheet\.create)\(\s*\{/m;
  const m = re.exec(src);
  if (!m) return { file, skipped: 'no `const styles` sheet' };

  const braceOpen = src.indexOf('{', m.index + m[0].length - 1);
  const braceClose = matchBrace(src, braceOpen);
  if (braceClose < 0) return { file, skipped: 'unbalanced braces' };

  // Consume the trailing `);` and newline.
  let blockEnd = braceClose + 1;
  while (blockEnd < src.length && /[\s)]/.test(src[blockEnd])) {
    if (src[blockEnd] === '\n') {
      blockEnd++;
      break;
    }
    blockEnd++;
  }
  if (src[blockEnd - 1] !== '\n') blockEnd = src.indexOf('\n', braceClose) + 1;

  const block = src.slice(m.index, blockEnd).trimEnd();
  const helper = m[1];

  // Only import the theme tokens the block actually references.
  const tokens = ['colors', 'radius', 'spacing'].filter((t) =>
    new RegExp(`\\b${t}\\b`).test(block),
  );

  const stylesFile = file.replace(/\.tsx?$/, '.styles.ts');
  const screenName = path.basename(file).replace(/\.tsx?$/, '');
  const header = [
    `/** Styles for ${screenName} — shared presets from styles/common plus screen-specific keys. */`,
  ];
  // The block itself may still reference StyleSheet (absoluteFillObject, hairlineWidth).
  if (helper === 'StyleSheet.create' || /\bStyleSheet\s*\./.test(block)) {
    header.push(`import { StyleSheet } from 'react-native';`);
  }
  if (helper === 'makeStyles') {
    header.push(
      `import { makeStyles } from '${relImport(stylesFile, path.join(SRC, 'styles', 'common'))}';`,
    );
  }
  if (tokens.length) {
    header.push(
      `import { ${tokens.join(', ')} } from '${relImport(stylesFile, path.join(SRC, 'theme'))}';`,
    );
  }
  const stylesContent = `${header.join('\n')}\n\nexport ${block}\n`;

  // Drop the block from the screen and import `styles` instead.
  let out = src.slice(0, m.index) + src.slice(blockEnd);
  out = out.replace(/\n{3,}$/, '\n');
  const anchor = /^import[\s\S]*?from ['"][^'"]+['"];?$/gm;
  let lastImportEnd = -1;
  for (const im of out.matchAll(anchor)) lastImportEnd = im.index + im[0].length;
  if (lastImportEnd < 0) return { file, skipped: 'no imports to anchor after' };
  out =
    out.slice(0, lastImportEnd) +
    `\nimport { styles } from './${screenName}.styles';` +
    out.slice(lastImportEnd);

  // Remove theme/makeStyles imports that the screen no longer uses.
  if (!/\bmakeStyles\b/.test(out.replace(/^import .*makeStyles.*$/gm, ''))) {
    out = out.replace(/^import \{ makeStyles \} from '[^']*';\n/m, '');
  }
  const body = out.replace(/^import[\s\S]*?from ['"][^'"]+['"];?$/gm, '');
  const stillUsed = ['colors', 'radius', 'spacing'].filter((t) =>
    new RegExp(`\\b${t}\\b`).test(body),
  );
  if (stillUsed.length === 0) {
    out = out.replace(/^import \{ [^}]*\} from '(\.\.\/)+theme';\n/m, '');
  } else if (stillUsed.length < 3) {
    out = out.replace(
      /^(import \{ )[^}]*(\} from '(?:\.\.\/)+theme';)$/m,
      `$1${stillUsed.join(', ')}$2`,
    );
  }

  const removed = src.split('\n').length - out.split('\n').length;
  if (!dry) {
    fs.writeFileSync(stylesFile, stylesContent);
    fs.writeFileSync(file, out);
  }
  return { file, stylesFile, removed, styleLines: stylesContent.split('\n').length };
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const files = args.filter((a) => !a.startsWith('--'));
  if (!files.length) {
    console.error('usage: codemod-extract-styles.cjs [--dry] <file ...>');
    process.exit(1);
  }
  for (const f of files) {
    const abs = path.resolve(ROOT, f);
    const res = transform(abs, dry);
    const rel = path.relative(ROOT, abs);
    if (res.skipped) {
      console.log(`skip  ${rel} — ${res.skipped}`);
      continue;
    }
    console.log(
      `${dry ? 'would ' : ''}move  ${rel} — -${res.removed} lines → ${path.basename(res.stylesFile)} (${res.styleLines} lines)`,
    );
  }
}

main();
