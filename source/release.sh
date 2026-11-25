#!/usr/bin/env bash
# Build + stage a new version into the updates repo.
#
#   content update (new HTML only - no key needed, installs instantly in the app):
#       ./release.sh new.html "what changed"
#   full app update (native/icon/plugin changes - needs the signing key):
#       SIDDUR_KEYSTORE=/path/key.keystore SIDDUR_KS_PASS=... ./release.sh new.html "what changed" --apk
#
# REPO (env) = the checked-out Siddur-apk-updates repo. Commit + push it afterwards to publish.
set -euo pipefail
HTML="$1"; NOTES="${2:-}"; MODE="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="${REPO:-$(cd "$HERE/.." && pwd)}"
RAW="https://raw.githubusercontent.com/Nex-Gen-Dev/Siddur-apk-updates/main"
jget() { python3 -c "import json;d=json.load(open('$REPO/latest.json'));print(d.get('$1',$2))"; }

webv=$(( $(jget webVersion 0) + 1 ))
code=$(jget versionCode 1); name=$(jget versionName '"1.0.1"')
if [ "$MODE" = "--apk" ]; then code=$((code+1)); name="1.0.$code"; fi

cd "$HERE"
cp "$HTML" "$HERE/siddur-original.html"
python3 -I tools/build_www.py siddur-original.html www/index.html "$webv"

mkdir -p "$REPO/web" "$REPO/releases"
rm -f "$REPO"/web/*.html
cp www/index.html "$REPO/web/index-$webv.html"
sha=$(sha256sum www/index.html | cut -d' ' -f1)

apk="$(jget apk '""')"
if [ "$MODE" = "--apk" ]; then
  : "${SIDDUR_KEYSTORE:?set SIDDUR_KEYSTORE}"; : "${SIDDUR_KS_PASS:?set SIDDUR_KS_PASS}"
  [ -d node_modules ] || npm install --no-audit --no-fund
  npx cap sync android
  echo "sdk.dir=${ANDROID_HOME:-/home/claude/android-sdk}" > android/local.properties
  (cd android && SIDDUR_KEY_ALIAS=siddur ./gradlew assembleRelease -PappVersionCode=$code -PappVersionName=$name --no-daemon -q)
  rm -f "$REPO"/releases/*.apk
  cp android/app/build/outputs/apk/release/app-release.apk "$REPO/releases/Siddur-$code.apk"
  cp android/app/build/outputs/apk/release/app-release.apk "$REPO/Siddur.apk"
  apk="$RAW/releases/Siddur-$code.apk"
fi

python3 - <<PY
import json
json.dump({
 "versionCode": $code, "versionName": "$name", "apk": "$apk",
 "webVersion": $webv, "webUrl": "$RAW/web/index-$webv.html", "webSha256": "$sha",
 "notes": """$NOTES"""
}, open("$REPO/latest.json","w"), ensure_ascii=False, indent=2)
PY
echo "Staged content v$webv, app $name (code $code). Commit + push $REPO to publish."
