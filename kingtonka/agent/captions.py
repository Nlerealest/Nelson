"""Animated captions for King Tonka clips, written as an ASS subtitle file that
ffmpeg burns into the video.

Styles:
  bold     big uppercase lines of 1–3 words, the spoken word lights up in the accent colour
  pop      one word at a time, popping in
  karaoke  lines of up to 5 words that fill with the accent colour as they are spoken
  clean    calm sentence-case lines on a dark box
  none     no captions
"""
FONT = 'Inter Display'
PUNCT_END = ('.', ',', '?', '!', ':', ';', '…')


def ass_color(hex_color, alpha=0):
    h = (hex_color or '#FFD400').lstrip('#')
    if len(h) != 6:
        h = 'FFD400'
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f'&H{alpha:02X}{b}{g}{r}'.upper()


def ts(t):
    t = max(0.0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f'{int(h)}:{int(m):02d}:{s:05.2f}'


def esc(text):
    return text.replace('\\', '').replace('{', '(').replace('}', ')').replace('\n', ' ')


def group_words(words, max_words, max_chars):
    """Splits [[start, end, text], …] into short lines at pauses and punctuation."""
    groups, cur = [], []
    for i, w in enumerate(words):
        if cur:
            gap = w[0] - cur[-1][1]
            chars = sum(len(x[2]) + 1 for x in cur) + len(w[2])
            if len(cur) >= max_words or chars > max_chars or gap > 0.45 or cur[-1][2].endswith(PUNCT_END):
                groups.append(cur)
                cur = []
        cur.append(w)
    if cur:
        groups.append(cur)
    return groups


def build(words, duration, width, height, style=None, title=None):
    """Returns the text of an .ass file. words are relative to the clip start."""
    style = style or {}
    kind = style.get('captions', 'bold')
    accent = ass_color(style.get('color'))
    white, black = '&H00FFFFFF', '&H00000000'
    portrait = height > width
    base = round((width if portrait else height) * (0.085 if portrait else 0.06))
    y = {'top': 0.28, 'middle': 0.68 if portrait else 0.74, 'bottom': 0.82 if portrait else 0.86}[style.get('position', 'middle')]
    # Streamer-on-top layout: 'middle' captions sit on the line between the camera and the game.
    if style.get('_seam') and style.get('position', 'middle') == 'middle':
        y = style['_seam']
    x, y = width // 2, round(height * y)
    title_margin = round(height * (0.025 if style.get('_seam') else 0.09))
    margin = round(width * 0.07)

    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Bold,{FONT},{base},{white},{white},{black},&H64000000,-1,0,0,0,100,100,1,0,1,{max(4, base // 14)},{max(2, base // 30)},5,{margin},{margin},0,1
Style: Pop,{FONT},{round(base * 1.3)},{white},{white},{black},&H64000000,-1,0,0,0,100,100,1,0,1,{max(5, base // 12)},{max(2, base // 28)},5,{margin},{margin},0,1
Style: Karaoke,{FONT},{round(base * 0.85)},{accent},{white},{black},&H64000000,-1,0,0,0,100,100,0,0,1,{max(4, base // 15)},0,5,{margin},{margin},0,1
Style: Clean,{FONT},{round(base * 0.62)},{white},{white},&H99000000,&H99000000,0,0,0,0,100,100,0,0,3,{max(8, base // 6)},0,5,{margin},{margin},0,1
Style: Title,{FONT},{round(base * 0.62)},{black},{black},{white},{white},-1,0,0,0,100,100,0,0,3,{max(14, base // 4)},0,8,{margin},{margin},{title_margin},1
Style: Mark,{FONT},{round(base * 0.36)},&H40FFFFFF,&H40FFFFFF,&H80000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,9,{margin},{margin},{round(height * 0.04)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    add = lambda st, s, e, text, layer=0: ev.append(f'Dialogue: {layer},{ts(s)},{ts(e)},{st},,0,0,0,,{text}')
    pos = f'{{\\an5\\pos({x},{y})}}'

    if title and style.get('hook_title', True):
        add('Title', 0, min(3.5, duration), '{\\fad(150,300)}' + esc(title), 2)
    if style.get('watermark'):
        add('Mark', 0, duration, esc(style['watermark']), 3)

    words = [w for w in words if w[1] > 0 and w[0] < duration]
    if kind == 'none' or not words:
        return head + '\n'.join(ev) + '\n'

    if kind == 'pop':
        for i, (s, e, t) in enumerate(words):
            nxt = words[i + 1][0] if i + 1 < len(words) else duration
            end = max(e, min(nxt, e + 0.6))
            add('Pop', s, end, pos + '{\\fscx70\\fscy70\\t(0,90,\\fscx108\\fscy108)\\t(90,160,\\fscx100\\fscy100)}' + esc(t.upper()))
        return head + '\n'.join(ev) + '\n'

    if kind == 'clean':
        for g in group_words(words, 7, 38):
            nxt_end = g[-1][1] + 0.4
            add('Clean', g[0][0], nxt_end, pos + esc(' '.join(w[2] for w in g)))
        return head + '\n'.join(ev) + '\n'

    if kind == 'karaoke':
        groups = group_words(words, 5, 28)
        for gi, g in enumerate(groups):
            end = min(groups[gi + 1][0][0], g[-1][1] + 0.5) if gi + 1 < len(groups) else g[-1][1] + 0.5
            parts, t0 = [], g[0][0]
            for w in g:
                parts.append(f'{{\\k{max(1, round((w[0] - t0) * 100))}}}' if w[0] > t0 else '')
                parts[-1] += f'{{\\kf{max(1, round((w[1] - w[0]) * 100))}}}{esc(w[2].upper())} '
                t0 = w[1]
            add('Karaoke', g[0][0], end, pos + ''.join(parts).strip())
        return head + '\n'.join(ev) + '\n'

    # bold (default): the whole short line stays up, the current word lights up.
    groups = group_words(words, 3, 18)
    for gi, g in enumerate(groups):
        line_end = min(groups[gi + 1][0][0], g[-1][1] + 0.5) if gi + 1 < len(groups) else g[-1][1] + 0.5
        for wi, w in enumerate(g):
            s = w[0] if wi else g[0][0]
            e = g[wi + 1][0] if wi + 1 < len(g) else line_end
            text = ' '.join(
                (f'{{\\c{accent}\\fscx112\\fscy112}}{esc(o[2].upper())}{{\\c{white}\\fscx100\\fscy100}}' if oi == wi else esc(o[2].upper()))
                for oi, o in enumerate(g))
            pop = '{\\fscx92\\fscy92\\t(0,70,\\fscx100\\fscy100)}' if wi == 0 else ''
            add('Bold', s, max(e, s + 0.05), pos + pop + text)
    return head + '\n'.join(ev) + '\n'
