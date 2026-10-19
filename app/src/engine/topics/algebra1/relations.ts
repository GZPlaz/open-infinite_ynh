/** Relations and functions: discrete relations, graphed relations, evaluating functions. */
import { DiagramBuilder, graphPlane, plot, plotParam, type Diagram, type Pt, type Window } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, paren, setTex, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import type { Interval } from './helpers';

// ================================================================ discrete relations

type Pair = [number, number];

function uniqSorted(xs: number[]): number[] {
  return [...new Set(xs)].sort((a, b) => a - b);
}

function mappingDiagram(pairs: Pair[]): Diagram {
  const dom = uniqSorted(pairs.map((p) => p[0]));
  const ran = uniqSorted(pairs.map((p) => p[1]));
  const b = new DiagramBuilder(24);
  const col = (vals: number[], x: number) => {
    const n = vals.length;
    b.ellipse([x, -(n - 1) / 2], 0.75, n / 2 + 0.3, 'full', { ink: 'ink', weight: 1 });
    vals.forEach((v, i) => b.label([x, -i], String(v), 'c'));
  };
  col(dom, 0);
  col(ran, 4);
  b.label([0, Math.max(dom.length, 1) / 2 + 0.6 - (dom.length - 1) / 2], '\\text{Input}', 'n', { small: true, ink: 'muted' });
  b.label([4, Math.max(ran.length, 1) / 2 + 0.6 - (ran.length - 1) / 2], '\\text{Output}', 'n', { small: true, ink: 'muted' });
  for (const [x, y] of pairs) b.arrow([0.45, -dom.indexOf(x)], [3.55, -ran.indexOf(y)], { ink: 'accent', weight: 1 });
  return b.build('Mapping diagram of the relation');
}

function relationAnswer(dom: number[], ran: number[], fn: boolean | null): string {
  const sets = `Domain: $${setTex(dom.map(String))}$; Range: $${setTex(ran.map(String))}$`;
  return fn === null ? sets : `${sets}; ${fn ? 'Function' : 'Not a function'}`;
}

export const discreteRelations = defineTopic({
  id: 'alg1.relations.discrete',
  subject: 'algebra1',
  category: 'Relations and Introduction to Functions',
  title: 'Discrete Relations',
  description: 'State the domain and range of a relation given as ordered pairs, a table or a mapping diagram, and decide whether it is a function.',
  instruction: (o) => (o.verdict === false ? 'State the domain and range of each relation.' : 'State the domain and range of each relation. Then determine whether the relation is a function.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Relation given as',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'pairs', label: 'Ordered pairs' },
        { value: 'table', label: 'Table' },
        { value: 'mapping', label: 'Mapping diagram' },
      ],
    },
    opt.negatives(true),
    { type: 'boolean', id: 'verdict', label: 'Ask whether it is a function', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const verdict = boolOpt(ctx, 'verdict');
    const formOpt = strOpt(ctx, 'form');
    const form = formOpt === 'mixed' ? rng.pick(['pairs', 'table', 'mapping']) : formOpt;
    const n = d === 'easy' ? rng.int(3, 4) : d === 'medium' ? rng.int(4, 5) : rng.int(5, 6);
    const R = d === 'easy' ? 9 : 12;
    const val = () => (negatives ? rng.int(-R, R) : rng.int(0, R));
    const isFn = rng.bool(0.5);
    const pairs = attempt('discrete relation', () => {
      const xs = [...new Set(Array.from({ length: n + 3 }, val))].slice(0, isFn ? n : n - 1);
      if (xs.length < (isFn ? n : n - 1)) return null;
      const out: Pair[] = xs.map((x) => [x, val()]);
      if (!isFn) {
        const [x, y] = rng.pick(out);
        const y2 = val();
        if (y2 === y) return null;
        out.push([x, y2]);
      } else if (d !== 'easy' && rng.bool(0.5)) {
        // many-to-one is still a function
        out[1] = [out[1]![0], out[0]![1]];
      }
      return rng.shuffle(out);
    });
    const dom = uniqSorted(pairs.map((p) => p[0]));
    const ran = uniqSorted(pairs.map((p) => p[1]));
    let question: string;
    let diagram: Diagram | undefined;
    if (form === 'pairs') question = m(`\\left\\{ ${pairs.map(([x, y]) => `(${x}, ${y})`).join(', ')} \\right\\}`);
    else if (form === 'table') {
      question = m(`\\begin{array}{c|${'c'.repeat(pairs.length)}} x & ${pairs.map((p) => p[0]).join(' & ')} \\\\ \\hline y & ${pairs.map((p) => p[1]).join(' & ')} \\end{array}`);
    } else {
      question = 'The relation shown in the mapping diagram.';
      diagram = mappingDiagram(pairs);
    }
    const fn = verdict ? isFn : null;
    const answer = relationAnswer(dom, ran, fn);
    const steps = [
      `The domain is the set of inputs ($x$-values): $${setTex(dom.map(String))}$.`,
      `The range is the set of outputs ($y$-values): $${setTex(ran.map(String))}$.`,
    ];
    if (verdict) {
      if (isFn) steps.push('Each input is paired with exactly one output, so the relation is a function.');
      else {
        const x = pairs.find((p, i) => pairs.findIndex((q) => q[0] === p[0]) !== i)![0];
        const ys = pairs.filter((p) => p[0] === x).map((p) => p[1]);
        steps.push(`The input $${x}$ is paired with $${ys.join('$ and $')}$, so the relation is not a function.`);
      }
    }
    const all = uniqSorted([...dom, ...ran]);
    const flip = verdict ? !isFn : null;
    const distractors = distinctDistractors(
      answer,
      [
        relationAnswer(ran, dom, fn),
        verdict ? relationAnswer(dom, ran, flip) : relationAnswer(all, ran, null),
        verdict ? relationAnswer(ran, dom, flip) : relationAnswer(dom, all, null),
        relationAnswer(dom, ran.length > 1 ? ran.slice(1) : [ran[0]! + 1], fn),
      ],
      (k) => relationAnswer(uniqSorted([...dom, Math.max(...dom) + k]), ran, fn),
    );
    return { question, answer, steps, distractors, diagram, check: { kind: 'algebra1.relation', verdict } };
  },
});

// ================================================================ continuous relations

const RANGE = 6;

interface Shape {
  draw(b: DiagramBuilder, w: Window): void;
  domain: Interval;
  range: Interval;
  fn: boolean;
  describe: string;
}

const closed = (lo: number, hi: number): Interval => ({ lo, hi, loOpen: false, hiOpen: false });
const ALL_IV: Interval = { lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true };
const CURVE = { weight: 1.8, ink: 'accent' as const, role: 'curve' as const };

/** Arrowheads at both ends of the curve paths added since `from`. */
function arrowEnds(b: DiagramBuilder, from: number): void {
  const paths = b.items.slice(from).filter((it) => it.t === 'path' && it.role === 'curve') as Array<{ pts: Pt[] }>;
  if (!paths.length) return;
  const first = paths[0]!.pts;
  const last = paths[paths.length - 1]!.pts;
  b.arrow(first[1]!, first[0]!, { ink: 'accent', weight: 1.8 });
  b.arrow(last[last.length - 2]!, last[last.length - 1]!, { ink: 'accent', weight: 1.8 });
}

function plotWithArrows(b: DiagramBuilder, f: (x: number) => number, w: Window): void {
  const n = b.items.length;
  plot(b, f, w);
  arrowEnds(b, n);
}

/** Domain/range of a polyline (vertices in order) with optionally open endpoints. */
function polylineSets(v: Pt[], openStart: boolean, openEnd: boolean): { domain: Interval; range: Interval } {
  const ext = (k: 0 | 1, pick: (a: number, b: number) => number) => {
    const target = v.map((p) => p[k]).reduce((a, b) => pick(a, b));
    const hits = v.map((p, i) => [p, i] as const).filter(([p]) => p[k] === target);
    const open = hits.every(([, i]) => (i === 0 && openStart) || (i === v.length - 1 && openEnd));
    return { target, open };
  };
  const xlo = ext(0, Math.min);
  const xhi = ext(0, Math.max);
  const ylo = ext(1, Math.min);
  const yhi = ext(1, Math.max);
  return {
    domain: { lo: xlo.target, hi: xhi.target, loOpen: xlo.open, hiOpen: xhi.open },
    range: { lo: ylo.target, hi: yhi.target, loOpen: ylo.open, hiOpen: yhi.open },
  };
}

function makeShape(rng: Rng, kind: string): Shape | null {
  const pt = (r = 5): Pt => [rng.int(-r, r), rng.int(-r, r)];
  switch (kind) {
    case 'segment':
    case 'polyline':
    case 'open': {
      const k = kind === 'segment' ? 2 : rng.int(3, 4);
      const xs = rng.sample([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5], k).sort((a, b) => a - b);
      const v: Pt[] = xs.map((x) => [x, rng.int(-5, 5)]);
      if (v.some((p, i) => i > 0 && p[1] === v[i - 1]![1]) && rng.bool(0.7)) return null;
      const openStart = kind === 'open' && rng.bool(0.6);
      const openEnd = kind === 'open' && (!openStart || rng.bool(0.5));
      const sets = polylineSets(v, openStart, openEnd);
      if (sets.range.lo === sets.range.hi) return null;
      return {
        draw(b) {
          b.path(v, CURVE);
          b.dot(v[0]!, openStart, 'accent');
          b.dot(v[v.length - 1]!, openEnd, 'accent');
        },
        ...sets,
        fn: true,
        describe: 'Every vertical line crosses the graph at most once',
      };
    }
    case 'vsegment': {
      const x = rng.int(-5, 5);
      const y1 = rng.int(-5, 2);
      const y2 = y1 + rng.int(2, 7);
      if (y2 > 5) return null;
      return {
        draw(b) {
          b.path([[x, y1], [x, y2]], CURVE);
          b.dot([x, y1], false, 'accent');
          b.dot([x, y2], false, 'accent');
        },
        domain: closed(x, x),
        range: closed(y1, y2),
        fn: false,
        describe: `The vertical line $x = ${x}$ crosses the graph more than once`,
      };
    }
    case 'line': {
      const horizontal = rng.bool(0.25);
      const mm = horizontal ? 0 : rng.pick([-3, -2, -1, -0.5, 0.5, 1, 2, 3]);
      const c = rng.int(-4, 4);
      return {
        draw: (b, w) => plotWithArrows(b, (x) => mm * x + c, w),
        domain: ALL_IV,
        range: horizontal ? closed(c, c) : ALL_IV,
        fn: true,
        describe: 'Every vertical line crosses the graph exactly once',
      };
    }
    case 'parabola':
    case 'abs': {
      const [h, k] = pt(3);
      const a = rng.pick([-2, -1, -0.5, 0.5, 1, 2]);
      const f = kind === 'abs' ? (x: number) => a * Math.abs(x - h) + k : (x: number) => a * (x - h) ** 2 + k;
      return {
        draw: (b, w) => plotWithArrows(b, f, w),
        domain: ALL_IV,
        range: a > 0 ? { lo: k, hi: Infinity, loOpen: false, hiOpen: true } : { lo: -Infinity, hi: k, loOpen: true, hiOpen: false },
        fn: true,
        describe: 'Every vertical line crosses the graph exactly once',
      };
    }
    case 'sideways': {
      const [h, k] = pt(3);
      const a = rng.pick([-1, -0.5, 0.5, 1]);
      return {
        draw(b, w) {
          const n = b.items.length;
          plotParam(b, (t) => a * (t - k) ** 2 + h, (t) => t, -RANGE, RANGE, w);
          arrowEnds(b, n);
        },
        domain: a > 0 ? { lo: h, hi: Infinity, loOpen: false, hiOpen: true } : { lo: -Infinity, hi: h, loOpen: true, hiOpen: false },
        range: ALL_IV,
        fn: false,
        describe: 'A vertical line crosses the graph twice',
      };
    }
    case 'circle':
    case 'semicircle': {
      const r = rng.int(2, 4);
      const h = rng.int(-5 + r, 5 - r);
      const k = rng.int(-5 + r, 5 - r);
      const upper = rng.bool();
      const half = kind === 'semicircle';
      const [t0, t1] = !half ? [0, 2 * Math.PI] : upper ? [0, Math.PI] : [Math.PI, 2 * Math.PI];
      return {
        draw(b, w) {
          plotParam(b, (t) => h + r * Math.cos(t), (t) => k + r * Math.sin(t), t0, t1, w);
          if (half) {
            b.dot([h - r, k], false, 'accent');
            b.dot([h + r, k], false, 'accent');
          }
        },
        domain: closed(h - r, h + r),
        range: !half ? closed(k - r, k + r) : upper ? closed(k, k + r) : closed(k - r, k),
        fn: half,
        describe: half ? 'Every vertical line crosses the graph at most once' : 'A vertical line through the center crosses the graph twice',
      };
    }
  }
  return null;
}

/** `-3 \le x < 4`, `x \ge 1`, `x = 2`, or null for all real numbers. */
export function intervalTex(v: string, iv: Interval): string | null {
  const lo = Number.isFinite(iv.lo);
  const hi = Number.isFinite(iv.hi);
  if (!lo && !hi) return null;
  if (lo && hi && iv.lo === iv.hi) return `${v} = ${num(iv.lo)}`;
  if (lo && hi) return `${num(iv.lo)} ${iv.loOpen ? '<' : '\\le'} ${v} ${iv.hiOpen ? '<' : '\\le'} ${num(iv.hi)}`;
  if (lo) return `${v} ${iv.loOpen ? '>' : '\\ge'} ${num(iv.lo)}`;
  return `${v} ${iv.hiOpen ? '<' : '\\le'} ${num(iv.hi)}`;
}

const ivRich = (v: string, iv: Interval) => {
  const t = intervalTex(v, iv);
  return t === null ? 'All real numbers' : m(t);
};

function contAnswer(dom: Interval, ran: Interval, fn: boolean | null): string {
  const s = `Domain: ${ivRich('x', dom)}; Range: ${ivRich('y', ran)}`;
  return fn === null ? s : `${s}; ${fn ? 'Function' : 'Not a function'}`;
}

const SHAPES: Record<Difficulty, string[]> = {
  easy: ['segment', 'vsegment', 'line', 'polyline'],
  medium: ['parabola', 'circle', 'abs', 'sideways', 'polyline', 'vsegment'],
  hard: ['open', 'semicircle', 'sideways', 'circle', 'parabola', 'open'],
};

export const continuousRelations = defineTopic({
  id: 'alg1.relations.continuous',
  subject: 'algebra1',
  category: 'Relations and Introduction to Functions',
  title: 'Continuous Relations',
  description: 'Read the domain and range of a graphed relation and use the vertical line test.',
  instruction: (o) => (o.verdict === false ? 'State the domain and range of each relation.' : 'State the domain and range of each relation. Then determine whether the relation is a function.'),
  multipleChoice: true,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'verdict', label: 'Ask whether it is a function', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const verdict = boolOpt(ctx, 'verdict');
    const kind = rng.pick(SHAPES[d]);
    const shape = attempt('continuous relation', () => makeShape(rng, kind));
    const { b, w } = graphPlane(RANGE, 1, 13);
    shape.draw(b, w);
    const diagram = b.build('Graph of a relation');
    const fn = verdict ? shape.fn : null;
    const answer = contAnswer(shape.domain, shape.range, fn);
    const steps = [`Domain (the $x$-values the graph covers): ${ivRich('x', shape.domain)}`, `Range (the $y$-values the graph covers): ${ivRich('y', shape.range)}`];
    if (verdict) steps.push(`${shape.describe}, so the relation is ${shape.fn ? '' : 'not '}a function.`);
    const flipStrict = (iv: Interval): Interval =>
      Number.isFinite(iv.lo) && iv.lo !== iv.hi ? { ...iv, loOpen: !iv.loOpen } : Number.isFinite(iv.hi) && iv.lo !== iv.hi ? { ...iv, hiOpen: !iv.hiOpen } : { lo: iv.lo === -Infinity ? 0 : iv.lo, hi: Infinity, loOpen: false, hiOpen: true };
    const bump = (iv: Interval, k: number): Interval => (Number.isFinite(iv.lo) || Number.isFinite(iv.hi) ? { ...iv, lo: iv.lo - k, hi: iv.hi + k } : closed(-k, k));
    const distractors = distinctDistractors(
      answer,
      [
        contAnswer(shape.range, shape.domain, fn),
        verdict ? contAnswer(shape.domain, shape.range, !shape.fn) : contAnswer(flipStrict(shape.domain), shape.range, null),
        contAnswer(flipStrict(shape.domain), flipStrict(shape.range), fn),
        verdict ? contAnswer(shape.range, shape.domain, !shape.fn) : contAnswer(shape.domain, flipStrict(shape.range), null),
      ],
      (k) => (k % 2 ? contAnswer(bump(shape.domain, (k + 1) / 2), shape.range, fn) : contAnswer(shape.domain, bump(shape.range, k / 2), fn)),
    );
    return { question: 'The relation graphed below.', answer, steps, distractors, diagram, check: { kind: 'algebra1.contRelation', verdict, range: RANGE } };
  },
});

// ================================================================ evaluating functions

type FnKind = 'linear' | 'quadratic' | 'abs' | 'exponential' | 'cubic';

const FN_NAMES = ['f', 'g', 'h', 'p', 'w', 'k'];

interface Fn {
  kind: FnKind;
  /** Polynomial part (linear/quadratic/cubic), the inside of |…| for abs. */
  poly: Poly;
  /** abs: outer constant; exponential: base. */
  c: number;
  scale: number;
}

function fnTex(f: Fn, v: string): string {
  if (f.kind === 'abs') return sum([{ coef: f.scale, sym: `\\left|${f.poly.toTex(v)}\\right|` }, { coef: f.c }]);
  if (f.kind === 'exponential') {
    const base = `${f.c}^{${v}}`;
    const lead = f.scale === 1 ? base : f.scale === -1 ? `-${base}` : `${f.scale} \\cdot ${base}`;
    const k = f.poly.coef(0);
    return k.isZero() ? lead : `${lead} ${k.sign < 0 ? '-' : '+'} ${num(k.abs())}`;
  }
  return f.poly.toTex(v);
}

function fnValue(f: Fn, x: Frac): Frac {
  if (f.kind === 'abs') return f.poly.eval(x).abs().mul(f.scale).add(f.c);
  if (f.kind === 'exponential') return new Frac(f.c).pow(x.n).mul(f.scale).add(f.poly.coef(0));
  return f.poly.eval(x);
}

/** p(q(t)) for a polynomial q. */
function compose(p: Poly, q: Poly): Poly {
  let out = Poly.of(0);
  for (let i = p.degree; i >= 0; i--) out = out.mul(q).add(Poly.of(p.coef(i)));
  return out;
}

export const evaluatingFunctions = defineTopic({
  id: 'alg1.functions.evaluate',
  subject: 'algebra1',
  category: 'Relations and Introduction to Functions',
  title: 'Evaluating Functions',
  description: 'Evaluate functions in function notation at numbers and at expressions.',
  instruction: 'Evaluate each function.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'input',
      label: 'Inputs',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Numbers and expressions' },
        { value: 'number', label: 'Numbers only' },
        { value: 'expression', label: 'Expressions (medium and hard)' },
      ],
    },
    opt.negatives(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const input = strOpt(ctx, 'input');
    const exprInput = d !== 'easy' && (input === 'expression' || (input === 'mixed' && rng.bool(0.4)));
    const kinds: FnKind[] = d === 'easy' ? ['linear', 'linear', 'quadratic', 'abs'] : d === 'medium' ? ['linear', 'quadratic', 'abs', 'exponential'] : ['quadratic', 'abs', 'cubic', 'exponential'];
    const kind = rng.pick(exprInput ? kinds.filter((k) => k !== 'exponential') : kinds);
    const name = rng.pick(FN_NAMES);
    const v = rng.pick(['x', 'x', 'n', 't', 'a'].filter((l) => l !== name));
    const C = (max: number) => rng.signedInt(1, max, negatives);
    const f: Fn = attempt('function', () => {
      switch (kind) {
        case 'linear':
          return { kind, poly: Poly.of(rng.signedInt(0, 9, negatives), C(d === 'easy' ? 5 : 8)), c: 0, scale: 1 };
        case 'quadratic':
          return { kind, poly: Poly.of(rng.signedInt(0, 9, negatives), rng.signedInt(0, 6, negatives), d === 'easy' ? 1 : C(3)), c: 0, scale: 1 };
        case 'cubic':
          return { kind, poly: Poly.of(rng.signedInt(0, 9, negatives), rng.signedInt(0, 4, negatives), 0, C(2)), c: 0, scale: 1 };
        case 'abs':
          return { kind, poly: Poly.of(rng.signedInt(0, 6, negatives), d === 'easy' ? 1 : C(3)), c: rng.signedInt(0, 6, negatives), scale: d === 'hard' ? C(3) : 1 };
        case 'exponential':
          return { kind, poly: Poly.of(rng.signedInt(0, 5, negatives)), c: rng.pick([2, 3]), scale: d === 'hard' ? C(3) : 1 };
      }
    });
    const def = `${name}(${v}) = ${fnTex(f, v)}`;
    let call: string;
    let answer: string;
    let steps: string[];
    let wrong: Array<string | null>;
    let fallback: (k: number) => string;
    if (!exprInput) {
      const R = kind === 'exponential' ? (d === 'hard' ? 4 : 3) : kind === 'cubic' ? 3 : d === 'easy' ? 5 : 8;
      const x = attempt('input', () => {
        const x = kind === 'exponential' ? rng.int(d === 'hard' ? -2 : 0, R) : rng.signedInt(0, R, negatives);
        if (kind === 'exponential' && f.c ** Math.abs(x) > 30) return null;
        return x;
      });
      const X = new Frac(x);
      const val = fnValue(f, X);
      call = `${name}(${x})`;
      answer = m(`${call} = ${num(val)}`);
      const subbed = fnTex(f, paren(x));
      steps = [`Substitute $${v} = ${x}$: $${call} = ${subbed}$`, `$${call} = ${num(val)}$`];
      const sq = (k: number) => (x < 0 && k % 2 === 0 ? -1 : 1);
      // (-3)^2 read as -3^2
      const signSlip = f.kind === 'quadratic' || f.kind === 'cubic' ? f.poly.c.reduce((s, c, i) => s.add(c.mul(new Frac(x).pow(i)).mul(sq(i))), new Frac(0)) : null;
      wrong = [
        m(`${call} = ${num(fnValue(f, X.neg()))}`),
        signSlip && !signSlip.eq(val) ? m(`${call} = ${num(signSlip)}`) : null,
        m(`${call} = ${num(val.neg())}`),
        f.kind === 'exponential' ? m(`${call} = ${num(new Frac(f.c * x).mul(f.scale).add(f.poly.coef(0)))}`) : null,
      ];
      fallback = (k) => m(`${call} = ${num(val.add(offset(k)))}`);
    } else {
      const t = rng.pick(['n', 'a', 't', 'x', 'k'].filter((l) => l !== name && l !== v));
      const argPoly = d === 'medium' ? (rng.bool(0.5) ? Poly.of(rng.signedInt(1, 5, negatives), 1) : Poly.of(0, rng.signedInt(2, 4, negatives))) : rng.bool(0.3) ? Poly.of(0, 0, 1) : Poly.of(rng.signedInt(1, 4, negatives), rng.signedInt(1, 3, negatives));
      const argTex = argPoly.toTex(t);
      call = `${name}(${argTex})`;
      const resultTex = (p: Poly) => (f.kind === 'abs' ? sum([{ coef: f.scale, sym: `\\left|${p.toTex(t)}\\right|` }, { coef: f.c }]) : p.toTex(t));
      const correct = compose(f.poly, argPoly);
      answer = m(`${call} = ${resultTex(correct)}`);
      const subbed = f.kind === 'abs' ? sum([{ coef: f.scale, sym: `\\left|${f.poly.toTex(`(${argTex})`)}\\right|` }, { coef: f.c }]) : f.poly.toTex(`(${argTex})`);
      steps = [`Replace $${v}$ with $${argTex}$: $${call} = ${subbed}$`, `Simplify: $${call} = ${resultTex(correct)}$`];
      // forgetting to distribute: a·t + k instead of a(t + k) in the linear term
      const lin = f.poly.coef(1);
      const noDist = correct.sub(Poly.of(argPoly.coef(0)).scale(lin)).add(Poly.of(argPoly.coef(0)));
      // squaring termwise: (t + k)^2 → t^2 + k^2
      const a2 = f.poly.coef(2);
      const b1 = argPoly.coef(1);
      const c0 = argPoly.coef(0);
      const sqSlip = f.poly.degree === 2 ? correct.sub(argPoly.mul(argPoly).scale(a2)).add(Poly.of(c0.mul(c0), 0, b1.mul(b1)).scale(a2)) : null;
      wrong = [
        m(`${call} = ${resultTex(noDist)}`),
        sqSlip ? m(`${call} = ${resultTex(sqSlip)}`) : null,
        m(`${call} = ${resultTex(compose(f.poly, argPoly.scale(-1)))}`),
        m(`${call} = ${resultTex(correct.add(Poly.of(argPoly.coef(0) || 1)))}`),
      ];
      fallback = (k) => m(`${call} = ${resultTex(correct.add(Poly.of(offset(k))))}`);
    }
    return {
      question: `${m(def)}; Find ${m(call)}`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong, fallback),
      check: { kind: 'algebra1.evalfn' },
    };
  },
});
