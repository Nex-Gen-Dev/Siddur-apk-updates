#!/usr/bin/env python3
"""Turns the plain siddur HTML into the polished app page (www/index.html).

usage: build_www.py <original.html> <out/index.html> [web_version]
"""
import re, sys, pathlib

here = pathlib.Path(__file__).resolve().parent
src_path, out_path = sys.argv[1], sys.argv[2]
web_version = int(sys.argv[3]) if len(sys.argv) > 3 else 1
s = open(src_path, encoding='utf-8').read()

css = (here / 'theme.css').read_text(encoding='utf-8')
js = (here / 'app.js').read_text(encoding='utf-8')
icon = (here.parent / 'assets' / 'icon.svg').read_text(encoding='utf-8')

# --- logo symbol (ids prefixed so they never clash with the page) ---
inner = re.search(r'<svg[^>]*>(.*)</svg>', icon, re.S).group(1)
inner = re.sub(r'id="(bg|gl|pg|pg2)"', r'id="lg-\1"', inner)
inner = re.sub(r'url\(#(bg|gl|pg|pg2)\)', r'url(#lg-\1)', inner)
defs_part, body_part = re.search(r'(<defs>.*?</defs>)(.*)', inner, re.S).groups()
sprite = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true">'
          + defs_part + '<symbol id="lg-icon" viewBox="0 0 512 512">' + body_part + '</symbol></svg>')

def must_sub(pattern, repl, text, flags=re.S):
    new, n = re.subn(pattern, lambda m: repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit('Could not find expected block: ' + pattern[:60])
    return new

# 1) head: title, theme colour, extra css
s = s.replace('<title>סידור</title>', '<title>סידור</title><meta name="theme-color" content="#0c0f1f"><script>window.SIDDUR_WEB=%d</script>' % web_version, 1)
s = must_sub(r'</style></head>', '</style><style id="app-polish">' + css + '</style></head>', s)

# 2) splash / loading screen
splash = (sprite +
 '<div class="intro-screen" aria-label="טוען">'
 '<div class="sp-glow"></div>'
 '<svg class="sp-icon" viewBox="0 0 512 512"><use href="#lg-icon"/></svg>'
 '<div class="sp-title">סידור</div>'
 '<div class="sp-sub">נוסח ספרד</div>'
 '<div class="sp-ded">לע״נ מרן רבינו יואל ב״ר חנני׳ יום טוב זצוקללה״ה</div>'
 '<div class="sp-bar"><i></i></div>'
 '<label class="sp-skip" for="intro-open" aria-label="Skip"></label>'
 '</div>\n\n<div class="settings-overlay">')
s = must_sub(r'<div class="intro-screen".*?<div class="settings-overlay">', splash, s)

# 3) settings: updates row (before the credit footer)
upd = ('<div class="setting-row"><span class="setting-name">Updates</span>'
       '<div class="upd-box" id="upd-box"><div class="upd-line" id="upd-line">…</div>'
       '<div class="upd-bar" id="upd-bar"><i></i></div>'
       '<button class="upd-btn" id="upd-btn" type="button">Check for updates</button>'
       '<label class="upd-toggle"><input type="checkbox" id="upd-auto" checked> Update automatically</label></div></div>'
       '<div class="settings-about">')
s = must_sub(r'<div class="settings-about">', upd, s)

# 4) home hero with logo
hero = ('<div class="hero"><svg class="hero-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#lg-icon"/></svg>'
        '<h1>תפילות</h1><div class="hero-sub">נוסח ספרד</div></div>')
s = must_sub(r'<div class="hero"><h1>תפילות</h1></div>', hero, s)

# 5) toast + script
toast = '<div class="upd-toast" id="upd-toast"><span></span><button class="upd-btn" type="button">Update</button></div>'
s = must_sub(r'</div></body></html>\s*$', toast + '</div><script>' + js + '</script></body></html>', s)

pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
open(out_path, 'w', encoding='utf-8').write(s)
print('ok', len(s))
