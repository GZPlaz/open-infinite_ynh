/** Double and triple integrals: iterated integrals, general regions, order reversal, polar, cylindrical, spherical, applications. */
import { Frac } from '../../fraction';
import { offset } from '../../generator';
import type { Rng } from '../../rng';
import { m, num } from '../../tex';
import type { Difficulty } from '../../types';
import {
  constOf,
  cosPi,
  cst,
  definite,
  ex,
  exAdd,
  exMul,
  exPi,
  exScale,
  exTex,
  exVal,
  mt,
  norm,
  piTex,
  randMono,
  taskTopic,
  tex,
  vr,
  type Ex,
  type MX,
} from './common';

const CAT = 'Multiple Integrals';

export interface BT {
  v: string;
  lo: string;
  hi: string;
}
interface B {
  v: string;
  lo: MX;
  hi: MX;
}

const bodyTex = (f: MX | string) => {
  const t = typeof f === 'string' ? f : tex(f);
  if (t === '1') return '';
  return typeof f !== 'string' && norm(f).length > 1 ? `(${t})` : t;
};

/** `\int_{a}^{b}\int_{c}^{d} f \,dy\,dx` from bounds listed outer → inner. */
export function iterTex(f: MX | string, bs: readonly BT[]): string {
  const b = bodyTex(f);
  const ds = [...bs].reverse().map((x) => `d${x.v}`).join('\\,');
  return `\\displaystyle ${bs.map((x) => `\\int_{${x.lo}}^{${x.hi}}`).join('')} ${b ? `${b}\\,` : ''}${ds}`;
}

const btex = (b: B): BT => ({ v: b.v, lo: tex(b.lo), hi: tex(b.hi) });

/** Exact value of a polynomial iterated integral with polynomial bounds (outer → inner). */
export function exactIter(f: MX, bs: readonly B[]): Frac {
  let g = norm(f);
  for (let i = bs.length - 1; i >= 0; i--) g = definite(g, bs[i]!.v, bs[i]!.lo, bs[i]!.hi);
  return constOf(g);
}

/** Set-builder region `D = \{(x, y) \mid …\}` from bounds (outer → inner). */
export function regionTex(name: string, vars: readonly string[], bs: readonly BT[]): string {
  return `${name} = \\left\\{(${vars.join(', ')}) \\mid ${bs.map((b) => `${b.lo} \\le ${b.v} \\le ${b.hi}`).join(',\\ ')}\\right\\}`;
}

function randPolyF(rng: Rng, vars: readonly string[], maxDeg: number, n: number, cmax = 6): MX {
  for (;;) {
    const f = norm(Array.from({ length: n }, () => mt(rng.signedInt(1, cmax, true), randMono(rng, vars, 0, maxDeg))));
    if (f.length === n && f.some((t) => Object.keys(t.e).length)) return f;
  }
}

const valAns = (e: Ex | Frac) => m(e instanceof Frac ? num(e) : exTex(e));
const fallbackVal = (v: Frac) => (k: number) => valAns(v.add(offset(k)));

// ---------------------------------------------------------------- rectangles

type RTask = 'iterated' | 'region';

export const doubleRect = taskTopic<RTask>({
  id: 'mv.integrals.rectangles',
  title: 'Double Integrals over Rectangles',
  description: 'Iterated integrals and double integrals over rectangular regions.',
  category: CAT,
  instruction: 'Evaluate each integral.',
  tasks: [
    { value: 'iterated', label: 'Iterated integrals' },
    { value: 'region', label: 'Double integral over R' },
  ],
  mix: { easy: ['iterated'], medium: ['iterated', 'region'], hard: ['iterated', 'region'] },
  build(task, { rng, difficulty }) {
    const lo1 = difficulty === 'easy' ? 0 : rng.int(-2, 1);
    const hi1 = lo1 + rng.int(1, 3);
    const lo2 = difficulty === 'easy' ? rng.int(0, 1) : rng.int(-2, 1);
    const hi2 = lo2 + rng.int(1, 3);
    const xb: B = { v: 'x', lo: cst(lo1), hi: cst(hi1) };
    const yb: B = { v: 'y', lo: cst(lo2), hi: cst(hi2) };
    const yFirst = rng.bool(0.5);
    const order = yFirst ? [xb, yb] : [yb, xb];
    if (difficulty === 'hard' && rng.bool(0.5)) {
      // separable c·xⁱ·q(y) with q = e^{y}, sin y or cos y
      const c = rng.signedInt(1, 4, true);
      const i = rng.int(0, 2);
      const q = rng.pick([
        { tex: 'e^{y}', lo: '0', hi: `\\ln ${2}`, val: new Frac(1) },
        { tex: 'e^{y}', lo: '0', hi: `\\ln ${3}`, val: new Frac(2) },
        { tex: '\\sin y', lo: '0', hi: '\\pi', val: new Frac(2) },
        { tex: '\\sin y', lo: '0', hi: '\\frac{\\pi}{2}', val: new Frac(1) },
        { tex: '\\cos y', lo: '0', hi: '\\frac{\\pi}{2}', val: new Frac(1) },
      ]);
      const X = constOf(definite([mt(c, i ? { x: i } : {})], 'x', cst(0), cst(hi1 - lo1)));
      const xs = { v: 'x', lo: '0', hi: String(hi1 - lo1) };
      const ys = { v: 'y', lo: q.lo, hi: q.hi };
      const body = `${tex([mt(c, i ? { x: i } : {})]).replace(/^(-?)1$/, '$1')}${q.tex}`;
      const v = X.mul(q.val);
      return {
        question: m(iterTex(body, yFirst ? [xs, ys] : [ys, xs])),
        answer: valAns(v),
        steps: [`The integrand is a product of a function of ${m('x')} and a function of ${m('y')}, so the integral factors.`, m(`\\left(\\int_{${xs.lo}}^{${xs.hi}} ${tex([mt(c, i ? { x: i } : {})])}\\,dx\\right)\\left(\\int_{${q.lo}}^{${q.hi}} ${q.tex}\\,dy\\right) = (${num(X)})(${num(q.val)})`), valAns(v)],
        wrongs: [valAns(v.neg()), valAns(X), valAns(v.mul(2))],
        fallback: fallbackVal(v),
        check: { kind: 'multivariable.integral' },
      };
    }
    const f = randPolyF(rng, ['x', 'y'], difficulty === 'easy' ? 2 : 3, difficulty === 'easy' ? rng.int(1, 2) : rng.int(2, 3));
    const v = exactIter(f, order);
    const swapped = exactIter(f, [
      { v: 'x', lo: cst(lo2), hi: cst(hi2) },
      { v: 'y', lo: cst(lo1), hi: cst(hi1) },
    ]);
    const steps = [m(`\\int_{${tex(order[1]!.lo)}}^{${tex(order[1]!.hi)}} ${bodyTex(f) || '1'}\\,d${order[1]!.v} = ${tex(definite(f, order[1]!.v, order[1]!.lo, order[1]!.hi))}`), valAns(v)];
    const question =
      task === 'region'
        ? `${m(`\\displaystyle \\iint_{R} ${bodyTex(f)}\\,dA`)}, ${m(`R = [${lo1}, ${hi1}] \\times [${lo2}, ${hi2}]`)}`
        : m(iterTex(f, order.map(btex)));
    return {
      question,
      answer: valAns(v),
      steps,
      wrongs: [valAns(swapped.eq(v) ? v.add(1) : swapped), valAns(v.neg()), valAns(v.mul(2))],
      fallback: fallbackVal(v),
      check: { kind: 'multivariable.integral' },
    };
  },
});

// ---------------------------------------------------------------- general regions

interface Region2 {
  outer: B;
  inner: B;
}

/** Type I (x outer) or type II (y outer) regions with polynomial bounds, all in the first quadrant. */
function region2(rng: Rng, d: Difficulty, typeII: boolean): Region2 {
  const [u, w] = typeII ? ['y', 'x'] : ['x', 'y'];
  const k = rng.int(1, 3);
  const a = rng.int(1, 3);
  const pick = rng.pick(d === 'easy' ? ['tri', 'under', 'between'] : ['tri', 'under', 'between', 'parab', 'cubic', 'top']);
  switch (pick) {
    case 'tri':
      return { outer: { v: u, lo: cst(0), hi: cst(a) }, inner: { v: w, lo: cst(0), hi: vr(u, k) } };
    case 'under':
      return { outer: { v: u, lo: cst(0), hi: cst(a) }, inner: { v: w, lo: cst(0), hi: [mt(1, { [u]: 2 })] } };
    case 'between':
      return { outer: { v: u, lo: cst(0), hi: cst(a) }, inner: { v: w, lo: vr(u), hi: vr(u, k + 1) } };
    case 'parab':
      return { outer: { v: u, lo: cst(0), hi: cst(k) }, inner: { v: w, lo: [mt(1, { [u]: 2 })], hi: vr(u, k) } };
    case 'cubic':
      return { outer: { v: u, lo: cst(0), hi: cst(1) }, inner: { v: w, lo: [mt(1, { [u]: 3 })], hi: vr(u) } };
    case 'top':
    default:
      return { outer: { v: u, lo: cst(0), hi: cst(a) }, inner: { v: w, lo: vr(u), hi: cst(a) } };
  }
}

type GTask = 'iterated' | 'region' | 'area' | 'volume';

export const doubleGeneral = taskTopic<GTask>({
  id: 'mv.integrals.general-regions',
  title: 'Double Integrals over General Regions',
  description: 'Iterated integrals with variable limits, double integrals over type I and type II regions, areas and volumes.',
  category: CAT,
  instruction: 'Evaluate each integral or find the indicated quantity.',
  tasks: [
    { value: 'iterated', label: 'Iterated integral with variable limits' },
    { value: 'region', label: 'Double integral over a region' },
    { value: 'area', label: 'Area of a region' },
    { value: 'volume', label: 'Volume under a surface' },
  ],
  mix: { easy: ['iterated', 'area'], medium: ['iterated', 'region', 'area', 'volume'], hard: ['region', 'volume', 'iterated'] },
  build(task, { rng, difficulty }) {
    const typeII = difficulty !== 'easy' && rng.bool(0.4);
    const R = region2(rng, difficulty, typeII);
    const bs = [R.outer, R.inner];
    const Dtex = regionTex('D', ['x', 'y'], bs.map(btex));
    const area = exactIter(cst(1), bs);
    switch (task) {
      case 'area': {
        return {
          question: `Find the area of the region ${m(Dtex)}.`,
          answer: m(`A = ${num(area)}`),
          steps: [m(`A = ${iterTex('1', bs.map(btex))} = ${num(area)}`)],
          wrongs: [m(`A = ${num(area.mul(2))}`), m(`A = ${num(exactIter(cst(1), [{ ...R.outer, hi: R.outer.hi }, { ...R.inner, lo: cst(0) }]).eq(area) ? area.add(1) : exactIter(cst(1), [R.outer, { ...R.inner, lo: cst(0) }]))}`), m(`A = ${num(area.div(2))}`)],
          fallback: (k) => m(`A = ${num(area.add(offset(k)))}`),
          check: { kind: 'multivariable.integral', over: 'D', body: '1' },
        };
      }
      case 'volume': {
        const f = norm([mt(rng.int(1, 4)), mt(rng.int(1, 3), randMono(rng, ['x', 'y'], 1, 2))]);
        const v = exactIter(f, bs);
        return {
          question: `Find the volume of the solid under ${m(`z = ${tex(f)}`)} and above ${m(Dtex)}.`,
          answer: m(`V = ${num(v)}`),
          steps: [m(`V = \\iint_{D} ${bodyTex(f)}\\,dA = ${iterTex(f, bs.map(btex))}`), m(`V = ${num(v)}`)],
          wrongs: [m(`V = ${num(v.mul(2))}`), m(`V = ${num(area)}`), m(`V = ${num(v.add(area))}`)],
          fallback: (k) => m(`V = ${num(v.add(offset(k)))}`),
          check: { kind: 'multivariable.integral', over: 'D', body: 'z' },
        };
      }
      default: {
        const f = randPolyF(rng, ['x', 'y'], 2, difficulty === 'easy' ? 1 : 2);
        const v = exactIter(f, bs);
        const flipped = exactIter(f, [R.outer, { ...R.inner, lo: R.inner.hi, hi: R.inner.lo }]);
        const question = task === 'region' ? `${m(`\\displaystyle \\iint_{D} ${bodyTex(f)}\\,dA`)}, ${m(Dtex)}` : m(iterTex(f, bs.map(btex)));
        return {
          question,
          answer: valAns(v),
          steps: [m(`\\int_{${tex(R.inner.lo)}}^{${tex(R.inner.hi)}} ${bodyTex(f) || '1'}\\,d${R.inner.v} = ${tex(definite(f, R.inner.v, R.inner.lo, R.inner.hi))}`), valAns(v)],
          wrongs: [valAns(flipped.eq(v) ? v.add(2) : flipped), valAns(v.mul(2)), valAns(v.add(area))],
          fallback: fallbackVal(v),
          check: { kind: 'multivariable.integral' },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- reversing the order

interface Rev {
  orig: BT[];
  rev: BT[];
  wrong: BT[][];
  body: string;
  value: Ex;
}

function reversal(rng: Rng, d: Difficulty): Rev {
  const a = rng.int(1, 3);
  const special = d !== 'easy' && rng.bool(0.6);
  const t = rng.pick(special ? ['tri', 'sqrt'] : ['tri', 'sqrt', 'under', 'top']);
  const sq = (n: number) => n * n;
  const s = (n: number) => (n === 1 ? '' : String(n));
  switch (t) {
    case 'tri': {
      // ∫_0^a ∫_x^a f dy dx  =  ∫_0^a ∫_0^y f dx dy
      if (special) {
        const g = rng.pick([
          { body: 'e^{y^{2}}', a: '1', val: exAdd(ex(new Frac(1, 2), { sym: 'e', val: Math.E }), ex(new Frac(-1, 2))) },
          { body: 'e^{y^{2}}', a: '2', val: exAdd(ex(new Frac(1, 2), { sym: 'e^{4}', val: Math.E ** 4 }), ex(new Frac(-1, 2))) },
          { body: '\\sin(y^{2})', a: '\\sqrt{\\pi}', val: ex(1) },
          { body: `${s(2 * a)}\\cos(y^{2})`, a: '\\sqrt{\\frac{\\pi}{2}}', val: ex(a) },
          { body: '\\frac{y}{1 + y^{3}}', a: '1', val: ex(new Frac(1, 3), { sym: '\\ln 2', val: Math.log(2) }) },
        ]);
        const A = g.a;
        return {
          orig: [{ v: 'x', lo: '0', hi: A }, { v: 'y', lo: 'x', hi: A }],
          rev: [{ v: 'y', lo: '0', hi: A }, { v: 'x', lo: '0', hi: 'y' }],
          wrong: [
            [{ v: 'y', lo: '0', hi: A }, { v: 'x', lo: 'y', hi: A }],
            [{ v: 'y', lo: 'x', hi: A }, { v: 'x', lo: '0', hi: A }],
            [{ v: 'y', lo: '0', hi: A }, { v: 'x', lo: '0', hi: A }],
          ],
          body: g.body,
          value: g.val,
        };
      }
      const f = randPolyF(rng, ['x', 'y'], 2, 1, 4);
      const v = exactIter(f, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: vr('x'), hi: cst(a) }]);
      return {
        orig: [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: 'x', hi: String(a) }],
        rev: [{ v: 'y', lo: '0', hi: String(a) }, { v: 'x', lo: '0', hi: 'y' }],
        wrong: [
          [{ v: 'y', lo: '0', hi: String(a) }, { v: 'x', lo: 'y', hi: String(a) }],
          [{ v: 'y', lo: 'x', hi: String(a) }, { v: 'x', lo: '0', hi: String(a) }],
          [{ v: 'y', lo: '0', hi: String(a) }, { v: 'x', lo: '0', hi: String(a) }],
        ],
        body: bodyTex(f),
        value: ex(v),
      };
    }
    case 'sqrt': {
      // ∫_0^{a²} ∫_{√y}^{a} f dx dy  =  ∫_0^a ∫_0^{x²} f dy dx
      if (special) {
        const g = rng.pick([
          { body: 'e^{x^{3}}', a: 1, val: exAdd(ex(new Frac(1, 3), { sym: 'e', val: Math.E }), ex(new Frac(-1, 3))) },
          { body: '3e^{x^{3}}', a: 1, val: exAdd(ex(1, { sym: 'e', val: Math.E }), ex(-1)) },
          { body: 'e^{x^{3}}', a: 2, val: exAdd(ex(new Frac(1, 3), { sym: 'e^{8}', val: Math.E ** 8 }), ex(new Frac(-1, 3))) },
          { body: '\\frac{x}{1 + x^{4}}', a: 1, val: ex(new Frac(1, 4), { sym: '\\ln 2', val: Math.log(2) }) },
        ]);
        const A = String(g.a);
        const A2 = String(sq(g.a));
        return {
          orig: [{ v: 'y', lo: '0', hi: A2 }, { v: 'x', lo: '\\sqrt{y}', hi: A }],
          rev: [{ v: 'x', lo: '0', hi: A }, { v: 'y', lo: '0', hi: 'x^{2}' }],
          wrong: [
            [{ v: 'x', lo: '0', hi: A }, { v: 'y', lo: 'x^{2}', hi: A2 }],
            [{ v: 'x', lo: '0', hi: A2 }, { v: 'y', lo: '0', hi: '\\sqrt{x}' }],
            [{ v: 'x', lo: '0', hi: A }, { v: 'y', lo: '0', hi: '\\sqrt{x}' }],
          ],
          body: g.body,
          value: g.val,
        };
      }
      const f = randPolyF(rng, ['x', 'y'], 2, 1, 4);
      const v = exactIter(f, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: [mt(1, { x: 2 })] }]);
      return {
        orig: [{ v: 'y', lo: '0', hi: String(sq(a)) }, { v: 'x', lo: '\\sqrt{y}', hi: String(a) }],
        rev: [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: '0', hi: 'x^{2}' }],
        wrong: [
          [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: 'x^{2}', hi: String(sq(a)) }],
          [{ v: 'x', lo: '0', hi: String(sq(a)) }, { v: 'y', lo: '0', hi: '\\sqrt{x}' }],
          [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: '0', hi: '\\sqrt{x}' }],
        ],
        body: bodyTex(f),
        value: ex(v),
      };
    }
    case 'under': {
      // ∫_0^a ∫_0^{x²} f dy dx  =  ∫_0^{a²} ∫_{√y}^{a} f dx dy
      const f = randPolyF(rng, ['x', 'y'], 2, 1, 4);
      const v = exactIter(f, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: [mt(1, { x: 2 })] }]);
      return {
        orig: [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: '0', hi: 'x^{2}' }],
        rev: [{ v: 'y', lo: '0', hi: String(sq(a)) }, { v: 'x', lo: '\\sqrt{y}', hi: String(a) }],
        wrong: [
          [{ v: 'y', lo: '0', hi: String(sq(a)) }, { v: 'x', lo: '0', hi: '\\sqrt{y}' }],
          [{ v: 'y', lo: '0', hi: String(a) }, { v: 'x', lo: 'y^{2}', hi: String(a) }],
          [{ v: 'y', lo: '0', hi: String(sq(a)) }, { v: 'x', lo: '\\sqrt{y}', hi: String(sq(a)) }],
        ],
        body: bodyTex(f),
        value: ex(v),
      };
    }
    case 'top':
    default: {
      // ∫_0^a ∫_0^{kx} f dy dx  =  ∫_0^{ka} ∫_{y/k}^{a} f dx dy
      const k = rng.int(2, 3);
      const f = randPolyF(rng, ['x', 'y'], 2, 1, 4);
      const v = exactIter(f, [{ v: 'x', lo: cst(0), hi: cst(a) }, { v: 'y', lo: cst(0), hi: vr('x', k) }]);
      return {
        orig: [{ v: 'x', lo: '0', hi: String(a) }, { v: 'y', lo: '0', hi: `${k}x` }],
        rev: [{ v: 'y', lo: '0', hi: String(k * a) }, { v: 'x', lo: `\\frac{y}{${k}}`, hi: String(a) }],
        wrong: [
          [{ v: 'y', lo: '0', hi: String(k * a) }, { v: 'x', lo: '0', hi: `\\frac{y}{${k}}` }],
          [{ v: 'y', lo: '0', hi: String(a) }, { v: 'x', lo: `${k}y`, hi: String(a) }],
          [{ v: 'y', lo: '0', hi: String(k * a) }, { v: 'x', lo: `${k}y`, hi: String(a) }],
        ],
        body: bodyTex(f),
        value: ex(v),
      };
    }
  }
}

export const reverseOrder = taskTopic<'reverse'>({
  id: 'mv.integrals.reverse-order',
  title: 'Reversing the Order of Integration',
  description: 'Rewrite iterated integrals with the order of integration reversed, then evaluate.',
  category: CAT,
  instruction: 'Reverse the order of integration and evaluate the integral.',
  defaultCount: 8,
  tasks: [{ value: 'reverse', label: 'Reverse and evaluate' }],
  mix: { easy: ['reverse'], medium: ['reverse'], hard: ['reverse'] },
  build(_t, { rng, difficulty }) {
    const r = reversal(rng, difficulty);
    const show = (bs: BT[]) => m(`${iterTex(r.body, bs)} = ${exTex(r.value)}`);
    return {
      question: m(iterTex(r.body, r.orig)),
      answer: show(r.rev),
      steps: ['Sketch the region from the given limits, then describe it with the other variable on the outside.', show(r.rev)],
      wrongs: r.wrong.map(show),
      fallback: (k) => m(`${iterTex(r.body, r.rev)} = ${exTex(exAdd(r.value, ex(k)))}`),
      check: { kind: 'multivariable.integral', reversed: true },
    };
  },
});

// ---------------------------------------------------------------- polar coordinates

interface PolarF {
  /** integrand in x, y */
  xy: string;
  /** exact value of ∫ (integrand · r) dr from a to b */
  radial: (a: number, b: number) => Ex;
  trig: 'one' | 'sin' | 'cos';
}

/** θ-ranges: [lo, hi] as multiples of π. */
const RANGES: Array<[Frac, Frac, string]> = [
  [new Frac(0), new Frac(2), 'full'],
  [new Frac(0), new Frac(1), 'upper'],
  [new Frac(-1, 2), new Frac(1, 2), 'right'],
  [new Frac(0), new Frac(1, 2), 'quarter'],
];

/** True when a LaTeX expression has a top-level + or − (so it needs brackets as an integrand). */
export function topSum(t: string): boolean {
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (ch === '{' || ch === '(') depth++;
    else if (ch === '}' || ch === ')') depth--;
    else if (depth === 0 && i > 0 && (ch === '+' || ch === '-')) return true;
  }
  return false;
}

function thetaIntegral(trig: PolarF['trig'], lo: Frac, hi: Frac): Ex {
  if (trig === 'one') return exPi(hi.sub(lo));
  // ∫ sin = cos lo − cos hi, ∫ cos = sin hi − sin lo
  const c = (f: Frac) => cosPi(f);
  const sn = (f: Frac) => cosPi(new Frac(1, 2).sub(f));
  return trig === 'sin' ? exAdd(c(lo), exScale(c(hi), -1)) : exAdd(sn(hi), exScale(sn(lo), -1));
}

function polarIntegrand(rng: Rng, d: Difficulty): PolarF {
  const k = rng.int(1, 4);
  const s = (n: number) => (n === 1 ? '' : String(n));
  const powR = (p: number, c: number): PolarF['radial'] => (a, b) => ex(new Frac(c * (b ** (p + 2) - a ** (p + 2)), p + 2));
  const pool: Array<() => PolarF> = [
    () => ({ xy: String(k), radial: powR(0, k), trig: 'one' }),
    () => ({ xy: `${s(k)}x^{2} + ${s(k)}y^{2}`, radial: powR(2, k), trig: 'one' }),
    () => ({ xy: `\\sqrt{x^{2} + y^{2}}`, radial: powR(1, 1), trig: 'one' }),
  ];
  if (d !== 'easy')
    pool.push(
      () => ({ xy: `${s(k)}y`, radial: powR(1, k), trig: 'sin' }),
      () => ({ xy: `${s(k)}x`, radial: powR(1, k), trig: 'cos' }),
      () => ({ xy: `(x^{2} + y^{2})^{2}`, radial: powR(4, 1), trig: 'one' }),
    );
  if (d === 'hard')
    pool.push(() => ({
      xy: `e^{x^{2} + y^{2}}`,
      radial: (a, b) => exAdd(ex(new Frac(1, 2), { sym: b * b === 1 ? 'e' : `e^{${b * b}}`, val: Math.exp(b * b) }), a ? ex(new Frac(-1, 2), { sym: a * a === 1 ? 'e' : `e^{${a * a}}`, val: Math.exp(a * a) }) : ex(new Frac(-1, 2))),
      trig: 'one',
    }));
  return rng.pick(pool)();
}

export const polarDouble = taskTopic<'polarRegion' | 'convert'>({
  id: 'mv.integrals.polar',
  title: 'Double Integrals in Polar Coordinates',
  description: 'Evaluate double integrals over disks, sectors and annuli by changing to polar coordinates.',
  category: CAT,
  instruction: 'Evaluate each integral by changing to polar coordinates.',
  tasks: [
    { value: 'polarRegion', label: 'Region described in polar coordinates' },
    { value: 'convert', label: 'Convert a rectangular iterated integral' },
  ],
  mix: { easy: ['polarRegion'], medium: ['polarRegion', 'convert'], hard: ['convert', 'polarRegion'] },
  build(task, { rng, difficulty }) {
    const f = polarIntegrand(rng, difficulty);
    const usable = RANGES.filter(([lo, hi]) => Math.abs(exVal(thetaIntegral(f.trig, lo, hi))) > 1e-9);
    const [lo, hi, kind] = rng.pick(usable);
    const b = rng.int(1, 4);
    const a = task === 'polarRegion' && difficulty !== 'easy' && rng.bool(0.4) ? rng.int(1, b - 1 || 1) : 0;
    const aa = a >= b ? 0 : a;
    const th = thetaIntegral(f.trig, lo, hi);
    const v = exMul(f.radial(aa, b), th);
    const jac = f.trig === 'one' ? '' : f.trig === 'sin' ? '\\sin\\theta' : '\\cos\\theta';
    let question: string;
    if (task === 'polarRegion') {
      question = `${m(`\\displaystyle \\iint_{D} ${topSum(f.xy) ? `(${f.xy})` : f.xy}\\,dA`)}, ${m(`D = \\left\\{(r, \\theta) \\mid ${aa} \\le r \\le ${b},\\ ${piTex(lo)} \\le \\theta \\le ${piTex(hi)}\\right\\}`)}`;
    } else {
      const root = `\\sqrt{${b * b} - x^{2}}`;
      const rootY = `\\sqrt{${b * b} - y^{2}}`;
      const bs: BT[] =
        kind === 'full'
          ? [{ v: 'x', lo: String(-b), hi: String(b) }, { v: 'y', lo: `-${root}`, hi: root }]
          : kind === 'upper'
            ? [{ v: 'x', lo: String(-b), hi: String(b) }, { v: 'y', lo: '0', hi: root }]
            : kind === 'right'
              ? [{ v: 'y', lo: String(-b), hi: String(b) }, { v: 'x', lo: '0', hi: rootY }]
              : [{ v: 'x', lo: '0', hi: String(b) }, { v: 'y', lo: '0', hi: root }];
      question = m(iterTex(topSum(f.xy) ? `(${f.xy})` : f.xy, bs));
    }
    return {
      question,
      answer: valAns(v),
      steps: [
        m(`x = r\\cos\\theta,\\ y = r\\sin\\theta,\\ dA = r\\,dr\\,d\\theta`),
        m(`\\int_{${piTex(lo)}}^{${piTex(hi)}}\\int_{${aa}}^{${b}} (\\ldots)\\,${jac ? `${jac}\\,` : ''}r\\,dr\\,d\\theta = ${exTex(v)}`),
      ],
      wrongs: [valAns(exScale(v, 2)), valAns(exScale(v, new Frac(1, 2))), valAns(exMul(f.radial(aa, b + 1), th))],
      fallback: (k) => valAns(exScale(v, k + 2)),
      check: { kind: 'multivariable.integral' },
    };
  },
});

