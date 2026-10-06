// WEB SCREENSHOT SHIM: react-native-web's AccessibilityInfo lacks the iOS-only
// isReduceTransparencyEnabled() that src/ui/glass/useGlassCapability.ts calls.
// (babel-plugin-react-native-web rewrites `import { AccessibilityInfo } from
// 'react-native'` to this deep import, so that's what we intercept.)
const mod = require('react-native-web/dist/exports/AccessibilityInfo');
const A11y = mod.default ?? mod;
if (typeof A11y.isReduceTransparencyEnabled !== 'function') {
  A11y.isReduceTransparencyEnabled = () => Promise.resolve(false);
}
module.exports = mod;
