// WEB SCREENSHOT SHIM. expo-sqlite's web openDatabaseSync() busy-waits on the
// main thread for a Web Worker that can't start until the main thread yields,
// so the very first sync open always throws "Sync operation timeout".
// Sage Pod only ever uses async methods on the handle, so hand back a proxy
// whose methods await a real openDatabaseAsync() connection instead.
// eslint-disable-next-line import/no-unresolved
const real = require('expo-sqlite/build/index.js');
module.exports = { ...real };
module.exports.openDatabaseSync = function openDatabaseSyncShim(name, options, dir) {
  const ready = real.openDatabaseAsync(name, options, dir);
  const proxy = new Proxy({ databasePath: name }, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'then') return undefined; // not a thenable
      return async (...args) => {
        const db = await ready;
        return db[key](...args);
      };
    },
  });
  // Handle for the screenshot harness to seed demo data via page.evaluate().
  (globalThis.__SQLITE_DBS__ ??= {})[name] = proxy;
  return proxy;
};
