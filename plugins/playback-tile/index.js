const { AndroidConfig, withAndroidManifest, withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Adds Sage Pod's Quick Settings tile (D-026): a TileService that plays and
 * pauses through expo-audio's media session. Kept in the repo as source so
 * prebuild regenerates it; see PlaybackTileService.kt.
 */
const SERVICE = '.PlaybackTileService';
// Matches the Media3 version expo-audio builds against; Gradle picks the higher if they differ.
const MEDIA3_SESSION = 'androidx.media3:media3-session:1.9.0';

function withTileSource(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('playback-tile: android.package is required');
      const root = cfg.modRequest.platformProjectRoot;
      const javaDir = path.join(root, 'app/src/main/java', ...pkg.split('.'));
      const source = fs.readFileSync(path.join(__dirname, 'PlaybackTileService.kt'), 'utf8');
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(path.join(javaDir, 'PlaybackTileService.kt'), source.replace('__PACKAGE__', pkg));
      const drawableDir = path.join(root, 'app/src/main/res/drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'ic_tile_playback.xml'), path.join(drawableDir, 'ic_tile_playback.xml'));
      return cfg;
    },
  ]);
}

function withTileManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE);
    app.service.push({
      $: {
        'android:name': SERVICE,
        'android:exported': 'true',
        'android:label': 'Sage Pod',
        'android:icon': '@drawable/ic_tile_playback',
        'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
      },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }] }],
      'meta-data': [
        { $: { 'android:name': 'android.service.quicksettings.TOGGLEABLE_TILE', 'android:value': 'true' } },
      ],
    });
    return cfg;
  });
}

function withTileDependency(config) {
  return withAppBuildGradle(config, (cfg) => {
    const line = `    implementation("${MEDIA3_SESSION}")`;
    if (!cfg.modResults.contents.includes(MEDIA3_SESSION)) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n    // Sage Pod: Quick Settings tile (plugins/playback-tile)\n${line}`
      );
    }
    return cfg;
  });
}

module.exports = function withPlaybackTile(config) {
  return withTileDependency(withTileManifest(withTileSource(config)));
};
