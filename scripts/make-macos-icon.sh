#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/FreeInk.iconset
# Electron icon source is 512px. Resize it for all standard macOS icon sizes.
for size in 16 32 64 128 256 512 1024; do
  case "$size" in
    16|32|128|256|512) sips -s format png -z "$size" "$size" assets/app.png --out "assets/FreeInk.iconset/icon_${size}x${size}.png" >/dev/null;;
  esac
done
for size in 16 32 128 256 512; do
  double=$((size * 2))
  sips -s format png -z "$double" "$double" assets/app.png --out "assets/FreeInk.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns assets/FreeInk.iconset -o assets/app.icns
rm -rf assets/FreeInk.iconset
