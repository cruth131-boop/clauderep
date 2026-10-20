#!/usr/bin/env python3
"""Render a SwingTest --dump file (last N candles + chart objects) as an SVG preview: render_svg.py dump.csv out.svg [title]"""
import sys

COL = {"Red": "#e53935", "LimeGreen": "#2e7d32", "IndianRed": "#cd5c5c", "MediumSeaGreen": "#3cb371", "Silver": "#555",
       "DodgerBlue": "#1e88e5", "Gray": "#888"}


def col(c):
    name, _, alpha = c.partition("@")
    return COL.get(name, "#333"), (int(alpha) / 255 if alpha else 1.0)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else ""
    bars, texts, lines, rects, static = [], [], [], [], None
    for row in open(src):
        f = row.rstrip("\n").split(",")
        if f[0] == "bar":
            bars.append((int(f[1]), f[2], *map(float, f[3:7])))
        elif f[0] == "text":
            texts.append((int(f[1]), float(f[2]), f[3], f[4], f[5], f[6]))
        elif f[0] == "line":
            lines.append((int(f[1]), float(f[2]), int(f[3]), float(f[4]), f[5], f[6]))
        elif f[0] == "rect":
            rects.append((int(f[1]), float(f[2]), int(f[3]), float(f[4]), f[5]))
        elif f[0] == "static":
            static = (f[1].split("|"), f[2])
    i0, i1 = bars[0][0], bars[-1][0]
    lo = min(b[4] for b in bars); hi = max(b[3] for b in bars)
    pad = (hi - lo) * 0.08; lo -= pad; hi += pad
    W, H, L, R, T, B = 1400, 700, 20, 170, 30, 40
    cw = (W - L - R) / (i1 - i0 + 1)
    x = lambda i: L + (i - i0 + 0.5) * cw
    y = lambda p: T + (hi - p) / (hi - lo) * (H - T - B)
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="Arial" font-size="11">',
           f'<rect width="{W}" height="{H}" fill="#fafafa"/>', f'<text x="{L}" y="18" font-size="13" fill="#333">{title}</text>']
    for k in range(6):
        p = lo + (hi - lo) * k / 5
        out.append(f'<line x1="{L}" x2="{W-R}" y1="{y(p):.1f}" y2="{y(p):.1f}" stroke="#eee"/><text x="{W-R+105}" y="{y(p)+4:.1f}" fill="#999">{p:.2f}</text>')
    for i, t, o, h, l, c in bars:
        color = "#26a69a" if c >= o else "#ef5350"
        out.append(f'<line x1="{x(i):.1f}" x2="{x(i):.1f}" y1="{y(h):.1f}" y2="{y(l):.1f}" stroke="{color}"/>')
        out.append(f'<rect x="{x(i)-cw*0.35:.1f}" y="{y(max(o,c)):.1f}" width="{cw*0.7:.1f}" height="{max(1,abs(y(o)-y(c))):.1f}" fill="{color}"/>')
    for a, ya, b, yb, c in rects:
        a = max(a, i0)
        cc, al = col(c)
        top, bot = max(ya, yb), min(ya, yb)
        out.append(f'<rect x="{x(a)-cw/2:.1f}" y="{y(top):.1f}" width="{max(1, x(b)-x(a)+cw/2):.1f}" height="{max(1, y(bot)-y(top)):.1f}" '
                   f'fill="{cc}" fill-opacity="{min(0.35, al+0.05):.2f}" stroke="{cc}" stroke-dasharray="2,3"/>')
    for a, ya, b, yb, c, style in lines:
        a = max(a, i0)
        cc, al = col(c)
        dash = ' stroke-dasharray="2,3"' if style.startswith("Dots") else (' stroke-dasharray="6,3,1,3"' if style == "LinesDots" else "")
        out.append(f'<line x1="{x(a):.1f}" x2="{x(b):.1f}" y1="{y(ya):.1f}" y2="{y(yb):.1f}" stroke="{cc}" stroke-opacity="{al}"{dash}/>')
    for i, p, txt, c, va, ha in texts:
        cc, al = col(c)
        dy = -5 if va == "Top" else (13 if va == "Bottom" else 4)
        anchor = "middle" if ha == "Center" else ("start" if ha == "Left" else "end")
        xx = x(i) + (6 if ha == "Left" else 0)
        weight = "bold" if txt.split(" ")[-1].rstrip("?") in ("HH", "HL", "LH", "LL", "EQH", "EQL", "BOS", "CHoCH") else "normal"
        out.append(f'<text x="{xx:.1f}" y="{y(p)+dy:.1f}" fill="{cc}" text-anchor="{anchor}" font-weight="{weight}">{txt}</text>')
    if static:
        cc, _ = col(static[1])
        out.append(f'<rect x="{W-R-265}" y="{T}" width="260" height="{18*len(static[0])+10}" fill="#fff" stroke="#ccc"/>')
        for k, s in enumerate(static[0]):
            out.append(f'<text x="{W-R-255}" y="{T+19+18*k}" fill="{cc if k == 0 else "#333"}" font-weight="{"bold" if k == 0 else "normal"}" xml:space="preserve">{s}</text>')
    out.append(f'<text x="{L}" y="{H-12}" fill="#999">{bars[0][1]} .. {bars[-1][1]} UTC, XAUUSD</text></svg>')
    open(dst, "w").write("\n".join(out))


if __name__ == "__main__":
    main()
