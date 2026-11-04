#!/usr/bin/env bash
# Stable `expo run:android` helper.
# Wireless debugging often leaves stale mDNS serials (adb-XXXX) that Expo
# tries to use. We reconnect via IP:port, drop mDNS aliases, then pass Expo
# the device *name* (model), which is what `--device` expects.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ADB="${ADB:-$(command -v adb || true)}"
if [[ -z "${ADB}" && -x "${HOME}/Library/Android/sdk/platform-tools/adb" ]]; then
  ADB="${HOME}/Library/Android/sdk/platform-tools/adb"
fi
if [[ -z "${ADB}" ]]; then
  echo "adb not found. Install Android platform-tools or put adb on PATH." >&2
  exit 1
fi

is_online() {
  local serial="$1"
  [[ -n "$serial" ]] || return 1
  "$ADB" -s "$serial" get-state 2>/dev/null | grep -qx device
}

list_online_serials() {
  "$ADB" devices 2>/dev/null | awk 'NR>1 && $2=="device"{print $1}'
}

# Prefer USB / IP:port over flaky `adb-XXXX._adb-tls-connect._tcp` names.
pick_serial() {
  local preferred="" mdns=""
  while IFS= read -r s; do
    [[ -n "$s" ]] || continue
    if [[ "$s" == *._adb-tls-connect._tcp ]]; then
      mdns="${mdns:-$s}"
      continue
    fi
    preferred="$s"
    break
  done < <(list_online_serials)
  echo "${preferred:-$mdns}"
}

# Expo `--device` matches `device.name` from its device list:
#   - emulator → AVD name (`adb -s <serial> emu avd name`)
#   - physical → `model:` from `adb devices -l` (underscored)
# Passing the emulator *model* (e.g. sdk_gphone64_arm64) fails with
# "Could not find device with name: …".
device_expo_name() {
  local serial="$1"
  local name=""

  if [[ "$serial" == emulator-* ]]; then
    # First line is the AVD name; a trailing "OK" line is common.
    name="$("$ADB" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | awk 'NF && $0!="OK"{print; exit}')"
    if [[ -n "$name" ]]; then
      printf '%s\n' "$name"
      return
    fi
  fi

  name="$("$ADB" devices -l 2>/dev/null \
    | awk -v s="$serial" '
        $1==s {
          for (i = 1; i <= NF; i++) {
            if ($i ~ /^model:/) {
              sub(/^model:/, "", $i)
              print $i
              exit
            }
          }
        }')"
  if [[ -n "$name" ]]; then
    printf '%s\n' "$name"
    return
  fi

  printf 'Device %s\n' "$serial"
}

# Reconnect wireless devices via IP:port from mDNS discovery, then drop mDNS aliases.
stabilize_wireless() {
  local hostport ip port
  while IFS=$'\t' read -r _name _svc hostport; do
    [[ -n "$hostport" ]] || continue
    ip="${hostport%%:*}"
    port="${hostport##*:}"
    [[ "$ip" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || continue
    [[ "$port" =~ ^[0-9]+$ ]] || continue
    "$ADB" connect "${ip}:${port}" >/dev/null 2>&1 || true
  done < <("$ADB" mdns services 2>/dev/null | awk 'NR>1 && NF>=3 {print $1"\t"$2"\t"$3}')

  while IFS= read -r s; do
    if [[ "$s" == *._adb-tls-connect._tcp ]]; then
      "$ADB" disconnect "$s" >/dev/null 2>&1 || true
    fi
  done < <(list_online_serials)
}

SERIAL="${ANDROID_SERIAL:-}"
if ! is_online "$SERIAL"; then
  SERIAL="$(pick_serial)"
fi

# Always try to convert mDNS → IP:port before Expo runs.
if [[ -z "$SERIAL" || "$SERIAL" == *._adb-tls-connect._tcp ]] || ! is_online "$SERIAL"; then
  echo "Stabilizing Android ADB connection…"
  stabilize_wireless
  sleep 1
  SERIAL="$(pick_serial)"
fi

if ! is_online "$SERIAL"; then
  echo "No Android device found." >&2
  echo "Fix:" >&2
  echo "  1) USB: enable USB debugging and authorize this Mac" >&2
  echo "  2) Wireless: Developer options → Wireless debugging → note IP:port, then:" >&2
  echo "       adb connect <PHONE_IP>:<PORT>" >&2
  echo "  3) Check: adb devices -l" >&2
  exit 1
fi

# Final cleanup: never leave Expo with only an mDNS serial.
if [[ "$SERIAL" == *._adb-tls-connect._tcp ]]; then
  stabilize_wireless
  sleep 1
  SERIAL="$(pick_serial)"
fi

if ! is_online "$SERIAL"; then
  echo "Device dropped while stabilizing ADB connection." >&2
  "$ADB" devices -l >&2 || true
  exit 1
fi

DEVICE_NAME="$(device_expo_name "$SERIAL")"

# Prove shell works on the chosen serial before Expo starts.
"$ADB" -s "$SERIAL" shell getprop ro.product.cpu.abilist >/dev/null

echo "Using Android device: ${DEVICE_NAME} (${SERIAL})"

mkdir -p .metro-tmp
export TMPDIR="$ROOT/.metro-tmp"
# Expo --device matches Expo's device.name (AVD name / model), not ADB serial.
# Keep ANDROID_SERIAL so plain `adb` calls hit the same device.
export ANDROID_SERIAL="$SERIAL"

exec npx expo run:android --device "$DEVICE_NAME" "$@"
