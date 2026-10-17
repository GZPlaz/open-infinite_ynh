#!/usr/bin/env python3
"""Keep the YunoHost manifest files in sync.

manifest.toml is what YunoHost reads (packaging v2). manifest.json is an exact
JSON mirror of it, generated here, for tools and readers that expect JSON.

  tools/sync_manifest.py json                     # regenerate manifest.json
  tools/sync_manifest.py check                    # fail if manifest.json is stale
  tools/sync_manifest.py set-source VERSION URL SHA256
"""
import json
import re
import sys
import tomllib
from pathlib import Path

PKG = Path(__file__).resolve().parent.parent / "openinfinite_ynh"
TOML = PKG / "manifest.toml"
JSON = PKG / "manifest.json"


def rendered() -> str:
    with TOML.open("rb") as f:
        data = tomllib.load(f)
    return json.dumps(data, indent=4, ensure_ascii=False) + "\n"


def set_source(version: str, url: str, sha256: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        sys.exit(f"not a sha256: {sha256}")
    text = TOML.read_text()
    text, n1 = re.subn(r'(?m)^version = "[^"]*"$', f'version = "{version}~ynh1"', text)
    text, n2 = re.subn(r'(?m)^(\s*url = )"[^"]*\.tar\.gz"$', rf'\1"{url}"', text)
    text, n3 = re.subn(r'(?m)^(\s*sha256 = )"[0-9a-f]{64}"$', rf'\1"{sha256}"', text)
    if (n1, n2, n3) != (1, 1, 1):
        sys.exit(f"manifest.toml layout not recognised (version={n1}, url={n2}, sha256={n3})")
    TOML.write_text(text)
    JSON.write_text(rendered())


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "json"
    if cmd == "json":
        JSON.write_text(rendered())
    elif cmd == "check":
        if not JSON.exists() or JSON.read_text() != rendered():
            sys.exit("manifest.json is out of date: run tools/sync_manifest.py json")
        print("manifest.json matches manifest.toml")
    elif cmd == "set-source" and len(sys.argv) == 5:
        set_source(*sys.argv[2:5])
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
