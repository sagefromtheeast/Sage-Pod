#!/usr/bin/env bash
# Stamp a semantic-release version into the project's app-version file.
#
# Invoked by @semantic-release/exec during each release (prepareCmd) so the app
# version, the git tag, the GitHub Release and the CHANGELOG all carry the same
# number. Every file this touches is listed in @semantic-release/git's `assets`,
# so the changes are committed as part of the `chore(release): X.Y.Z` commit.
#
#   tool/set_app_version.sh 1.16.0
#
# Detection is first-match-wins, most specific first:
#   1. pubspec.yaml  (Flutter/Dart) -> version: 1.16.0+11600
#   2. app.json      (Expo)         -> expo.version + versionCode/buildNumber,
#                                      and package.json alongside it
#   3. package.json  (plain Node)   -> "version": "1.16.0"
#   4. VERSION       (anything)     -> 1.16.0
#
# The Expo case comes before the plain-Node case deliberately: in an Expo repo
# `app.json` is the version the stores and users see, while `package.json` is
# just the npm manifest. Stamping only package.json would leave the shipped app
# version frozen while tags marched on — the classic version drift.
set -euo pipefail

version="${1:?usage: set_app_version.sh <X.Y.Z[-pre][+build]>}"

# Numeric core (drop any -prerelease / +build suffix) drives the build code.
core="${version%%[-+]*}"
IFS='.' read -r major minor patch <<< "$core"
# Monotonic integer for Android versionCode / iOS CFBundleVersion.
# NOTE: caps minor and patch at 99 each — fine for normal semver.
build=$(( 10#${major:-0} * 10000 + 10#${minor:-0} * 100 + 10#${patch:-0} ))

# Rewrites package.json's "version" in place, preferring npm so the lockfile
# stays in step. Used by both the Expo and plain-Node branches.
stamp_package_json() {
  if command -v npm >/dev/null 2>&1; then
    npm version "$version" --no-git-tag-version --allow-same-version >/dev/null
  else
    sed -i -E "s/(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")/\1${version}\2/" package.json
  fi
}

if [[ -f pubspec.yaml ]]; then
  # Flutter: keep the full semver string, append the numeric build code.
  sed -i -E "s/^version: .*/version: ${version}+${build}/" pubspec.yaml
  echo "pubspec.yaml -> version: ${version}+${build}"

elif [[ -f app.json ]] && grep -q '"expo"' app.json; then
  # Expo: app.json holds the user-facing version plus the per-platform build
  # numbers that App Store Connect and Google Play require to strictly increase.
  # Edited with node rather than sed so the JSON cannot be corrupted.
  node -e '
    const fs = require("fs");
    const [version, build] = [process.argv[1], Number(process.argv[2])];
    const config = JSON.parse(fs.readFileSync("app.json", "utf8"));

    config.expo ??= {};
    config.expo.version = version;
    (config.expo.android ??= {}).versionCode = build;
    // iOS CFBundleVersion is a string, unlike Android versionCode.
    (config.expo.ios ??= {}).buildNumber = String(build);

    fs.writeFileSync("app.json", JSON.stringify(config, null, 2) + "\n");
  ' "$version" "$build"
  echo "app.json -> expo.version: ${version}, versionCode/buildNumber: ${build}"

  # Keep the npm manifest in step so `npm pkg get version` never disagrees.
  if [[ -f package.json ]] && grep -q '"version"' package.json; then
    stamp_package_json
    echo "package.json -> ${version}"
  fi

elif [[ -f app.config.js || -f app.config.ts ]]; then
  # An Expo config written as code cannot be stamped by find-and-replace. Fail
  # loudly rather than silently releasing with a frozen app version.
  echo "set_app_version: found app.config.js/ts but no app.json." >&2
  echo "  Expo config-as-code cannot be stamped automatically. Either move the" >&2
  echo "  static fields into app.json, or read the version from package.json" >&2
  echo "  inside app.config.js and delete this branch." >&2
  exit 1

elif [[ -f package.json ]] && grep -q '"version"' package.json; then
  # Plain Node app: package.json IS the app version.
  stamp_package_json
  echo "package.json -> ${version}"

elif [[ -f VERSION ]]; then
  printf '%s\n' "$version" > VERSION
  echo "VERSION -> ${version}"

else
  echo "set_app_version: no version file found (pubspec.yaml, app.json, package.json, VERSION)" >&2
  exit 1
fi
