#!/usr/bin/env bash
# Construit l'APK Android et le copie dans dist/ : npm run apk
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/android-sdk}}"
if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "SDK Android introuvable dans $ANDROID_HOME (définir ANDROID_HOME)." >&2
  exit 1
fi
cd "$ROOT/android"
echo "sdk.dir=$ANDROID_HOME" > local.properties
./gradlew assembleRelease --no-daemon -q
VERSION=$(grep -o '"versionName" *: *"[^"]*"' app/build/outputs/apk/release/output-metadata.json | sed 's/.*: *"\(.*\)"/\1/')
mkdir -p "$ROOT/dist"
OUT="$ROOT/dist/generation-football-$VERSION.apk"
cp app/build/outputs/apk/release/app-release.apk "$OUT"
echo "$OUT"
