// Monorepo-aware Metro config (npm workspaces).
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

// Force a SINGLE copy of React across the workspace. The root has React 18
// (desktop) while mobile needs React 19; without this, react-native-web
// (hoisted to root) pulls React 18 and crashes with
// "Objects are not valid as a React child".
// Packages (and their subpaths, e.g. react-dom/client) that MUST resolve to
// mobile's own copy.
const forcedRoots = ['react', 'react-dom', 'react-native'];
const mobileModules = path.join(projectRoot, 'node_modules');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forced = forcedRoots.find(
    (r) => moduleName === r || moduleName.startsWith(r + '/'),
  );
  if (forced) {
    try {
      const filePath = require.resolve(moduleName, { paths: [mobileModules] });
      return { type: 'sourceFile', filePath };
    } catch {
      /* fall through to default resolver */
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
