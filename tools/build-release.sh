#!/usr/bin/env bash
# Build the static release tarball installed by the YunoHost package.
#
#   tools/build-release.sh                    # npm ci + build + tarball
#   tools/build-release.sh --skip-build       # package the existing app/dist
#   tools/build-release.sh --update-manifest  # also point manifest.toml/.json at it
#
# The archive is reproducible (sorted entries, fixed mtimes and owners,
# gzip without timestamps), so the same commit always gives the same sha256.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
build=1
update=0
for arg in "$@"; do
    case "$arg" in
        --skip-build) build=0 ;;
        --update-manifest) update=1 ;;
        *) echo "unknown option: $arg" >&2; exit 2 ;;
    esac
done

cd "$root/app"
version="$(node -p "require('./package.json').version")"
if [ "$build" = 1 ]; then
    npm ci --no-audit --no-fund
    npm run build
fi
[ -f dist/index.html ] || { echo "app/dist is missing" >&2; exit 1; }

name="openinfinite-$version"
mkdir -p "$root/release"
archive="$root/release/$name.tar.gz"
tar --format=gnu --sort=name --mtime='2024-01-01 00:00:00Z' --owner=0 --group=0 --numeric-owner \
    --mode='u+rwX,go+rX,go-w' --transform "s,^dist,$name," -cf - dist | gzip -n -9 > "$archive"

sha256="$(sha256sum "$archive" | cut -d' ' -f1)"
url="https://github.com/GZPlaz/open-infinite_ynh/releases/download/v$version/$name.tar.gz"
echo "archive: $archive ($(du -h "$archive" | cut -f1))"
echo "sha256:  $sha256"
echo "url:     $url"

if [ "$update" = 1 ]; then
    python3 "$root/tools/sync_manifest.py" set-source "$version" "$url" "$sha256"
    echo "Updated manifest.toml and manifest.json"
fi
