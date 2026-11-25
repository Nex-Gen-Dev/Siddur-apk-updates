#!/usr/bin/env bash
# Build + publish a new version.
# usage: SIDDUR_KEYSTORE=/path/siddur.keystore SIDDUR_KS_PASS=... ./release.sh new.html "what changed"
set -euo pipefail
HTML="$1"; NOTES="${2:-}"
: "${SIDDUR_KEYSTORE:?set SIDDUR_KEYSTORE}"; : "${SIDDUR_KS_PASS:?set SIDDUR_KS_PASS}"
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/.." && pwd)"
cur=$(python3 -c "import json;print(json.load(open('$REPO/latest.json'))['versionCode'])")
code=$((cur+1)); name="1.0.$code"
cp "$HTML" "$HERE/siddur-original.html"
cd "$HERE"
python3 -I tools/build_www.py siddur-original.html www/index.html
[ -d node_modules ] || npm install --no-audit --no-fund
npx cap sync android
echo "sdk.dir=${ANDROID_HOME:-/home/claude/android-sdk}" > android/local.properties
cd android
SIDDUR_KEY_ALIAS=siddur ./gradlew assembleRelease -PappVersionCode=$code -PappVersionName=$name --no-daemon -q
APK=app/build/outputs/apk/release/app-release.apk
rm -f "$REPO"/releases/*.apk
cp $APK "$REPO/releases/Siddur-$code.apk"; cp $APK "$REPO/Siddur.apk"
python3 - <<PY
import json
json.dump({"versionCode":$code,"versionName":"$name","apk":"https://raw.githubusercontent.com/Nex-Gen-Dev/Siddur-apk-updates/main/releases/Siddur-$code.apk","notes":"""$NOTES"""},open("$REPO/latest.json","w"),ensure_ascii=False,indent=2)
PY
echo "Built $name (code $code). Commit and push the repo to publish."
