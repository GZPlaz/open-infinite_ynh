#!/usr/bin/env bash
# `cond && ok || ko` is intended below: ok() always succeeds.
# shellcheck disable=SC2015,SC2012
# Serve the built app through the package's conf/nginx.conf with a real nginx
# and check the behaviour YunoHost relies on. Mirrors the template handling of
# ynh_config_add_nginx: __PATH__/, __PATH__, __INSTALL_DIR__ and #sub_path_only.
#
#   tools/test-nginx.sh [/path]        (default /openinfinite; also try /)
#
# Needs nginx with the headers-more, sub and gzip_static modules (Debian:
# nginx + libnginx-mod-http-headers-more-filter) and a built app/dist.
set -euo pipefail

app_path="${1:-/openinfinite}"
root="$(cd "$(dirname "$0")/.." && pwd)"
dist="$root/app/dist"
[ -f "$dist/index.html" ] || { echo "Build the app first: (cd app && npm run build)" >&2; exit 2; }

work="$(mktemp -d)"
port="${PORT:-8099}"
cleanup() {
    [ -f "$work/nginx.pid" ] && kill "$(cat "$work/nginx.pid")" 2>/dev/null || true
    rm -rf "$work"
}
trap cleanup EXIT

install_dir="$work/www"
cp -r "$dist" "$install_dir"
sed "s/__DEFAULT_PAPER__/a4/" "$root/conf/config.json" > "$install_dir/config.json"
# Same ownership model as scripts/_common.sh (app user + www-data group, nothing for others)
chmod 755 "$work"
if [ "$(id -u)" = 0 ] && getent group www-data >/dev/null; then
    chown -R root:www-data "$install_dir"
    find "$install_dir" -type d -exec chmod 750 {} +
    find "$install_dir" -type f -exec chmod 640 {} +
    user_directive="user www-data;"
else
    chmod -R a+rX "$install_dir"
    user_directive=""
fi

slashless="${app_path%/}"
sed -e "s|__PATH__/|$slashless/|g" -e "s|__PATH__|$app_path|g" -e "s|__INSTALL_DIR__|$install_dir|g" \
    "$root/conf/nginx.conf" > "$work/app.conf"
if [ "$app_path" != "/" ]; then
    sed -i 's/^#sub_path_only//' "$work/app.conf"
else
    sed -i 's/^#root_path_only//' "$work/app.conf"
fi

module=""
for m in /usr/lib/nginx/modules/ngx_http_headers_more_filter_module.so /usr/share/nginx/modules/ngx_http_headers_more_filter_module.so; do
    [ -f "$m" ] && module="load_module $m;" && break
done

cat > "$work/nginx.conf" <<CONF
$module
$user_directive
pid $work/nginx.pid;
error_log $work/error.log warn;
events {}
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    access_log off;
    client_body_temp_path $work/tmp;
    proxy_temp_path $work/tmp;
    fastcgi_temp_path $work/tmp;
    uwsgi_temp_path $work/tmp;
    scgi_temp_path $work/tmp;
    gzip on;
    server {
        listen 127.0.0.1:$port;
        server_name localhost;
        include $work/app.conf;
    }
}
CONF
mkdir -p "$work/tmp"
nginx -t -p "$work" -c "$work/nginx.conf"
nginx -p "$work" -c "$work/nginx.conf"
sleep 0.3

base="http://127.0.0.1:$port$slashless"
fail=0
ok() { echo "  ✓ $1"; }
ko() { echo "  ✗ $1"; fail=1; }
header() { grep -i "^$2:" <<<"$1" | head -1 | cut -d' ' -f2- | tr -d '\r'; }

if [ "$app_path" != "/" ]; then
    h="$(curl -sI "$base")"
    [[ "$h" == *" 301 "* && "$(header "$h" Location)" == *"$slashless/" ]] && ok "$slashless redirects to $slashless/" || ko "missing trailing-slash redirect"
fi

body="$(curl -s "$base/")"
h="$(curl -sI "$base/")"
grep -q "<base href=\"$slashless/\">" <<<"$body" && ok "index.html gets <base href=\"$slashless/\">" || ko "base tag not injected"
[[ "$(header "$h" Cache-Control)" == "no-cache" ]] && ok "index.html is revalidated (no-cache)" || ko "index.html Cache-Control: $(header "$h" Cache-Control)"

deep="$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "$base/some/deep/route")"
deepbody="$(curl -s "$base/some/deep/route")"
[[ "$deep" == "200 text/html"* ]] && grep -q "<base href=\"$slashless/\">" <<<"$deepbody" && ok "deep links fall back to the app shell" || ko "deep link: $deep"

js="$(cd "$install_dir" && ls assets/index-*.js | head -1)"
h="$(curl -sI -H 'Accept-Encoding: gzip' "$base/$js")"
[[ "$h" == *" 200 "* ]] && ok "bundle served ($js)" || ko "bundle not served"
[[ "$(header "$h" Content-Encoding)" == "gzip" ]] && ok "pre-compressed .gz served (gzip_static)" || ko "no gzip_static"
[[ "$(header "$h" Cache-Control)" == *immutable* ]] && ok "bundle cached long-term (immutable)" || ko "bundle Cache-Control: $(header "$h" Cache-Control)"
[[ "$(header "$h" Content-Type)" == *javascript* ]] && ok "bundle has a JavaScript MIME type" || ko "bundle type: $(header "$h" Content-Type)"
size_gz="$(curl -s -H 'Accept-Encoding: gzip' "$base/$js" | wc -c)"
size_raw="$(curl -s "$base/$js" | wc -c)"
[ "$size_gz" -lt "$size_raw" ] && ok "gzip saves $(( (size_raw - size_gz) / 1024 )) KB on the main bundle" || ko "gzip not smaller"

font="$(cd "$install_dir" && ls assets/KaTeX_Main-Regular-*.woff2 | head -1)"
[[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/$font")" == 200 ]] && ok "KaTeX fonts served" || ko "font missing"
[[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/assets/does-not-exist.js")" == 404 ]] && ok "missing assets are 404 (not the app shell)" || ko "missing asset not 404"

h="$(curl -sI "$base/sw.js")"
[[ "$h" == *" 200 "* && "$(header "$h" Cache-Control)" == "no-cache" ]] && ok "service worker served and revalidated" || ko "sw.js"
[[ "$(curl -s "$base/config.json")" == *'"defaultPaper": "a4"'* ]] && ok "config.json carries the default paper setting" || ko "config.json"

if [ "${KEEP_RUNNING:-0}" = 1 ]; then
    echo "Serving at $base/ — press Ctrl+C to stop"
    while kill -0 "$(cat "$work/nginx.pid")" 2>/dev/null; do sleep 1; done
fi
[ "$fail" = 0 ] && echo "nginx checks passed for path '$app_path'" || { echo "nginx checks FAILED for path '$app_path'"; cat "$work/error.log"; exit 1; }
