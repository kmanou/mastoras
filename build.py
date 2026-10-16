#!/usr/bin/env python3
"""Χτίζει το dist/mastoras.html: ένα αυτόνομο αρχείο με ενσωματωμένα CSS, JS και γραμματοσειρές.
Χρήση:  python3 build.py            (μόνο Python 3, χωρίς εξαρτήσεις)
"""
import base64, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
SRC, DIST = ROOT / "src", ROOT / "dist"
RANGES = {"greek": "U+0370-03FF,U+1F00-1FFF", "latin": "U+0000-00FF,U+2000-206F,U+20AC,U+2116,U+2212"}

def fonts() -> str:
    out = []
    for f in sorted((SRC / "fonts").glob("manrope-*-normal.woff2")):
        _, subset, weight, _ = f.stem.split("-")
        b64 = base64.b64encode(f.read_bytes()).decode()
        out.append(f"@font-face{{font-family:'Manrope';font-weight:{weight};font-display:block;"
                   f"src:url(data:font/woff2;base64,{b64}) format('woff2');unicode-range:{RANGES[subset]}}}")
    return "\n".join(out)

def build() -> pathlib.Path:
    css = "\n".join(p.read_text(encoding="utf-8") for p in (SRC / "css" / "base.css", SRC / "css" / "app.css"))
    js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((SRC / "js").glob("*.js")))
    html = (SRC / "index.html").read_text(encoding="utf-8")
    html = html.replace("{{FONTS}}", fonts()).replace("{{CSS}}", css).replace("{{JS}}", js)
    DIST.mkdir(exist_ok=True)
    out = DIST / "mastoras.html"
    out.write_text(html, encoding="utf-8")
    return out

if __name__ == "__main__":
    p = build()
    print(f"{p.relative_to(ROOT)}  {p.stat().st_size / 1024:.0f} KB")
