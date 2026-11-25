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
autoscroll = ('<div class="setting-row"><span class="setting-name">Auto-scroll</span><div class="choice-row">'
       '<button type="button" class="choice as-btn" data-speed="slow">Slow</button>'
       '<button type="button" class="choice as-btn" data-speed="medium">Medium</button>'
       '<button type="button" class="choice as-btn" data-speed="fast">Fast</button></div>'
       '<div class="as-help">Double-tap the text while reading to start or stop scrolling.</div></div>')
upd = (autoscroll + '<div class="setting-row"><span class="setting-name">Updates</span>'
       '<div class="upd-box" id="upd-box"><div class="upd-line" id="upd-line">…</div>'
       '<div class="upd-bar" id="upd-bar"><i></i></div>'
       '<button class="upd-btn" id="upd-btn" type="button">Check for updates</button>'
       '<label class="upd-toggle"><input type="checkbox" id="upd-auto" checked> Update automatically</label></div></div>'
       '<div class="settings-about">')
s = must_sub(r'<div class="settings-about">', upd, s)

# 4) home hero with logo
hero = ('<div class="hero"><svg class="hero-mark" viewBox="0 0 512 512" aria-hidden="true"><use href="#lg-icon"/></svg>'
        '<h1>תפילות</h1><div class="hero-sub">נוסח ספרד</div></div>'
        '<div class="cards"><article class="prayer-card compass-card"><div class="card-main" id="compass-open" role="button" tabindex="0">'
        '<span class="cc-ico">🧭</span><span class="card-title">מצפן · כיוון ירושלים</span></div></article></div>')
s = must_sub(r'<div class="hero"><h1>תפילות</h1></div>', hero, s)

# 5) toast + script
toast = '<div class="upd-toast" id="upd-toast"><span></span><button class="upd-btn" type="button">Update</button></div>'
DIAL = '<svg viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="190" fill="rgba(255,255,255,.04)" stroke="#e6c27a" stroke-opacity=".55" stroke-width="2"/><circle cx="200" cy="200" r="118" fill="none" stroke="#fff" stroke-opacity=".08"/><line x1="200.0" y1="10.0" x2="200.0" y2="34.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="233.0" y1="12.9" x2="230.6" y2="26.7" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="265.0" y1="21.5" x2="260.2" y2="34.6" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="295.0" y1="35.5" x2="283.0" y2="56.2" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="322.1" y1="54.5" x2="313.1" y2="65.2" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="345.5" y1="77.9" x2="334.8" y2="86.9" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="364.5" y1="105.0" x2="343.8" y2="117.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="378.5" y1="135.0" x2="365.4" y2="139.8" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="387.1" y1="167.0" x2="373.3" y2="169.4" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="390.0" y1="200.0" x2="366.0" y2="200.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="387.1" y1="233.0" x2="373.3" y2="230.6" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="378.5" y1="265.0" x2="365.4" y2="260.2" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="364.5" y1="295.0" x2="343.8" y2="283.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="345.5" y1="322.1" x2="334.8" y2="313.1" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="322.1" y1="345.5" x2="313.1" y2="334.8" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="295.0" y1="364.5" x2="283.0" y2="343.8" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="265.0" y1="378.5" x2="260.2" y2="365.4" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="233.0" y1="387.1" x2="230.6" y2="373.3" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="200.0" y1="390.0" x2="200.0" y2="366.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="167.0" y1="387.1" x2="169.4" y2="373.3" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="135.0" y1="378.5" x2="139.8" y2="365.4" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="105.0" y1="364.5" x2="117.0" y2="343.8" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="77.9" y1="345.5" x2="86.9" y2="334.8" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="54.5" y1="322.1" x2="65.2" y2="313.1" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="35.5" y1="295.0" x2="56.2" y2="283.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="21.5" y1="265.0" x2="34.6" y2="260.2" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="12.9" y1="233.0" x2="26.7" y2="230.6" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="10.0" y1="200.0" x2="34.0" y2="200.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="12.9" y1="167.0" x2="26.7" y2="169.4" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="21.5" y1="135.0" x2="34.6" y2="139.8" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="35.5" y1="105.0" x2="56.2" y2="117.0" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="54.5" y1="77.9" x2="65.2" y2="86.9" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="77.9" y1="54.5" x2="86.9" y2="65.2" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="105.0" y1="35.5" x2="117.0" y2="56.2" stroke="#f3efe4" stroke-opacity=".8" stroke-width="2.4"/><line x1="135.0" y1="21.5" x2="139.8" y2="34.6" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><line x1="167.0" y1="12.9" x2="169.4" y2="26.7" stroke="#f3efe4" stroke-opacity=".35" stroke-width="1.4"/><text x="200.0" y="62.0" fill="#ff8a7a" font-family="Arial" font-weight="700" font-size="28" text-anchor="middle" dominant-baseline="central">N</text><text x="338.0" y="200.0" fill="#f3efe4" font-family="Arial" font-weight="700" font-size="28" text-anchor="middle" dominant-baseline="central">E</text><text x="200.0" y="338.0" fill="#f3efe4" font-family="Arial" font-weight="700" font-size="28" text-anchor="middle" dominant-baseline="central">S</text><text x="62.0" y="200.0" fill="#f3efe4" font-family="Arial" font-weight="700" font-size="28" text-anchor="middle" dominant-baseline="central">W</text></svg>'
overlays = ('<div class="as-pill" id="as-pill"><button id="as-stop" type="button" aria-label="Stop">■</button>'
  '<span id="as-label">גלילה אוטומטית</span><button id="as-speed" type="button">בינוני</button></div>'
  '<div class="as-hint" id="as-hint">הקישו פעמיים על הטקסט לגלילה אוטומטית</div>'
  '<div class="cp" id="compass"><div class="cp-top"><button class="cp-close" id="cp-close" type="button" aria-label="Close">✕</button><div class="cp-title">מצפן · ירושלים</div><span style="width:40px"></span></div>'
  '<div class="cp-stage"><div class="cp-notch"></div><div class="cp-dial" id="cp-dial">' + DIAL + '<div class="cp-jer" id="cp-jer"><i>✡</i></div></div>'
  '<div class="cp-center"><div class="cp-deg" id="cp-deg"></div></div></div>'
  '<div class="cp-info"><div class="cp-msg" id="cp-msg">מכיילים…</div><div class="cp-sub" id="cp-sub"></div>'
  '<div class="cp-loc"><select id="cp-city" aria-label="City"><option value="">בחרו עיר…</option></select><button id="cp-find" type="button">המיקום שלי</button></div></div></div>')
s = must_sub(r'</div></body></html>\s*$', toast + overlays + '</div><script>' + js + '</script></body></html>', s)

pathlib.Path(out_path).parent.mkdir(parents=True, exist_ok=True)
open(out_path, 'w', encoding='utf-8').write(s)
print('ok', len(s))
