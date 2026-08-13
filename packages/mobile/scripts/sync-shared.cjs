/**
 * Sync shared logic from the desktop app into the mobile app.
 * Run from repo root or mobile/: `node mobile/scripts/sync-shared.cjs`
 *
 * - electron/secure/registry.cjs  -> mobile/src/api/registry.generated.ts
 * - src/auth/permissions.ts       -> mobile/src/auth/permissions.ts (imports rewritten)
 * - src/layout/navItems.ts        -> mobile/src/navigation/navItems.ts (imports rewritten)
 * - callerResponsibility/constants.ts -> mobile/src/auth/callerRoles.ts
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MOBILE = path.resolve(__dirname, '..');

function write(rel, content) {
  const dest = path.join(MOBILE, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  console.log('wrote', rel);
}

// 1) Registry
const registry = require(path.join(ROOT, 'packages/desktop/electron/secure/registry.cjs'));
const entries = Object.entries(registry)
  .map(([name, def]) => `  '${name}': ${JSON.stringify(def)},`)
  .join('\n');
write(
  'src/api/registry.generated.ts',
  `/* AUTO-GENERATED from electron/secure/registry.cjs — do not edit. Run mobile/scripts/sync-shared.cjs */
export type RegistryEntry = {
  method?: string;
  path?: string;
  /** 'local' entries are Electron-only (desktop dialler etc.) and unsupported on mobile. */
  type?: string;
  encryptRequest?: boolean;
  decryptResponse?: boolean;
  keepDataEnvelope?: boolean;
  [key: string]: unknown;
};

export const REGISTRY: Record<string, RegistryEntry> = {
${entries}
};

export type SecureAction = keyof typeof REGISTRY;
`,
);

// 2) Caller role constants
const caller = fs.readFileSync(
  path.join(ROOT, 'packages/desktop/src/screens/panel/callerResponsibility/constants.ts'),
  'utf8',
);
write(
  'src/auth/callerRoles.ts',
  `/* AUTO-GENERATED from src/screens/panel/callerResponsibility/constants.ts — do not edit. */\n${caller}`,
);

// 3) permissions.ts (rewrite imports to mobile equivalents)
let perms = fs.readFileSync(path.join(ROOT, 'packages/desktop/src/auth/permissions.ts'), 'utf8');
perms = perms
  .replace(
    "import { getStoredUser } from '@/utils/dates';",
    "import { getStoredUser } from '../lib/webShim';",
  )
  .replace(
    "import type { AuthUser } from '@/types/gcalc';",
    "import type { AuthUser } from '../types/auth';",
  )
  .replace(
    /from '@\/screens\/panel\/callerResponsibility\/constants';/,
    "from './callerRoles';",
  );
write(
  'src/auth/permissions.ts',
  `/* AUTO-GENERATED from src/auth/permissions.ts — do not edit. Run mobile/scripts/sync-shared.cjs */\n${perms}`,
);

// 4) navItems.ts
let nav = fs.readFileSync(path.join(ROOT, 'packages/desktop/src/layout/navItems.ts'), 'utf8');
nav = nav
  .replace(
    "import { Permissions, type Permission } from '@/auth/permissions';",
    "import { Permissions, type Permission } from '../auth/permissions';",
  )
  .replace(
    'import { Permissions, type Permission } from "@/auth/permissions";',
    "import { Permissions, type Permission } from '../auth/permissions';",
  );
write(
  'src/navigation/navItems.ts',
  `/* AUTO-GENERATED from src/layout/navItems.ts — do not edit. Run mobile/scripts/sync-shared.cjs */\n${nav}`,
);

console.log('sync complete');
