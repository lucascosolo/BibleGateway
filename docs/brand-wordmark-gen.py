"""Broad-pen stroke generator for the Jot wordmark's o and t, in icon.svg units (512 tile).

A centreline (cubic segments) is swept by a nib held at PEN degrees; width at each sample is
thin + (thick - thin) * |sin(tangent - pen)|^EXP, scaled by a pressure profile. The outline is
sampled and turned into a closed Catmull-Rom spline emitted as cubic beziers.

The shipped o and t are the output of:  python3 docs/brand-wordmark-gen.py '{"thick": 54, "tx": 652}'
The j is never generated: it is copied verbatim from apps/web/public/icon.svg.
"""
import json, math, sys

PEN = math.radians(-30)  # nib edge rising to the right (screen y is down)
EXP = 1.6

def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3*a + 3*u*u*t*b + 3*u*t*t*c + t**3*d for a, b, c, d in zip(p0, p1, p2, p3))

def sample(segs, n):
    pts = []
    for i, s in enumerate(segs):
        for k in range(n):
            pts.append(bez(*s, k / n))
    pts.append(segs[-1][3])
    return pts

def widths(pts, thin, thick, pressure, closed=False):
    out = []
    N = len(pts)
    for i, p in enumerate(pts):
        a = pts[(i - 1) % N] if closed else pts[max(i - 1, 0)]
        b = pts[(i + 1) % N] if closed else pts[min(i + 1, N - 1)]
        th = math.atan2(b[1] - a[1], b[0] - a[0])
        nx, ny = -(b[1] - a[1]), b[0] - a[0]
        L = math.hypot(nx, ny) or 1
        w = (thin + (thick - thin) * abs(math.sin(th - PEN)) ** EXP) * pressure(i / (N - 1))
        out.append((p, (nx / L, ny / L), w))
    return out

def catmull(loop):
    n = len(loop)
    f = lambda v: f"{v:.0f}"
    d = [f"M {f(loop[0][0])} {f(loop[0][1])}"]
    for i in range(n):
        p0, p1, p2, p3 = loop[i - 1], loop[i], loop[(i + 1) % n], loop[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f"C {f(c1[0])} {f(c1[1])}, {f(c2[0])} {f(c2[1])}, {f(p2[0])} {f(p2[1])}")
    return " ".join(d) + " Z"

def open_stroke(segs, n, thin, thick, pressure, step=1):
    w = widths(sample(segs, n), thin, thick, pressure)
    left = [(p[0] + nn[0] * ww / 2, p[1] + nn[1] * ww / 2) for p, nn, ww in w]
    right = [(p[0] - nn[0] * ww / 2, p[1] - nn[1] * ww / 2) for p, nn, ww in w]
    def untangle(side):
        # drop offset points that run backwards along the stroke: the inside of a tight bend
        keep = [side[0]]
        for i in range(1, len(side)):
            p, nn, _ = w[i]
            tx_, ty_ = nn[1], -nn[0]
            q = keep[-1]
            if (side[i][0] - q[0]) * tx_ + (side[i][1] - q[1]) * ty_ > 0 or i == len(side) - 1:
                keep.append(side[i])
        return keep
    left, right = untangle(left), untangle(right)
    def cap(p, nn, ww, sign):
        # half-round cap: three points on a semicircle beyond the end, from the left side round to the right
        tx, ty = nn[1] * sign, -nn[0] * sign
        r = ww / 2
        pts = []
        for a in (45, 90, 135) if sign > 0 else (45, 90, 135):
            c, s_ = math.cos(math.radians(a)), math.sin(math.radians(a))
            # rotate from +normal (a=0) through the outward tangent (a=90) to -normal (a=180)
            pts.append((p[0] + r * (nn[0] * c + tx * s_), p[1] + r * (nn[1] * c + ty * s_)))
        return pts
    end, start = w[-1], w[0]
    loop = left[::step] + cap(*end, 1) + right[::-1][::step] + [(q[0], q[1]) for q in cap(start[0], (-start[1][0], -start[1][1]), start[2], 1)]
    return catmull(loop)

def closed_stroke(segs, n, thin, thick, pressure):
    pts = sample(segs, n)[:-1]
    w = widths(pts, thin, thick, pressure, closed=True)
    outer = [(p[0] + nn[0] * ww / 2, p[1] + nn[1] * ww / 2) for p, nn, ww in w]
    inner = [(p[0] - nn[0] * ww / 2, p[1] - nn[1] * ww / 2) for p, nn, ww in w]
    a, b = catmull(outer), catmull(inner[::-1])  # opposite winding: nonzero fill leaves the counter open
    return a + " " + b

P = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
THIN, THICK = P.get("thin", 16), P.get("thick", 58)

# o: centreline ellipse, x-height band top~176 baseline~372, leaning very slightly right.
cx, cy, rx, ry = P.get("ocx", 482), P.get("ocy", 276), P.get("orx", 66), P.get("ory", 82)
k = 0.5523
lean = math.radians(P.get("olean", -6))
def rot(x, y):
    dx, dy = x - cx, y - cy
    return (cx + dx * math.cos(lean) - dy * math.sin(lean), cy + dx * math.sin(lean) + dy * math.cos(lean))
T, Lp, B, R = (cx, cy - ry), (cx - rx, cy), (cx, cy + ry), (cx + rx, cy)
o_segs = [
    [rot(*T), rot(cx - rx * k, cy - ry), rot(cx - rx, cy - ry * k), rot(*Lp)],
    [rot(*Lp), rot(cx - rx, cy + ry * k), rot(cx - rx * k, cy + ry), rot(*B)],
    [rot(*B), rot(cx + rx * k, cy + ry), rot(cx + rx, cy + ry * k), rot(*R)],
    [rot(*R), rot(cx + rx, cy - ry * k), rot(cx + rx * k, cy - ry), rot(*T)],
]
o = closed_stroke(o_segs, 10, THIN, THICK, lambda s: 1.0)

# t: stem from just above the tittle's top (81) down to the baseline, turning into a short foot.
tx = P.get("tx", 640)
stem = [
    [(tx - 6, 70), (tx - 2, 150), (tx - 1, 238), (tx - 2, 318)],
    [(tx - 2, 318), (tx - 2, 386), (tx + 22, 396), (tx + 64, 374)],
]
ss = lambda x: x * x * (3 - 2 * x)
t_pressure = lambda s: (0.72 + 0.28 * ss(min(1, s / 0.3))) * (1 - 0.45 * ss(max(0, (s - 0.62) / 0.38)))
t_stem = open_stroke(stem, 7, THIN, THICK, t_pressure)
bar_y = P.get("bary", 184)
bar = [[(tx - 52, bar_y + 4), (tx - 20, bar_y - 1), (tx + 20, bar_y - 5), (tx + 58, bar_y - 6)]]
t_bar = open_stroke(bar, 6, THIN * 1.15, THICK, lambda s: 0.95 - 0.25 * s)
# The inside of the foot's turn is tighter than half the stem's width; the sampled offset dents
# there, so that one run is replaced by a single smooth fillet.
DENT = "C 692 377, 687 377, 684 375 C 681 374, 679 369, 679 367 C 678 364, 681 362, 682 360 C 682 358, 682 357, 681 354 C 680 351, 677 347, 676 341"
t_stem = t_stem.replace(DENT, "C 686 378, 678 362, 676 341")
print(json.dumps({"o": o, "t": t_stem + " " + t_bar}))
