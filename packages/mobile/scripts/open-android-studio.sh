#!/usr/bin/env bash
# Open Android Studio with nvm's node on PATH (GUI launches usually omit it).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
fi

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "node not found. Install Node or fix nvm, then retry." >&2
  exit 1
fi

# Ensure Gradle / Expo plugins can resolve `node` even if the IDE strips PATH later.
NODE_DIR="$(dirname "$NODE_BIN")"
export PATH="$NODE_DIR:/usr/local/bin:/opt/homebrew/bin:$PATH"
export NODE_BINARY="$NODE_BIN"

# Keep local.properties in sync so Gradle can find node even if PATH is stripped later.
LOCAL_PROPS="$ANDROID_DIR/local.properties"
touch "$LOCAL_PROPS"
if grep -q '^node.executable=' "$LOCAL_PROPS"; then
  sed -i.bak "s|^node.executable=.*|node.executable=$NODE_BIN|" "$LOCAL_PROPS"
  rm -f "$LOCAL_PROPS.bak"
else
  echo "node.executable=$NODE_BIN" >> "$LOCAL_PROPS"
fi

# Refresh system-visible shims (macOS GUI PATH includes these via /etc/paths*).
for shim_dir in /opt/homebrew/bin /usr/local/bin; do
  if [[ -w "$shim_dir" ]]; then
    ln -sfn "$NODE_BIN" "$shim_dir/node"
  fi
done

# Pin Gradle to JDK 17 — AS embedded JBR 25 breaks Prefab/CMake (reanimated "restricted method").
JAVA17_HOME="${JAVA17_HOME:-/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home}"
if [[ -x "$JAVA17_HOME/bin/java" ]]; then
  export JAVA_HOME="$JAVA17_HOME"
  export PATH="$JAVA_HOME/bin:$PATH"
  GRADLE_XML="$ANDROID_DIR/.idea/gradle.xml"
  if [[ -f "$GRADLE_XML" ]]; then
    if grep -q 'name="gradleJvm"' "$GRADLE_XML"; then
      sed -i.bak "s|name=\"gradleJvm\" value=\"[^\"]*\"|name=\"gradleJvm\" value=\"$JAVA17_HOME\"|" "$GRADLE_XML"
      rm -f "$GRADLE_XML.bak"
    fi
  fi
else
  echo "Warning: JDK 17 not found at $JAVA17_HOME (Gradle may fail Prefab/CMake on newer JDKs)." >&2
fi

# Drop stale daemons that may have been started without node / with the wrong JDK.
if [[ -x "$ANDROID_DIR/gradlew" ]]; then
  (cd "$ANDROID_DIR" && ./gradlew --stop >/dev/null 2>&1) || true
fi

echo "Using node: $NODE_BIN ($("$NODE_BIN" -v))"
echo "Using JAVA_HOME: ${JAVA_HOME:-"(unset)"}"
echo "Opening Android Studio → $ANDROID_DIR"

# Run the IDE binary from this shell so PATH / NODE_BINARY are inherited.
# `open -a` goes through LaunchServices and drops the shell PATH (that's the bug).
STUDIO_BIN="/Applications/Android Studio.app/Contents/MacOS/studio"
if [[ -x "$STUDIO_BIN" ]]; then
  exec "$STUDIO_BIN" "$ANDROID_DIR"
elif command -v studio >/dev/null 2>&1; then
  exec studio "$ANDROID_DIR"
else
  echo "Android Studio not found at: $STUDIO_BIN" >&2
  exit 1
fi
