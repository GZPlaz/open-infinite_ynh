/** Volume and surface area of prisms, cylinders, cones, pyramids and spheres. */
import { add, DiagramBuilder, dirDeg, mid, mul, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { boolOpt, defineTopic, distinctDistractors, opt, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, withUnit } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { formatMeasure, pickUnit, PiExpr, triples } from './common';

type Solid = 'prism' | 'cube' | 'cylinder' | 'cone' | 'sphere' | 'pyramid';
type Measure = 'volume' | 'surface';

const SOLIDS: Record<Difficulty, Solid[]> = {
  easy: ['prism', 'cube', 'prism'],
  medium: ['cylinder', 'prism', 'sphere', 'cube'],
  hard: ['cone', 'pyramid', 'sphere', 'cylinder'],
};

const DEPTH = 0.5;
const depthVec = (w: number): Pt => mul(dirDeg(35), w * DEPTH);

interface Built {
  params: Record<string, number>;
  value: PiExpr;
  formula: string;
  wrong: PiExpr[];
  draw: (f: DiagramBuilder, u: (v: number) => string) => void;
  span: number;
}

const third = (n: number) => new Frac(n, 3);

function box(f: DiagramBuilder, l: number, h: number, w: number) {
  const d = depthVec(w);
  const F = [[0, 0], [l, 0], [l, h], [0, h]] as Pt[];
  const B = F.map((p) => add(p, d));
  f.polygon(F, { weight: 1.3 });
  f.path([F[3]!, B[3]!, B[2]!, B[1]!, F[1]!], { weight: 1.3 });
  f.segment(F[2]!, B[2]!, { weight: 1.3 });
  f.path([F[0]!, B[0]!, B[1]!], { dash: true });
  f.segment(B[0]!, B[3]!, { dash: true });
  return { F, B, d };
}

function build(rng: Rng, solid: Solid, measure: Measure): Built {
  const V = measure === 'volume';
  switch (solid) {
    case 'prism': {
      const l = rng.int(3, 14);
      const w = rng.int(2, 10);
      const h = rng.int(2, 12);
      return {
        params: { l, w, h },
        value: PiExpr.of(V ? l * w * h : 2 * (l * w + l * h + w * h)),
        formula: V ? `V = lwh = ${l} \\cdot ${w} \\cdot ${h}` : `S = 2lw + 2lh + 2wh = 2(${l * w}) + 2(${l * h}) + 2(${w * h})`,
        wrong: V ? [PiExpr.of(2 * (l * w + l * h + w * h)), PiExpr.of(l + w + h)] : [PiExpr.of(l * w * h), PiExpr.of(l * w + l * h + w * h)],
        span: Math.max(l + w * DEPTH, h + w * DEPTH),
        draw: (f, u) => {
          const { F, d } = box(f, l, h, w);
          f.sideLabel(F[0]!, F[1]!, u(l), [l / 2, h]);
          f.sideLabel(F[0]!, F[3]!, u(h), [l, h / 2]);
          f.sideLabel(F[1]!, add(F[1]!, d), u(w), [l / 2, h / 2]);
        },
      };
    }
    case 'cube': {
      const s = rng.int(2, 12);
      return {
        params: { s },
        value: PiExpr.of(V ? s ** 3 : 6 * s * s),
        formula: V ? `V = s^{3} = ${s}^{3}` : `S = 6s^{2} = 6(${s})^{2}`,
        wrong: V ? [PiExpr.of(6 * s * s), PiExpr.of(3 * s)] : [PiExpr.of(s ** 3), PiExpr.of(4 * s * s)],
        span: s * (1 + DEPTH),
        draw: (f, u) => {
          const { F } = box(f, s, s, s);
          f.sideLabel(F[0]!, F[1]!, u(s), [s / 2, s]);
        },
      };
    }
    case 'cylinder': {
      const r = rng.int(2, 10);
      const h = rng.int(2, 15);
      return {
        params: { r, h },
        value: V ? PiExpr.of(0, r * r * h) : PiExpr.of(0, 2 * r * r + 2 * r * h),
        formula: V ? `V = \\pi r^{2}h = \\pi(${r})^{2}(${h})` : `S = 2\\pi r^{2} + 2\\pi rh = 2\\pi(${r})^{2} + 2\\pi(${r})(${h})`,
        wrong: V ? [PiExpr.of(0, 2 * r * h), PiExpr.of(0, 4 * r * r * h)] : [PiExpr.of(0, r * r * h), PiExpr.of(0, r * r + 2 * r * h)],
        span: Math.max(2 * r, h + 0.7 * r),
        draw: (f, u) => {
          const ry = r * 0.35;
          f.ellipse([0, 0], r, ry, 'lower', { weight: 1.3 });
          f.ellipse([0, 0], r, ry, 'upper', { dash: true });
          f.ellipse([0, h], r, ry, 'full', { weight: 1.3 });
          f.segment([-r, 0], [-r, h], { weight: 1.3 });
          f.segment([r, 0], [r, h], { weight: 1.3 });
          f.dot([0, h]);
          f.segment([0, h], [r, h]);
          f.label([r, h], u(r), 'e');
          f.label([-r, h / 2], u(h), 'w');
        },
      };
    }
    case 'cone': {
      const [a, b, c] = rng.pick(triples(30));
      const [r, h] = rng.bool() ? [a, b] : [b, a];
      const l = c;
      return {
        params: { r, h, l },
        value: V ? PiExpr.of(0, third(r * r * h)) : PiExpr.of(0, r * r + r * l),
        formula: V ? `V = \\frac{1}{3}\\pi r^{2}h = \\frac{1}{3}\\pi(${r})^{2}(${h})` : `S = \\pi r^{2} + \\pi r\\ell = \\pi(${r})^{2} + \\pi(${r})(${l})`,
        wrong: V ? [PiExpr.of(0, r * r * h), PiExpr.of(0, third(r * r * l))] : [PiExpr.of(0, r * l), PiExpr.of(0, r * r + r * h)],
        span: Math.max(2 * r, h + 0.4 * r),
        draw: (f, u) => {
          const ry = r * 0.35;
          f.ellipse([0, 0], r, ry, 'lower', { weight: 1.3 });
          f.ellipse([0, 0], r, ry, 'upper', { dash: true });
          f.path([[-r, 0], [0, h], [r, 0]], { weight: 1.3 });
          f.dot([0, 0]);
          f.segment([0, 0], [r, 0]);
          f.label([r, 0], u(r), 'e');
          if (V) {
            f.segment([0, 0], [0, h], { dash: true });
            f.rightAngle([0, 0], [1, 0], [0, 1], 7);
            f.label([0, h / 2], u(h), 'w');
          } else {
            f.sideLabel([r, 0], [0, h], u(l), [0, 0]);
          }
        },
      };
    }
    case 'sphere': {
      const r = rng.int(2, 12);
      return {
        params: { r },
        value: V ? PiExpr.of(0, new Frac(4 * r ** 3, 3)) : PiExpr.of(0, 4 * r * r),
        formula: V ? `V = \\frac{4}{3}\\pi r^{3} = \\frac{4}{3}\\pi(${r})^{3}` : `S = 4\\pi r^{2} = 4\\pi(${r})^{2}`,
        wrong: V ? [PiExpr.of(0, new Frac(4 * r * r, 3)), PiExpr.of(0, 4 * r ** 3)] : [PiExpr.of(0, r * r), PiExpr.of(0, new Frac(4 * r ** 3, 3))],
        span: 2 * r,
        draw: (f, u) => {
          f.circle([0, 0], r, { weight: 1.3 });
          f.ellipse([0, 0], r, r * 0.3, 'lower');
          f.ellipse([0, 0], r, r * 0.3, 'upper', { dash: true });
          f.dot([0, 0]);
          f.segment([0, 0], [r, 0]);
          f.label([r, 0], u(r), 'e');
        },
      };
    }
    case 'pyramid':
    default: {
      const [a, b, c] = rng.pick(triples(26).filter(([x, y]) => Math.min(x, y) <= 10));
      const [half, h] = rng.bool() ? [a, b] : [b, a];
      const s = 2 * half;
      const l = c;
      return {
        params: { s, h, l },
        value: PiExpr.of(V ? third(s * s * h) : s * s + 2 * s * l),
        formula: V ? `V = \\frac{1}{3}s^{2}h = \\frac{1}{3}(${s})^{2}(${h})` : `S = s^{2} + 4\\left(\\frac{1}{2}s\\ell\\right) = ${s}^{2} + 2(${s})(${l})`,
        wrong: V ? [PiExpr.of(s * s * h), PiExpr.of(third(s * s * l))] : [PiExpr.of(s * s + 4 * s * l), PiExpr.of(2 * s * l)],
        span: Math.max(s * (1 + DEPTH), h + s * DEPTH),
        draw: (f, u) => {
          const d = depthVec(s);
          const P: Pt[] = [[0, 0], [s, 0], add([s, 0], d), add([0, 0], d)];
          const center = mid(P[0]!, P[2]!);
          const apex = add(center, [0, h]);
          f.path([P[3]!, P[0]!, P[1]!, P[2]!], { weight: 1.3 });
          f.path([P[2]!, P[3]!], { dash: true });
          f.segment(P[3]!, apex, { dash: true });
          for (const p of [P[0]!, P[1]!, P[2]!]) f.segment(p, apex, { weight: 1.3 });
          f.sideLabel(P[0]!, P[1]!, u(s), center);
          if (V) {
            f.segment(center, apex, { dash: true });
            f.label(mid(center, apex), u(h), 'e');
          } else {
            const foot = mid(P[0]!, P[1]!);
            f.segment(foot, apex, { dash: true });
            f.label(mid(foot, apex), u(l), 'w');
          }
        },
      };
    }
  }
}

const NAMES: Record<Solid, string> = {
  prism: 'rectangular prism',
  cube: 'cube',
  cylinder: 'cylinder',
  cone: 'cone',
  sphere: 'sphere',
  pyramid: 'square pyramid',
};

export const volumeSurfaceArea = defineTopic({
  id: 'geo.volume',
  subject: 'geometry',
  title: 'Volume & Surface Area',
  description: 'Prisms, cubes, cylinders, cones, square pyramids and spheres.',
  instruction: (o) => {
    const what = o.measure === 'surface' ? 'surface area' : o.measure === 'volume' ? 'volume' : 'indicated measure';
    return o.answerForm === 'exact' ? `Find the ${what} of each figure. Leave answers in terms of π.` : `Find the ${what} of each figure. Round to the nearest tenth.`;
  },
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'measure',
      label: 'Find',
      default: 'volume',
      choices: [
        { value: 'volume', label: 'Volume' },
        { value: 'surface', label: 'Surface area' },
        { value: 'any', label: 'Mixed' },
      ],
    },
    opt.rounding('round'),
    opt.units(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const mOpt = strOpt(ctx, 'measure');
    const measure: Measure = mOpt === 'any' ? rng.pick<Measure>(['volume', 'surface']) : (mOpt as Measure);
    const form = strOpt(ctx, 'answerForm');
    const unit = pickUnit(rng, boolOpt(ctx, 'units'));
    const solid = rng.pick(SOLIDS[difficulty]);
    const b = build(rng, solid, measure);
    const symbol = measure === 'volume' ? 'V' : 'S';
    const power = measure === 'volume' ? 3 : 2;
    const fmt = (v: PiExpr) => {
      const exact = !v.pi.isZero() || !v.rat.isInt() ? v.toTex() : undefined;
      const f = formatMeasure(v.value, form, unit, power, exact);
      return `${symbol} ${f.approx ? '\\approx' : '='} ${f.tex}`;
    };
    const answer = m(fmt(b.value));
    const fig = new DiagramBuilder(115 / b.span);
    b.draw(fig, (v) => withUnit(String(v), unit));
    const exactish = !b.value.pi.isZero() || !b.value.rat.isInt();
    return {
      question: `Find the ${measure === 'volume' ? 'volume' : 'surface area'}.`,
      answer,
      steps: [m(b.formula), m(`${symbol} = ${b.value.toTex()}${exactish ? ` \\approx ${decimal(b.value.value, 1)}` : ''}`)],
      distractors: distinctDistractors(
        answer,
        b.wrong.map((w) => m(fmt(w))),
        (k) => m(fmt(b.value.add(PiExpr.of(k * 3)))),
      ),
      diagram: fig.build(`${NAMES[solid]}; find the ${measure === 'volume' ? 'volume' : 'surface area'}`),
      check: { kind: 'solid', solid, measure, params: b.params, form },
    };
  },
});
