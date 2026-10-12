/**
 * The OTA runtime version is a fingerprint of the native project. The release
 * stamps `expo.version`, `android.versionCode` and `ios.buildNumber` into
 * app.json on every release (tool/set_app_version.sh); without this skip each
 * release would change the runtime, and updates would never reach installed
 * builds. Native changes (dependencies, plugins, other config) still do.
 */
const { SourceSkips } = require('@expo/fingerprint');

/** @type {import('@expo/fingerprint').Config} */
module.exports = { sourceSkips: SourceSkips.ExpoConfigVersions };
