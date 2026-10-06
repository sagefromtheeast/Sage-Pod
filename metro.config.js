// SCREENSHOT HARNESS: web-only resolver shims; native bundles are unaffected.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// 1. expo-sqlite web ships wa-sqlite.wasm, which Metro must treat as an asset.
config.resolver.assetExts.push('wasm');

// 2. On web, swap expo-sqlite for a shim whose openDatabaseSync is async under the hood.
const shimDir = path.resolve(__dirname, 'shots-tool/shims');
const appDirs = [path.resolve(__dirname, 'app') + path.sep, path.resolve(__dirname, 'src') + path.sep];
const webShims = {
  'expo-sqlite': 'expo-sqlite.web.js',
  'expo-network': 'expo-network.web.js',
  'react-native-web/dist/exports/AccessibilityInfo': 'AccessibilityInfo.web.js',
  'react-native-web/dist/cjs/exports/AccessibilityInfo': 'AccessibilityInfo.web.js',
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromApp = appDirs.some((d) => context.originModulePath.startsWith(d));
  if (platform === 'web' && fromApp && webShims[moduleName]) {
    return { type: 'sourceFile', filePath: path.join(shimDir, webShims[moduleName]) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// (No COOP/COEP headers needed: with the shim nothing calls the SharedArrayBuffer-based sync path.)
module.exports = config;
