/**
 * Resolution-independent figures.
 *
 * Generators describe figures as a handful of primitives in a y-up coordinate
 * system; the UI renders them to SVG and the LaTeX exporter to TikZ, so the
 * screen, print, PDF and .tex outputs all show the same figure.
 */

export type Pt = readonly [number, number];
export type Ink = 'ink' | 'grid' | 'axis' | 'accent' | 'muted';
export type LabelPos = 'c' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type DiagramItem =
  | { t: 'path'; pts: Pt[]; closed?: boolean; dash?: boolean; ink?: Ink; weight?: number }
  | { t: 'circle'; c: Pt; r: number; dash?: boolean; ink?: Ink; weight?: number }
  | { t: 'ellipse'; c: Pt; rx: number; ry: number; part?: 'full' | 'upper' | 'lower'; dash?: boolean; ink?: Ink; weight?: number }
  | { t: 'arc'; c: Pt; r: number; from: number; to: number; ink?: Ink; weight?: number }
  | { t: 'dot'; p: Pt; open?: boolean; ink?: Ink }
  | { t: 'arrow'; from: Pt; to: Pt; both?: boolean; ink?: Ink; weight?: number }
  | { t: 'label'; p: Pt; tex: string; text: string; pos: LabelPos; ink?: Ink; small?: boolean };

export interface Diagram {
  /** Bounding box in diagram units (y axis points up). */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** CSS pixels per diagram unit. */
  scale: number;
  items: DiagramItem[];
  /** Text alternative for screen readers. */
  alt: string;
}

/** Label font size in CSS px (screen and print). */
export const LABEL_PX = 13;
export const LABEL_SMALL_PX = 10;
/** Gap between a label and the point it annotates, in px. */
export const LABEL_GAP_PX = 3;

// ---------------------------------------------------------------- vectors

export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const len = (a: Pt): number => Math.hypot(a[0], a[1]);
export const unit = (a: Pt): Pt => mul(a, 1 / (len(a) || 1));
export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const dirDeg = (deg: number): Pt => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
export const angleOf = (v: Pt): number => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

export function rotate(p: Pt, deg: number, about: Pt = [0, 0]): Pt {
  const r = (deg * Math.PI) / 180;
  const [x, y] = sub(p, about);
  return add(about, [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)]);
}

export function centroid(pts: readonly Pt[]): Pt {
  const s = pts.reduce<Pt>((acc, p) => add(acc, p), [0, 0]);
  return mul(s, 1 / pts.length);
}

/** Compass label position pointing along `v` (for labels placed beside a point). */
export function posToward(v: Pt): LabelPos {
  const a = ((angleOf(v) % 360) + 360) % 360;
  const names: LabelPos[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
  return names[Math.round(a / 45) % 8]!;
}

// ---------------------------------------------------------------- tex → plain text

const SYMBOLS: Record<string, string> = {
  '\\pi': 'π',
  '\\theta': 'θ',
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\circ': '°',
  '\\prime': '′',
  '\\cdot': '·',
  '\\times': '×',
  '\\approx': '≈',
  '\\,': ' ',
  '\\ ': ' ',
};
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

/** Convert the small LaTeX subset used in figure labels to display text. */
export function texToPlain(tex: string): string {
  let s = tex;
  s = s.replace(/\\text\{([^}]*)\}/g, '$1');
  s = s.replace(/\\sqrt\{([^}]*)\}/g, '√$1');
  s = s.replace(/\^\{?\\circ\}?/g, '°');
  s = s.replace(/\^\{([0-9-]+)\}|\^([0-9])/g, (_, a: string | undefined, b: string | undefined) =>
    [...(a ?? b ?? '')].map((c) => SUPERSCRIPTS[c] ?? c).join(''),
  );
  s = s.replace(/\\[a-zA-Z]+|\\[, ]/g, (cmd) => SYMBOLS[cmd] ?? '');
  s = s.replace(/[{}]/g, '');
  s = s.replace(/-/g, '−').replace(/'/g, '′');
  return s;
}

// ---------------------------------------------------------------- builder

export interface Style {
  dash?: boolean;
  ink?: Ink;
  weight?: number;
}

export class DiagramBuilder {
  readonly items: DiagramItem[] = [];
  private x0 = Infinity;
  private y0 = Infinity;
  private x1 = -Infinity;
  private y1 = -Infinity;

  /** @param scale CSS pixels per diagram unit. */
  constructor(readonly scale: number) {}

  private extend(p: Pt, rx = 0, ry = rx): void {
    this.x0 = Math.min(this.x0, p[0] - rx);
    this.x1 = Math.max(this.x1, p[0] + rx);
    this.y0 = Math.min(this.y0, p[1] - ry);
    this.y1 = Math.max(this.y1, p[1] + ry);
  }

  /** Convert a length in px to diagram units. */
  px(n: number): number {
    return n / this.scale;
  }

  path(pts: Pt[], style: Style & { closed?: boolean } = {}): this {
    pts.forEach((p) => this.extend(p));
    this.items.push({ t: 'path', pts, ...style });
    return this;
  }

  polygon(pts: Pt[], style: Style = {}): this {
    return this.path(pts, { ...style, closed: true });
  }

  segment(a: Pt, b: Pt, style: Style = {}): this {
    return this.path([a, b], style);
  }

  circle(c: Pt, r: number, style: Style = {}): this {
    this.extend(c, r);
    this.items.push({ t: 'circle', c, r, ...style });
    return this;
  }

  ellipse(c: Pt, rx: number, ry: number, part: 'full' | 'upper' | 'lower' = 'full', style: Style = {}): this {
    this.extend(c, rx, ry);
    this.items.push({ t: 'ellipse', c, rx, ry, part, ...style });
    return this;
  }

  arc(c: Pt, r: number, from: number, to: number, ink?: Ink, weight?: number): this {
    for (let k = 0; k <= 8; k++) this.extend(add(c, mul(dirDeg(from + ((to - from) * k) / 8), r)));
    this.items.push({ t: 'arc', c, r, from, to, ink, weight });
    return this;
  }

  dot(p: Pt, open = false, ink?: Ink): this {
    this.extend(p, this.px(4));
    this.items.push({ t: 'dot', p, open, ink });
    return this;
  }

  arrow(from: Pt, to: Pt, opts: { both?: boolean; ink?: Ink; weight?: number } = {}): this {
    this.extend(from, this.px(4));
    this.extend(to, this.px(4));
    this.items.push({ t: 'arrow', from, to, ...opts });
    return this;
  }

  /** A text label; `tex` is the LaTeX source (plain text is derived from it). */
  label(p: Pt, tex: string, pos: LabelPos = 'c', opts: { ink?: Ink; small?: boolean } = {}): this {
    const text = texToPlain(tex);
    const fontPx = opts.small ? LABEL_SMALL_PX : LABEL_PX;
    const w = this.px(text.length * fontPx * 0.6 + 2);
    const h = this.px(fontPx * 1.2);
    const gap = this.px(LABEL_GAP_PX);
    const dx = pos.includes('e') ? w / 2 + gap : pos.includes('w') ? -(w / 2 + gap) : 0;
    const dy = pos.includes('n') ? h / 2 + gap : pos.includes('s') ? -(h / 2 + gap) : 0;
    this.extend([p[0] + dx, p[1] + dy], w / 2, h / 2);
    this.items.push({ t: 'label', p, tex, text, pos, ...opts });
    return this;
  }

  /** Label centred beside segment ab, on the side away from `inside`. */
  sideLabel(a: Pt, b: Pt, tex: string, inside: Pt, opts: { ink?: Ink } = {}): this {
    const m = mid(a, b);
    const d = unit(sub(b, a));
    let n: Pt = [-d[1], d[0]];
    if ((inside[0] - m[0]) * n[0] + (inside[1] - m[1]) * n[1] > 0) n = mul(n, -1);
    return this.label(add(m, mul(n, this.px(2))), tex, posToward(n), opts);
  }

  /** Small square marking a right angle at `v` between the directions to `a` and `b`. */
  rightAngle(v: Pt, a: Pt, b: Pt, sizePx = 9): this {
    const s = this.px(sizePx);
    const u1 = mul(unit(sub(a, v)), s);
    const u2 = mul(unit(sub(b, v)), s);
    return this.path([add(v, u1), add(add(v, u1), u2), add(v, u2)], { weight: 0.8 });
  }

  /** Arc marking the angle at `v` from ray va to ray vb (the smaller one). */
  angleArc(v: Pt, a: Pt, b: Pt, radiusPx = 16): this {
    let from = angleOf(sub(a, v));
    let to = angleOf(sub(b, v));
    let sweep = (((to - from) % 360) + 360) % 360;
    if (sweep > 180) {
      [from, to] = [to, from];
      sweep = 360 - sweep;
    }
    return this.arc(v, this.px(radiusPx), from, from + sweep);
  }

  /** Direction (unit vector) bisecting the angle avb. */
  static bisector(v: Pt, a: Pt, b: Pt): Pt {
    return unit(add(unit(sub(a, v)), unit(sub(b, v))));
  }

  build(alt: string, padPx = 4): Diagram {
    const pad = this.px(padPx);
    return {
      box: { x0: this.x0 - pad, y0: this.y0 - pad, x1: this.x1 + pad, y1: this.y1 + pad },
      scale: this.scale,
      items: this.items,
      alt,
    };
  }
}

// ---------------------------------------------------------------- common figures

export interface PlaneOptions {
  /** Half-width of the visible grid (grid spans -range…range on both axes). */
  range: number;
  /** Pixels per grid unit. */
  scale?: number;
  /** Label every `tickEvery` units on the axes (0 = none). */
  tickEvery?: number;
}

/** Empty coordinate plane with grid, axes and sparse tick labels. */
export function coordinatePlane(opts: PlaneOptions): DiagramBuilder {
  const r = opts.range;
  const b = new DiagramBuilder(opts.scale ?? 11);
  for (let i = -r; i <= r; i++) {
    if (i === 0) continue;
    b.segment([i, -r], [i, r], { ink: 'grid', weight: 0.5 });
    b.segment([-r, i], [r, i], { ink: 'grid', weight: 0.5 });
  }
  b.arrow([-r - 0.6, 0], [r + 0.6, 0], { both: true, ink: 'axis', weight: 1 });
  b.arrow([0, -r - 0.6], [0, r + 0.6], { both: true, ink: 'axis', weight: 1 });
  b.label([r + 0.6, 0], 'x', 'e', { ink: 'axis' });
  b.label([0, r + 0.6], 'y', 'n', { ink: 'axis' });
  const every = opts.tickEvery ?? 0;
  if (every > 0) {
    for (let i = every; i <= r; i += every) {
      for (const v of [i, -i]) {
        b.label([v, 0], String(v), 's', { ink: 'muted', small: true });
        b.label([0, v], String(v), 'w', { ink: 'muted', small: true });
      }
    }
  }
  return b;
}

/** Number line from `lo` to `hi` with integer ticks. */
export function numberLine(lo: number, hi: number, scale = 26): DiagramBuilder {
  const b = new DiagramBuilder(scale);
  b.arrow([lo - 0.7, 0], [hi + 0.7, 0], { both: true, ink: 'ink', weight: 1 });
  for (let v = lo; v <= hi; v++) {
    b.segment([v, -0.15], [v, 0.15], { weight: 1 });
    b.label([v, -0.15], String(v), 's', { small: true });
  }
  return b;
}
