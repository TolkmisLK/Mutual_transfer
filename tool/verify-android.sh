#!/usr/bin/env bash
set -euo pipefail
gradle --no-daemon -p android connectedDebugAndroidTest
adb pull /data/local/tmp/mutual-transfer-startup.png android/client-startup.png
node tool/android-fixture.js &
fixture=$!
cleanup() { kill "$fixture" 2>/dev/null || true; wait "$fixture" || true; }
trap cleanup EXIT
for attempt in {1..60}; do
  kill -0 "$fixture" || exit 1
  if test -f android/app/src/androidTestAcceptance/assets/connection.json; then break; fi
  sleep 1
done
test -f android/app/src/androidTestAcceptance/assets/connection.json
adb reverse tcp:10878 tcp:10878
gradle --no-daemon -p android -PacceptanceTests connectedAcceptanceAndroidTest
adb pull /data/local/tmp/mutual-transfer-https.png android/client-https.png
