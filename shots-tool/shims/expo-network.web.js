// WEB SCREENSHOT SHIM: report a cellular connection so the startup auto-download
// pass (downloadOnWifiOnly) skips everything. expo-file-system's File/Directory
// classes are native-only, so a web "download" would otherwise throw
// "this.validatePath is not a function" and leave episodes stuck on "Downloading…".
const real = require('expo-network') // shim lives outside app/ and src/, so this resolves to the real module;
module.exports = {
  ...real,
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true, type: real.NetworkStateType.CELLULAR }),
};
