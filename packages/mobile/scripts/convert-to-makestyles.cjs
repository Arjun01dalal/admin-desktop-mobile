#!/usr/bin/env node
/** Convert leftover StyleSheet.create style modules to makeStyles. */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COMMON = path.join(ROOT, 'src', 'styles', 'common.ts');

function relImport(fromFile, toAbs) {
  const rel = path.relative(path.dirname(fromFile), toAbs);
  const posix = rel.split(path.sep).join('/');
  const noExt = posix.replace(/\.ts$/, '');
  return noExt.startsWith('.') ? noExt : `./${noExt}`;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.styles.ts') && p !== COMMON) out.push(p);
  }
  return out;
}

let n = 0;
for (const file of walk(path.join(ROOT, 'src'))) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('export const styles = StyleSheet.create(')) continue;

  const commonImport = `import { makeStyles } from '${relImport(file, COMMON)}';`;
  src = src.replace('export const styles = StyleSheet.create(', 'export const styles = makeStyles(');

  if (!/import \{ makeStyles \}/.test(src)) {
    const firstImport = src.search(/^import /m);
    if (firstImport >= 0) {
      src = src.slice(0, firstImport) + commonImport + '\n' + src.slice(firstImport);
    } else {
      src = commonImport + '\n' + src;
    }
  }

  if (!/\bStyleSheet\s*\./.test(src.replace(/^import .*StyleSheet.*$/m, ''))) {
    src = src.replace(/^import \{ StyleSheet \} from 'react-native';\n/m, '');
    src = src.replace(/^import \{ ([^}]*), StyleSheet \} from 'react-native';$/m, "import { $1 } from 'react-native';");
    src = src.replace(/^import \{ StyleSheet, ([^}]*) \} from 'react-native';$/m, "import { $1 } from 'react-native';");
  }

  fs.writeFileSync(file, src);
  n++;
}
console.log(`converted ${n} files to makeStyles`);
