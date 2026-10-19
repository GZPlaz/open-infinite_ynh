/** Area and perimeter of polygons, circles and composite figures. */
import { DiagramBuilder, centroid, type Pt } from '../../diagram';
import { boolOpt, defineTopic, distinctDistractors, opt, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, withUnit } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { formatMeasure, pickUnit, PiExpr, triples } from './common';

type Shape = 'rectangle' | 'square' | 'triangle' | 'parallelogram' | 'trapezoid' | 'circle' | 'semicircle' | 'lshape';
type Measure = 'area' | 'perimeter';

const SHAPES: Record<Difficulty, Shape[]> = {
  easy: ['rectangle', 'square', 'triangle', 'rectangle'],
  medium: ['parallelogram', 'trapezoid', 'circle', 'triangle'],
  hard: ['semicircle', 'lshape', 'trapezoid', 'circle'],
};

/** Triangles with integer base parts, height and slanted sides (two right triangles sharing a leg). */
const HERONIAN: Array<{ p: number; q: number; h: number; s1: number; s2: number }> = (() => {
  const legs: Array<{ h: number; p: number; s: number }> = [];
  for (const [a, b, c] of triples(30)) {
    legs.push({ h: a, p: b, s: c }, { h: b, p: a, s: c });
  }
  const out: Array<{ p: number; q: number; h: number; s1: number; s2: number }> = [];
  for (const t1 of legs) for (const t2 of legs) if (t1.h === t2.h && t1.p + t2.p <= 40) out.push({ p: t1.p, q: t2.p, h: t1.h, s1: t1.s, s2: t2.s });
  return out;
})();

interface Built {
  /** Outline in real units (for polygons). */
  polygon?: Pt[];
  circle?: { r: number; showDiameter: boolean };
  semicircle?: { L: number; W: number };
  value: PiExpr;
  formula: string;
  wrong: PiExpr[];
  diagram: (fig: DiagramBuilder, u: (v: number) => string) => void;
}

function build(rng: Rng, shape: Shape, measure: Measure): Built {
  switch (shape) {
    case 'rectangle': {
      const l = rng.int(3, 18);
      let w = rng.int(2, 14);
      if (w === l) w += 1;
      const poly: Pt[] = [[0, 0], [l, 0], [l, w], [0, w]];
      return {
        polygon: poly,
        value: PiExpr.of(measure === 'area' ? l * w : 2 * (l + w)),
        formula: measure === 'area' ? `A = lw = ${l} \\cdot ${w}` : `P = 2l + 2w = 2(${l}) + 2(${w})`,
        wrong: measure === 'area' ? [PiExpr.of(2 * (l + w)), PiExpr.of(l + w)] : [PiExpr.of(l * w), PiExpr.of(l + w)],
        diagram: (f, u) => {
          f.polygon(poly, { weight: 1.4 });
          f.sideLabel(poly[0]!, poly[1]!, u(l), centroid(poly));
          f.sideLabel(poly[1]!, poly[2]!, u(w), centroid(poly));
        },
      };
    }
    case 'square': {
      const s = rng.int(2, 15);
      const poly: Pt[] = [[0, 0], [s, 0], [s, s], [0, s]];
      return {
        polygon: poly,
        value: PiExpr.of(measure === 'area' ? s * s : 4 * s),
        formula: measure === 'area' ? `A = s^{2} = ${s}^{2}` : `P = 4s = 4(${s})`,
        wrong: measure === 'area' ? [PiExpr.of(4 * s), PiExpr.of(2 * s)] : [PiExpr.of(s * s), PiExpr.of(2 * s)],
        diagram: (f, u) => {
          f.polygon(poly, { weight: 1.4 });
          f.sideLabel(poly[0]!, poly[1]!, u(s), centroid(poly));
          f.rightAngle(poly[0]!, poly[1]!, poly[3]!, 8);
        },
      };
    }
    case 'triangle': {
      const t = rng.pick(HERONIAN);
      const base = t.p + t.q;
      const poly: Pt[] = [[0, 0], [base, 0], [t.p, t.h]];
      const area = (base * t.h) / 2;
      return {
        polygon: poly,
        value: PiExpr.of(measure === 'area' ? area : base + t.s1 + t.s2),
        formula: measure === 'area' ? `A = \\frac{1}{2}bh = \\frac{1}{2}(${base})(${t.h})` : `P = ${base} + ${t.s1} + ${t.s2}`,
        wrong: measure === 'area' ? [PiExpr.of(base * t.h), PiExpr.of((base * t.s1) / 2)] : [PiExpr.of(area), PiExpr.of(base + t.h + t.s1)],
        diagram: (f, u) => {
          f.polygon(poly, { weight: 1.4 });
          f.sideLabel(poly[0]!, poly[1]!, u(base), centroid(poly));
          if (measure === 'area') {
            f.segment([t.p, t.h], [t.p, 0], { dash: true });
            f.rightAngle([t.p, 0], [t.p + 1, 0], [t.p, 1], 7);
            f.label([t.p, t.h / 2], u(t.h), t.p > base / 2 ? 'w' : 'e');
          } else {
            f.sideLabel(poly[0]!, poly[2]!, u(t.s1), centroid(poly));
            f.sideLabel(poly[1]!, poly[2]!, u(t.s2), centroid(poly));
          }
        },
      };
    }
    case 'parallelogram': {
      const [o, h, s] = rng.pick(triples(20).filter(([a]) => a <= 9));
      const b = rng.int(o + 2, o + 14);
      const poly: Pt[] = [[0, 0], [b, 0], [b + o, h], [o, h]];
      return {
        polygon: poly,
        value: PiExpr.of(measure === 'area' ? b * h : 2 * (b + s)),
        formula: measure === 'area' ? `A = bh = ${b} \\cdot ${h}` : `P = 2(${b}) + 2(${s})`,
        wrong: measure === 'area' ? [PiExpr.of(b * s), PiExpr.of((b * h) / 2)] : [PiExpr.of(b * h), PiExpr.of(b + s)],
        diagram: (f, u) => {
          f.polygon(poly, { weight: 1.4 });
          f.sideLabel(poly[0]!, poly[1]!, u(b), centroid(poly));
          if (measure === 'area') {
            f.segment([o, h], [o, 0], { dash: true });
            f.rightAngle([o, 0], [o + 1, 0], [o, 1], 7);
            f.label([o, h / 2], u(h), 'e');
          } else {
            f.sideLabel(poly[0]!, poly[3]!, u(s), centroid(poly));
          }
        },
      };
    }
    case 'trapezoid': {
      const [o, h, s] = rng.pick(triples(20).filter(([a]) => a <= 8));
      const b1 = rng.int(3, 14);
      const b2 = b1 + 2 * o;
      const poly: Pt[] = [[0, 0], [b2, 0], [o + b1, h], [o, h]];
      return {
        polygon: poly,
        value: PiExpr.of(measure === 'area' ? ((b1 + b2) * h) / 2 : b1 + b2 + 2 * s),
        formula: measure === 'area' ? `A = \\frac{1}{2}(b_1 + b_2)h = \\frac{1}{2}(${b1} + ${b2})(${h})` : `P = ${b1} + ${b2} + ${s} + ${s}`,
        wrong: measure === 'area' ? [PiExpr.of((b1 + b2) * h), PiExpr.of(b1 * b2 * h)] : [PiExpr.of(b1 + b2 + s), PiExpr.of(((b1 + b2) * h) / 2)],
        diagram: (f, u) => {
          f.polygon(poly, { weight: 1.4 });
          f.sideLabel(poly[0]!, poly[1]!, u(b2), centroid(poly));
          f.sideLabel(poly[2]!, poly[3]!, u(b1), centroid(poly));
          if (measure === 'area') {
            f.segment([o + b1, h], [o + b1, 0], { dash: true });
            f.rightAngle([o + b1, 0], [o + b1 - 1, 0], [o + b1, 1], 7);
            f.label([o + b1, h / 2], u(h), 'w');
          } else {
            f.sideLabel(poly[1]!, poly[2]!, u(s), centroid(poly));
            f.sideLabel(poly[3]!, poly[0]!, u(s), centroid(poly));
          }
        },
      };
    }
    case 'circle': {
      const r = rng.int(2, 15);
      const showDiameter = rng.bool(0.4);
      const value = measure === 'area' ? PiExpr.of(0, r * r) : PiExpr.of(0, 2 * r);
      const given = showDiameter ? `r = \\frac{${2 * r}}{2} = ${r};\\ ` : '';
      return {
        circle: { r, showDiameter },
        value,
        formula: measure === 'area' ? `${given}A = \\pi r^{2} = \\pi(${r})^{2}` : `${given}C = 2\\pi r = 2\\pi(${r})`,
        wrong: measure === 'area' ? [PiExpr.of(0, 2 * r), PiExpr.of(0, 4 * r * r)] : [PiExpr.of(0, r * r), PiExpr.of(0, r)],
        diagram: (f, u) => {
          f.circle([0, 0], r, { weight: 1.4 });
          f.dot([0, 0]);
          if (showDiameter) {
            f.segment([-r, 0], [r, 0]);
            f.label([0, 0], u(2 * r), 'n');
          } else {
            f.segment([0, 0], [r, 0]);
            f.label([r / 2, 0], u(r), 'n');
          }
        },
      };
    }
    case 'semicircle': {
      const r = rng.int(2, 7);
      const W = 2 * r;
      const L = rng.int(W, W + 12);
      const poly: Pt[] = [[0, 0], [L, 0], [L, W], [0, W]];
      const value = measure === 'area' ? PiExpr.of(L * W, (r * r) / 2) : PiExpr.of(2 * L + W, r);
      return {
        semicircle: { L, W },
        value,
        formula:
          measure === 'area'
            ? `A = lw + \\frac{1}{2}\\pi r^{2} = ${L} \\cdot ${W} + \\frac{1}{2}\\pi(${r})^{2}`
            : `P = 2l + w + \\frac{1}{2}(2\\pi r) = 2(${L}) + ${W} + \\pi(${r})`,
        wrong: measure === 'area' ? [PiExpr.of(L * W, r * r), PiExpr.of(L * W, 2 * r)] : [PiExpr.of(2 * L + 2 * W, r), PiExpr.of(2 * L + W, 2 * r)],
        diagram: (f, u) => {
          f.path([poly[1]!, poly[0]!, poly[3]!, poly[2]!], { weight: 1.4 });
          f.segment(poly[1]!, poly[2]!, { dash: true });
          f.arc([L, r], r, -90, 90, 'ink', 1.4);
          f.sideLabel(poly[0]!, poly[1]!, u(L), centroid(poly));
          f.sideLabel(poly[3]!, poly[0]!, u(W), centroid(poly));
        },
      };
    }
    case 'lshape':
    default: {
      const W = rng.int(8, 18);
      const H = rng.int(8, 16);
      const w = rng.int(3, W - 3);
      const h = rng.int(3, H - 3);
      const poly: Pt[] = [[0, 0], [W, 0], [W, H - h], [W - w, H - h], [W - w, H], [0, H]];
      return {
        polygon: poly,
        value: PiExpr.of(measure === 'area' ? W * H - w * h : 2 * (W + H)),
        formula: measure === 'area' ? `A = ${W} \\cdot ${H} - ${w} \\cdot ${h}` : `P = ${W} + ${H - h} + ${w} + ${h} + ${W - w} + ${H}`,
        wrong: measure === 'area' ? [PiExpr.of(W * H), PiExpr.of(W * H - (W - w) * (H - h))] : [PiExpr.of(2 * (W + H) - w - h), PiExpr.of(W * H - w * h)],
        diagram: (f, u) => {
          f.polygon(poly, { weight: 1.4 });
          const c = centroid([[0, 0], [W, 0], [W, H], [0, H]]);
          f.sideLabel(poly[0]!, poly[1]!, u(W), c);
          f.sideLabel(poly[1]!, poly[2]!, u(H - h), c);
          f.sideLabel(poly[2]!, poly[3]!, u(w), [W - w / 2, 0]);
          f.sideLabel(poly[3]!, poly[4]!, u(h), [0, H - h / 2]);
          f.sideLabel(poly[4]!, poly[5]!, u(W - w), c);
          f.sideLabel(poly[5]!, poly[0]!, u(H), c);
        },
      };
    }
  }
}

export const areaPerimeter = defineTopic({
  id: 'geo.area-perimeter',
  subject: 'geometry',
  category: 'Polygons and Quadrilaterals',
  title: 'Area & Perimeter',
  description: 'Rectangles, triangles, parallelograms, trapezoids, circles and composite figures.',
  instruction: (o) => {
    const what = o.measure === 'perimeter' ? 'perimeter (or circumference)' : o.measure === 'area' ? 'area' : 'indicated measure';
    return o.answerForm === 'exact' ? `Find the ${what} of each figure. Leave answers in terms of π.` : `Find the ${what} of each figure. Round to the nearest tenth when necessary.`;
  },
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'measure',
      label: 'Find',
      default: 'area',
      choices: [
        { value: 'area', label: 'Area' },
        { value: 'perimeter', label: 'Perimeter / circumference' },
        { value: 'any', label: 'Mixed' },
      ],
    },
    opt.rounding('round'),
    opt.units(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const mOpt = strOpt(ctx, 'measure');
    const measure: Measure = mOpt === 'any' ? rng.pick<Measure>(['area', 'perimeter']) : (mOpt as Measure);
    const form = strOpt(ctx, 'answerForm');
    const unit = pickUnit(rng, boolOpt(ctx, 'units'));
    const shape = rng.pick(SHAPES[difficulty]);
    const b = build(rng, shape, measure);
    const symbol = measure === 'area' ? 'A' : shape === 'circle' ? 'C' : 'P';
    const power = measure === 'area' ? 2 : 1;
    const hasPi = !b.value.pi.isZero();
    const fmt = (v: PiExpr) => {
      const f = formatMeasure(v.value, form, unit, power, hasPi ? v.toTex() : undefined);
      return `${symbol} ${f.approx ? '\\approx' : '='} ${f.tex}`;
    };
    const answer = m(fmt(b.value));
    const span = b.circle ? 2 * b.circle.r : Math.max(...(b.polygon ?? [[b.semicircle!.L + b.semicircle!.W / 2, b.semicircle!.W]]).flatMap((p) => p));
    const fig = new DiagramBuilder(120 / span);
    b.diagram(fig, (v) => withUnit(String(v), unit));
    const name = shape === 'lshape' ? 'composite figure' : shape === 'semicircle' ? 'rectangle with a semicircle' : shape;
    const ask = measure === 'area' ? 'area' : shape === 'circle' ? 'circumference' : 'perimeter';
    return {
      question: `Find the ${ask}.`,
      answer,
      steps: [
        m(b.formula),
        m(`${symbol} = ${hasPi ? b.value.toTex() : decimal(b.value.value, 2)}${hasPi && form !== 'exact' ? ` \\approx ${decimal(b.value.value, 1)}` : ''}`),
      ],
      distractors: distinctDistractors(
        answer,
        b.wrong.map((w) => m(fmt(w))),
        (k) => m(fmt(b.value.add(PiExpr.of(k)))),
      ),
      diagram: fig.build(`${name}; find the ${ask}`),
      check: {
        kind: 'area',
        measure,
        polygon: b.polygon,
        circle: b.circle,
        semicircle: b.semicircle,
        form,
      },
    };
  },
});
