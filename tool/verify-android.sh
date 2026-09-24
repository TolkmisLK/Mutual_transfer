#!/usr/bin/env bash
set -euo pipefail
# The emulator is still alive here. Preserve Gradle's failure; report only a
# strict source-frame/exception allowlist, never raw logcat or test secrets.
trap 'result=$?; if (( result != 0 )); then node tool/android-diagnostics.js; fi; exit "$result"' EXIT
# Each reliability round must execute instrumentation, not reuse task outputs.
gradle --no-daemon -p android connectedDebugAndroidTest --rerun-tasks
adb pull /data/local/tmp/mutual-transfer-startup.png android/client-startup.png
node tool/android-fixture.js &
fixture=$!
cleanup() { result=$?; if (( result != 0 )); then node tool/android-diagnostics.js; fi; kill "$fixture" 2>/dev/null || true; wait "$fixture" || true; exit "$result"; }
trap cleanup EXIT
for attempt in {1..60}; do
  kill -0 "$fixture" || exit 1
  if test -f android/app/src/androidTestAcceptance/assets/connection.json; then break; fi
  sleep 1
done
test -f android/app/src/androidTestAcceptance/assets/connection.json
adb reverse tcp:10878 tcp:10878
gradle --no-daemon -p android -PacceptanceTests connectedAcceptanceAndroidTest --rerun-tasks
adb pull /data/local/tmp/mutual-transfer-https.png android/client-https.png
# Provider callbacks can crash after the instrumentation assertions pass.
# Keep this disposable emulator's cumulative crash buffer across rounds so a
# late callback between rounds cannot be erased by the next round's setup.
node tool/android-diagnostics.js --check
