/** Vector-valued functions in space: derivatives, tangents, arc length, curvature, motion. */
import { Frac, gcdAll } from '../../fraction';
import { attempt, offset } from '../../generator';
import { simplifySqrt } from '../../radical';
import type { Rng } from '../../rng';
import { m, sum } from '../../tex';
import type { Difficulty } from '../../types';
import {
  bf,
  cross,
  cst,
  diff,
  dot,
  evalExact,
  ex,
  exAdd,
  exRad,
  exScale,
  exTex,
  integ1,
  isZeroV,
  mt,
  norm,
  norm2,
  piTex,
  taskTopic,
  tex,
  vtex,
  type Ex,
  type MT,
  type MX,
} from './common';

const CAT = 'Vector-Valued Functions';
const T = 't';
const R = bf('r');
const vecFn = (name: string, comps: readonly MX[], arg = 't') => `${name}(${arg}) = ${vtex(comps.map(tex))}`;
const XYZ = ['x', 'y', 'z'] as const;
const paramTex = (p: readonly Frac[], d: readonly number[]) => XYZ.map((v, i) => `${v} = ${sum([{ coef: p[i]! }, { coef: d[i]!, sym: 't' }])}`).join(',\\ ');

type Mode = 'zero' | 'one';
const atom = (fn: 'exp' | 'sin' | 'cos' | 'ln', k = 1) => ({ fn, k, e: { t: 1 } });

/** One random component; `mode` decides which t₀ (0 or 1) keeps values exact. */
function comp(rng: Rng, d: Difficulty, mode: Mode): MX {
  const c = () => rng.signedInt(1, d === 'easy' ? 4 : 6, true);
  const poly = (): MX => {
    const n = rng.int(1, 3);
    const out: MX = [mt(c(), { t: n })];
    if (rng.bool(0.6)) out.push(mt(c(), { t: rng.int(0, n - 1) }));
    return norm(out);
  };
  if (d === 'easy') return poly();
  const k = rng.int(1, 3);
  if (mode === 'one') {
    return rng.pick<() => MX>([poly, () => [mt(c(), {}, atom('ln'))], () => [mt(c(), { t: -1 })], () => norm([mt(c(), { t: 2 }), mt(c(), {}, atom('ln'))])])();
  }
  const opts: Array<() => MX> = [poly, () => [mt(c(), {}, atom('exp', rng.pick([1, 2, 3, -1, -2])))], () => [mt(c(), {}, atom('sin', k))], () => [mt(c(), {}, atom('cos', k))]];
  if (d === 'hard') opts.push(() => [mt(c(), { t: 1 }, atom('exp', k))], () => [mt(c(), { t: 2 }, atom('sin', 1))], () => [mt(c(), { t: 1 }, atom('cos', k))]);
  return rng.pick(opts)();
}

function curve(rng: Rng, d: Difficulty, mode: Mode): MX[] {
  return attempt('curve', () => {
    const r = [comp(rng, d, mode), comp(rng, d, mode), comp(rng, d, mode)];
    const kinds = new Set(r.map((x) => tex(x)));
    return kinds.size === 3 ? r : null;
  });
}

/** A typical slip: forget the chain-rule factor, the sign of a trig derivative, or the power-rule coefficient. */
function wrongDiff(x: MX, flag: 'chain' | 'sign' | 'power'): MX {
  const out: MT[] = [];
  for (const t of x) {
    const n = t.e.t ?? 0;
    if (n) out.push(mt(flag === 'power' ? t.c : t.c.mul(n), { ...t.e, t: n - 1 }, t.a));
    if (!t.a) continue;
    const a = t.a;
    const k = flag === 'chain' ? Frac.ONE : a.k;
    const sg = flag === 'sign' ? -1 : 1;
    switch (a.fn) {
      case 'exp':
        out.push(mt(t.c.mul(k), t.e, a));
        break;
      case 'sin':
        out.push(mt(t.c.mul(k).mul(sg), t.e, { ...a, fn: 'cos' }));
        break;
      case 'cos':
        out.push(mt(t.c.mul(k).mul(-sg), t.e, { ...a, fn: 'sin' }));
        break;
      case 'ln':
        out.push(mt(t.c, { ...t.e, t: n - 1 }));
        break;
    }
  }
  return norm(out);
}

const D1 = (r: readonly MX[]) => r.map((c) => diff(c, T));
const at = (r: readonly MX[], t0: number) => r.map((c) => evalExact(c, { t: t0 })!);
const bump = (r: readonly MX[], k: number) => r.map((c, i) => (i === k % 3 ? norm([...c, mt(offset(k))]) : c));

type DTask = 'derivative' | 'second' | 'atPoint' | 'unitTangent' | 'tangentLine';

export const spaceCurves = taskTopic<DTask>({
  id: 'mv.vvf.space-curves',
  title: 'Space Curves and Their Derivatives',
  description: 'Derivatives of vector-valued functions, unit tangent vectors and tangent lines to space curves.',
  category: CAT,
  instruction: 'Answer each question.',
  tasks: [
    { value: 'derivative', label: "Find r'(t)" },
    { value: 'second', label: "Find r''(t)" },
    { value: 'atPoint', label: "Evaluate r'(t₀)" },
    { value: 'unitTangent', label: 'Unit tangent vector' },
    { value: 'tangentLine', label: 'Tangent line' },
  ],
  mix: { easy: ['derivative', 'atPoint', 'derivative'], medium: ['derivative', 'second', 'unitTangent', 'tangentLine'], hard: ['derivative', 'unitTangent', 'tangentLine', 'second'] },
  build(task, { rng, difficulty }) {
    const mode: Mode = difficulty !== 'easy' && rng.bool(0.3) ? 'one' : 'zero';
    const t0 = mode === 'one' ? 1 : difficulty === 'easy' ? rng.int(-2, 2) : 0;
    const vecAns = (name: string, comps: readonly MX[]) => m(`${name} = ${vtex(comps.map(tex))}`);
    switch (task) {
      case 'derivative':
      case 'second': {
        const r = curve(rng, difficulty, mode);
        const two = task === 'second';
        const name = two ? "\\mathbf{r}''(t)" : "\\mathbf{r}'(t)";
        const right = two ? D1(D1(r)) : D1(r);
        const wr = (f: 'chain' | 'sign' | 'power') => (two ? r.map((c) => wrongDiff(diff(c, T), f)) : r.map((c) => wrongDiff(c, f)));
        return {
          question: `Find ${m(name)} for ${m(vecFn(R, r))}.`,
          answer: vecAns(name, right),
          steps: two ? [vecAns("\\mathbf{r}'(t)", D1(r)), vecAns(name, right)] : [`Differentiate each component.`, vecAns(name, right)],
          wrongs: [vecAns(name, wr('chain')), vecAns(name, wr('sign')), vecAns(name, wr('power')), two ? vecAns(name, D1(r)) : null],
          fallback: (k) => vecAns(name, bump(right, k)),
          check: { kind: 'multivariable.curve', task },
        };
      }
      case 'atPoint':
      case 'unitTangent':
      case 'tangentLine': {
        const r = attempt('tangent', () => {
          const r = curve(rng, difficulty, mode);
          const v = at(D1(r), t0);
          if (v.some((x) => !x || !x.isInt()) || isZeroV(v.map((x) => x.n))) return null;
          if (task === 'unitTangent' && v.filter((x) => !x.isZero()).length < 2) return null;
          return at(r, t0).every((x) => x) ? r : null;
        });
        const v = at(D1(r), t0).map((x) => x.n);
        const tq = m(`t = ${t0}`);
        if (task === 'atPoint') {
          const name = `\\mathbf{r}'(${t0})`;
          const ans = (w: readonly number[]) => m(`${name} = ${vtex(w)}`);
          const r0 = at(r, t0);
          return {
            question: `Find ${m(name)} for ${m(vecFn(R, r))}.`,
            answer: ans(v),
            steps: [vecAns("\\mathbf{r}'(t)", D1(r)), ans(v)],
            wrongs: [m(`${name} = ${vtex(r0)}`), ans(v.map((x) => -x)), ans(at(r.map((c) => wrongDiff(c, 'power')), t0).map((x) => x?.n ?? 0))],
            fallback: (k) => ans(v.map((x, i) => (i === k % 3 ? x + offset(k) : x))),
            check: { kind: 'multivariable.curve', task, t0 },
          };
        }
        if (task === 'unitTangent') {
          const n = norm2(v);
          const unit = (w: readonly number[], nn: number) => m(`\\mathbf{T}(${t0}) = ${vtex(w.map((x) => exTex(exRad(new Frac(x, nn), nn))))}`);
          return {
            question: `Find the unit tangent vector ${m(`\\mathbf{T}(t)`)} at ${tq} for ${m(vecFn(R, r))}.`,
            answer: unit(v, n),
            steps: [m(`\\mathbf{r}'(${t0}) = ${vtex(v)}`), m(`\\|\\mathbf{r}'(${t0})\\| = ${exTex(exRad(1, n))}`), unit(v, n)],
            wrongs: [m(`\\mathbf{T}(${t0}) = ${vtex(v)}`), m(`\\mathbf{T}(${t0}) = ${vtex(v.map((x) => new Frac(x, n)))}`), unit(v.map((x) => -x), n)],
            fallback: (k) => unit(v, n + k),
            check: { kind: 'multivariable.curve', task, t0 },
          };
        }
        const p = at(r, t0);
        const ans = (a: readonly Frac[], b: readonly number[]) => m(paramTex(a, b));
        return {
          question: `Find parametric equations of the tangent line to ${m(vecFn(R, r))} at ${tq}.`,
          answer: ans(p, v),
          steps: [m(`\\mathbf{r}(${t0}) = ${vtex(p)}`), m(`\\mathbf{r}'(${t0}) = ${vtex(v)}`), ans(p, v)],
          wrongs: [ans(v.map((x) => new Frac(x)), p.map((x) => (x.isInt() ? x.n : 1))), ans(p, v.map((x) => -x).map((x, i) => (i === 0 ? -x : x))), ans(p.map((x) => x.add(1)), v)],
          fallback: (k) => ans(p, v.map((x, i) => (i === k % 3 ? x + offset(k) : x))),
          check: { kind: 'multivariable.curve', task, t0 },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- arc length and curvature

const PYTH: Array<[number, number, number]> = [
  [3, 4, 5],
  [4, 3, 5],
  [5, 12, 13],
  [12, 5, 13],
  [6, 8, 10],
  [8, 6, 10],
  [8, 15, 17],
  [15, 8, 17],
];

const coefT = (c: Frac | number, body: string) => {
  const f = Frac.of(c);
  if (f.eq(1)) return body;
  if (f.eq(-1)) return `-${body}`;
  if (f.isInt()) return `${f.n}${body}`;
  return `${f.sign < 0 ? '-' : ''}\\frac{${f.abs().n === 1 ? '' : f.abs().n}${body}}{${f.d}}`;
};

interface ArcCurve {
  comps: string[];
  lo: string;
  hi: string;
  L: Ex;
  speed: string;
}

function arcCurve(rng: Rng, d: Difficulty): ArcCurve {
  const fam = rng.pick(d === 'easy' ? ['helix', 'line', 'cubic'] : d === 'medium' ? ['helix', 'cubic', 'log'] : ['helix', 'cubic', 'log', 'helixRad']);
  switch (fam) {
    case 'helix':
    case 'helixRad': {
      let a: number;
      let b: number;
      let c2: number;
      if (fam === 'helix') {
        [a, b] = rng.pick(PYTH);
        c2 = a * a + b * b;
      } else {
        a = rng.int(1, 4);
        b = rng.int(1, 4);
        c2 = a * a + b * b;
      }
      const k = rng.pick([new Frac(1, 2), new Frac(1), new Frac(2), new Frac(1)]);
      const sw = rng.bool(0.5);
      const comps = [`${a}\\cos t`, `${a}\\sin t`, `${b === 1 ? '' : b}t`];
      if (sw) [comps[0], comps[1]] = [comps[1]!, comps[0]!];
      return { comps, lo: '0', hi: piTex(k.mul(2)), L: ex(k.mul(2), { rad: c2, pi: 1 }), speed: exTex(exRad(1, c2)) };
    }
    case 'line': {
      const p = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
      const dv = attempt('line', () => {
        const v = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
        return v.filter((x) => x).length >= 2 ? v : null;
      });
      const t1 = rng.int(1, 4);
      return { comps: p.map((x, i) => sum([{ coef: x }, { coef: dv[i]!, sym: 't' }])), lo: '0', hi: String(t1), L: exRad(t1, norm2(dv)), speed: exTex(exRad(1, norm2(dv))) };
    }
    case 'cubic': {
      // ⟨6t, 3t², t³⟩·k has speed k(6 + 3t²); ⟨2t, t², t³/3⟩·k has speed k(2 + t²)
      const base = rng.bool(0.5) ? { a: 6, b: 3, c: new Frac(1), s0: 6, s2: 3 } : { a: 2, b: 1, c: new Frac(1, 3), s0: 2, s2: 1 };
      const k = d === 'easy' ? 1 : rng.pick([1, 2, 3]);
      const sg = [rng.sign(), rng.sign(), rng.sign()];
      const order = rng.shuffle([0, 1, 2]);
      const parts = [coefT(base.a * k * sg[0]!, 't'), coefT(base.b * k * sg[1]!, 't^{2}'), coefT(base.c.mul(k * sg[2]!), 't^{3}')];
      const t1 = rng.int(1, 3);
      const L = new Frac(k).mul(new Frac(base.s0 * t1).add(new Frac(base.s2 * t1 ** 3, 3)));
      return { comps: order.map((i) => parts[i]!), lo: '0', hi: String(t1), L: ex(L), speed: sum([{ coef: base.s0 * k }, { coef: base.s2 * k, sym: 't^{2}' }]) };
    }
    case 'log':
    default: {
      // ⟨k t², 2k t, k ln t⟩ has speed k(2t + 1/t)
      const k = rng.int(1, 3);
      const t1 = rng.int(2, 4);
      const order = rng.shuffle([0, 1, 2]);
      const parts = [coefT(k, 't^{2}'), coefT(2 * k, 't'), coefT(k, '\\ln t')];
      const L = exAdd(ex(k * (t1 * t1 - 1)), ex(k, { sym: `\\ln ${t1}`, val: Math.log(t1) }));
      return { comps: order.map((i) => parts[i]!), lo: '1', hi: String(t1), L, speed: `${coefT(2 * k, 't')} + \\frac{${k}}{t}` };
    }
  }
}

type ATask = 'arcLength' | 'curvature' | 'curvatureHelix';

export const arcCurvature = taskTopic<ATask>({
  id: 'mv.vvf.arc-length-curvature',
  title: 'Arc Length and Curvature',
  description: 'Arc length of space curves and curvature of space curves at a point.',
  category: CAT,
  instruction: 'Answer each question. Leave answers in exact form.',
  tasks: [
    { value: 'arcLength', label: 'Arc length' },
    { value: 'curvature', label: 'Curvature at a point' },
    { value: 'curvatureHelix', label: 'Curvature of a helix' },
  ],
  mix: { easy: ['arcLength', 'curvatureHelix'], medium: ['arcLength', 'curvature', 'arcLength'], hard: ['arcLength', 'curvature'] },
  build(task, { rng, difficulty }) {
    switch (task) {
      case 'arcLength': {
        const c = arcCurve(rng, difficulty);
        const ans = (e: Ex) => m(`L = ${exTex(e)}`);
        return {
          question: `Find the arc length of ${m(`\\mathbf{r}(t) = ${vtex(c.comps)}`)} for ${m(`${c.lo} \\le t \\le ${c.hi}`)}.`,
          answer: ans(c.L),
          steps: [m(`\\|\\mathbf{r}'(t)\\| = ${c.speed}`), m(`L = \\int_{${c.lo}}^{${c.hi}} \\|\\mathbf{r}'(t)\\|\\,dt = ${exTex(c.L)}`)],
          wrongs: [ans(exScale(c.L, 2)), ans(exScale(c.L, new Frac(1, 2))), ans(exAdd(c.L, ex(1)))],
          fallback: (k) => ans(exAdd(c.L, ex(k + 1))),
          check: { kind: 'multivariable.arc' },
        };
      }
      case 'curvatureHelix': {
        const a = rng.int(1, 6);
        const b = rng.int(1, 6);
        const sw = rng.bool(0.5);
        const comps = [`${a === 1 ? '' : a}\\cos t`, `${a === 1 ? '' : a}\\sin t`, `${b === 1 ? '' : b}t`];
        if (sw) [comps[0], comps[1]] = [comps[1]!, comps[0]!];
        const k = new Frac(a, a * a + b * b);
        const ans = (f: Frac) => m(`\\kappa = ${f.toTex()}`);
        return {
          question: `Find the curvature ${m('\\kappa')} of ${m(`\\mathbf{r}(t) = ${vtex(comps)}`)}.`,
          answer: ans(k),
          steps: [m(`\\|\\mathbf{r}'(t)\\| = \\sqrt{${a * a + b * b}}`), m(`\\kappa = \\frac{\\|\\mathbf{r}'(t) \\times \\mathbf{r}''(t)\\|}{\\|\\mathbf{r}'(t)\\|^{3}} = \\frac{${a}}{${a * a} + ${b * b}}`), ans(k)],
          wrongs: [ans(new Frac(b, a * a + b * b)), ans(new Frac(1, a)), ans(new Frac(a, b * b + 1 === a * a + b * b ? b * b + 2 : b * b + 1))],
          fallback: (j) => ans(new Frac(a + j, a * a + b * b)),
          check: { kind: 'multivariable.curvature', t0: 0 },
        };
      }
      case 'curvature':
      default: {
        const t0 = difficulty === 'hard' ? rng.int(-1, 2) : rng.int(0, 1);
        const { r, v, w } = attempt('kappa', () => {
          const r = curve(rng, 'easy', 'zero');
          const v = at(D1(r), t0).map((x) => x.n);
          const w = at(D1(D1(r)), t0).map((x) => x.n);
          return isZeroV(v) || isZeroV(cross(v, w)) || norm2(v) > 40 || simplifySqrt(norm2(cross(v, w)) * norm2(v)).inside > 300 ? null : { r, v, w };
        });
        const N = norm2(cross(v, w));
        const M = norm2(v);
        const kap = exRad(new Frac(1, M * M), N * M);
        const ans = (e: Ex) => m(`\\kappa = ${exTex(e)}`);
        return {
          question: `Find the curvature of ${m(vecFn(R, r))} at ${m(`t = ${t0}`)}.`,
          answer: ans(kap),
          steps: [
            m(`\\mathbf{r}'(${t0}) = ${vtex(v)},\\ \\mathbf{r}''(${t0}) = ${vtex(w)}`),
            m(`\\mathbf{r}'(${t0}) \\times \\mathbf{r}''(${t0}) = ${vtex(cross(v, w))}`),
            m(`\\kappa = \\frac{\\sqrt{${N}}}{(\\sqrt{${M}})^{3}} = ${exTex(kap)}`),
          ],
          wrongs: [ans(exRad(new Frac(1, M), N * M)), ans(exRad(new Frac(1, M), N)), ans(exRad(new Frac(1, M * M), N * M + 1))],
          fallback: (j) => ans(exRad(new Frac(1, M * M), N * M + j + 1)),
          check: { kind: 'multivariable.curvature', t0 },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- motion in space

type MTask = 'velocity' | 'acceleration' | 'speed' | 'position' | 'components';

export const motionSpace = taskTopic<MTask>({
  id: 'mv.vvf.motion',
  title: 'Velocity and Acceleration in Space',
  description: 'Velocity, acceleration and speed from position, position from acceleration, and tangential and normal components of acceleration.',
  category: CAT,
  instruction: 'Answer each question.',
  tasks: [
    { value: 'velocity', label: 'Velocity' },
    { value: 'acceleration', label: 'Acceleration' },
    { value: 'speed', label: 'Speed at a time' },
    { value: 'position', label: 'Position from acceleration' },
    { value: 'components', label: 'Tangential and normal components' },
  ],
  mix: { easy: ['velocity', 'acceleration', 'speed'], medium: ['velocity', 'acceleration', 'speed', 'position'], hard: ['position', 'components', 'speed', 'acceleration'] },
  build(task, { rng, difficulty }) {
    const cd: Difficulty = difficulty === 'hard' ? 'medium' : difficulty;
    const named = (name: string, comps: readonly MX[]) => m(`${name} = ${vtex(comps.map(tex))}`);
    switch (task) {
      case 'velocity':
      case 'acceleration': {
        const r = curve(rng, cd, 'zero');
        const acc = task === 'acceleration';
        const name = acc ? '\\mathbf{a}(t)' : '\\mathbf{v}(t)';
        const right = acc ? D1(D1(r)) : D1(r);
        const wr = (f: 'chain' | 'sign' | 'power') => (acc ? D1(r).map((c) => wrongDiff(c, f)) : r.map((c) => wrongDiff(c, f)));
        return {
          question: `Find the ${acc ? 'acceleration' : 'velocity'} ${m(name)} of a particle with position ${m(vecFn(R, r))}.`,
          answer: named(name, right),
          steps: acc ? [named('\\mathbf{v}(t)', D1(r)), named(name, right)] : [named(name, right)],
          wrongs: [named(name, wr('chain')), named(name, wr('sign')), named(name, wr('power')), acc ? named(name, D1(r)) : named(name, D1(D1(r)))],
          fallback: (k) => named(name, bump(right, k)),
          check: { kind: 'multivariable.curve', task: acc ? 'second' : 'derivative' },
        };
      }
      case 'speed': {
        const t0 = difficulty === 'easy' ? rng.int(0, 2) : rng.int(-2, 2);
        const r = attempt('speed', () => {
          const r = curve(rng, 'easy', 'zero');
          return isZeroV(at(D1(r), t0).map((x) => x.n)) ? null : r;
        });
        const v = at(D1(r), t0).map((x) => x.n);
        const n = norm2(v);
        const ans = (e: Ex) => m(`\\|\\mathbf{v}(${t0})\\| = ${exTex(e)}`);
        return {
          question: `Find the speed at ${m(`t = ${t0}`)} of a particle with position ${m(vecFn(R, r))}.`,
          answer: ans(exRad(1, n)),
          steps: [named('\\mathbf{v}(t)', D1(r)), m(`\\mathbf{v}(${t0}) = ${vtex(v)}`), ans(exRad(1, n))],
          wrongs: [ans(ex(n)), ans(exRad(1, norm2(at(r, t0).map((x) => x.n))) || ex(n + 1)), ans(ex(v.reduce((s, x) => s + Math.abs(x), 0)))],
          fallback: (k) => ans(exRad(1, n + k)),
          check: { kind: 'multivariable.curve', task: 'speed', t0 },
        };
      }
      case 'position': {
        const a = attempt('accel', () => {
          const a: MX[] = [0, 1, 2].map(() => {
            const kind = rng.int(0, difficulty === 'medium' ? 1 : 3);
            const c = rng.signedInt(1, 6, true);
            if (kind <= 1) return norm([mt(c, { t: rng.int(0, 2) }), ...(rng.bool(0.4) ? [mt(rng.signedInt(1, 4, true))] : [])]);
            return [mt(c, {}, atom(rng.pick(['exp', 'sin', 'cos'] as const), rng.int(1, 2)))];
          });
          return new Set(a.map(tex)).size === 3 ? a : null;
        });
        const v0 = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
        const r0 = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
        const withConst = (F: MX, c0: number): MX => norm([...F, ...cst(new Frac(c0).sub(evalExact(F, { t: 0 })!))]);
        const v = a.map((c, i) => withConst(integ1(c, T), v0[i]!));
        const r = v.map((c, i) => withConst(integ1(c, T), r0[i]!));
        const name = '\\mathbf{r}(t)';
        const vNo = a.map((c) => integ1(c, T));
        const rNoV = vNo.map((c, i) => withConst(integ1(c, T), r0[i]!));
        const rSwap = a.map((c, i) => withConst(integ1(withConst(integ1(c, T), r0[i]!), T), v0[i]!));
        return {
          question: `Find the position ${m(name)} of a particle with ${m(`\\mathbf{a}(t) = ${vtex(a.map(tex))}`)}, ${m(`\\mathbf{v}(0) = ${vtex(v0)}`)}, and ${m(`\\mathbf{r}(0) = ${vtex(r0)}`)}.`,
          answer: named(name, r),
          steps: [named('\\mathbf{v}(t)', v), named(name, r)],
          wrongs: [named(name, rNoV), named(name, rSwap), named(name, v)],
          fallback: (k) => named(name, bump(r, k)),
          check: { kind: 'multivariable.position' },
        };
      }
      case 'components':
      default: {
        const t0 = rng.int(0, 2);
        const { r, v, w } = attempt('components', () => {
          const r = curve(rng, 'easy', 'zero');
          const v = at(D1(r), t0).map((x) => x.n);
          const w = at(D1(D1(r)), t0).map((x) => x.n);
          return isZeroV(v) || isZeroV(cross(v, w)) || dot(v, w) === 0 || norm2(v) > 40 || simplifySqrt(norm2(cross(v, w)) * norm2(v)).inside > 300 ? null : { r, v, w };
        });
        const M = norm2(v);
        const aT = exRad(new Frac(dot(v, w), M), M);
        const aN = exRad(new Frac(1, M), norm2(cross(v, w)) * M);
        const ans = (x: Ex, y: Ex) => `${m(`a_{T} = ${exTex(x)}`)}, ${m(`a_{N} = ${exTex(y)}`)}`;
        const g = gcdAll([dot(v, w)]) || 1;
        return {
          question: `Find the tangential and normal components of acceleration at ${m(`t = ${t0}`)} for ${m(vecFn(R, r))}.`,
          answer: ans(aT, aN),
          steps: [m(`\\mathbf{v}(${t0}) = ${vtex(v)},\\ \\mathbf{a}(${t0}) = ${vtex(w)}`), m(`a_{T} = \\frac{\\mathbf{v} \\cdot \\mathbf{a}}{\\|\\mathbf{v}\\|} = \\frac{${dot(v, w)}}{\\sqrt{${M}}}`), m(`a_{N} = \\frac{\\|\\mathbf{v} \\times \\mathbf{a}\\|}{\\|\\mathbf{v}\\|} = \\frac{\\sqrt{${norm2(cross(v, w))}}}{\\sqrt{${M}}}`)],
          wrongs: [ans(aN, aT), ans(ex(new Frac(dot(v, w), M)), aN), ans(aT, exRad(1, norm2(cross(v, w)) + g))],
          fallback: (k) => ans(aT, exRad(new Frac(1, M), norm2(cross(v, w)) * M + k)),
          check: { kind: 'multivariable.accelComponents', t0 },
        };
      }
    }
  },
});
