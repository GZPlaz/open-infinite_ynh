/** Gradients and directional derivatives, tangent planes, local extrema, Lagrange multipliers. */
import { Frac, gcdAll } from '../../fraction';
import { attempt, offset } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, num, sum } from '../../tex';
import type { Difficulty } from '../../types';
import { diff, dot, evalExact, ex, exRad, exScale, exTex, lincomb, mt, norm, norm2, randF, sorted, taskTopic, tex, vtex, type Ex, type MX } from './common';

const CAT = 'Partial Derivatives';
const fdef = (f: MX, vars: readonly string[], name = 'f') => `${name}(${vars.join(', ')}) = ${tex(f)}`;
const pt = (name: string, p: readonly number[]) => `${name}(${p.join(', ')})`;
const XYZ = ['x', 'y', 'z'];

/** f with an exact gradient at an integer point. */
function fWithPoint(rng: Rng, d: Difficulty, vars: readonly string[]): { f: MX; p: number[]; g: Frac[]; f0: Frac } {
  return attempt('gradient point', () => {
    const f = sorted(randF(rng, d, vars, d !== 'easy'));
    const p = vars.map(() => rng.int(-2, 3));
    const env = Object.fromEntries(vars.map((v, i) => [v, p[i]!]));
    const g = vars.map((v) => evalExact(diff(f, v), env));
    const f0 = evalExact(f, env);
    if (!f0 || g.some((x) => !x || !x.isInt()) || g.every((x) => x!.isZero()) || g.some((x) => Math.abs(x!.value) > 60)) return null;
    return { f, p, g: g as Frac[], f0 };
  });
}

type GTask = 'gradient' | 'gradPoint' | 'directional' | 'maxRate';

export const gradient = taskTopic<GTask>({
  id: 'mv.partial.gradient',
  title: 'Directional Derivatives and the Gradient',
  description: 'Gradient vectors, directional derivatives, and the maximum rate of change and its direction.',
  category: CAT,
  instruction: 'Answer each question. Leave answers in exact form.',
  tasks: [
    { value: 'gradient', label: 'Gradient' },
    { value: 'gradPoint', label: 'Gradient at a point' },
    { value: 'directional', label: 'Directional derivative' },
    { value: 'maxRate', label: 'Maximum rate of change' },
  ],
  mix: { easy: ['gradient', 'gradPoint', 'directional'], medium: ['gradient', 'directional', 'maxRate'], hard: ['directional', 'maxRate', 'gradPoint'] },
  build(task, { rng, difficulty }) {
    const three = difficulty === 'hard' && rng.bool(0.5);
    const vars = three ? XYZ : ['x', 'y'];
    const G = `\\nabla f`;
    if (task === 'gradient') {
      const f = sorted(randF(rng, difficulty, vars, difficulty !== 'easy'));
      const g = vars.map((v) => diff(f, v));
      const ans = (cs: MX[]) => m(`${G}(${vars.join(', ')}) = ${vtex(cs.map(tex))}`);
      return {
        question: `Find ${m(`${G}`)} for ${m(fdef(f, vars))}.`,
        answer: ans(g),
        steps: vars.map((v, i) => m(`f_{${v}} = ${tex(g[i]!)}`)).concat(ans(g)),
        wrongs: [ans([...g].reverse()), ans(g.map((c) => norm(c.map((t) => ({ ...t, c: t.c.neg() }))))), ans(g.map((c, i) => (i === 0 ? norm([...c, ...vars.slice(1).flatMap((v) => diff(f, v))]) : c)))],
        fallback: (k) => ans(g.map((c, i) => (i === k % vars.length ? norm([...c, mt(offset(k))]) : c))),
        check: { kind: 'multivariable.gradient', task },
      };
    }
    const { f, p, g } = fWithPoint(rng, difficulty, vars);
    const gi = g.map((x) => x.n);
    const where = m(pt('P', p));
    switch (task) {
      case 'gradPoint': {
        const ans = (w: ReadonlyArray<Frac | number>) => m(`${G}(${p.join(', ')}) = ${vtex(w)}`);
        return {
          question: `Find ${m(`${G}`)} at ${where} for ${m(fdef(f, vars))}.`,
          answer: ans(g),
          steps: vars.map((v, i) => m(`f_{${v}}(${p.join(', ')}) = ${num(g[i]!)}`)).concat(ans(g)),
          wrongs: [ans([...g].reverse()), ans(g.map((x) => x.neg())), ans(g.map((x, i) => (i === 0 ? x.add(1) : x)))],
          fallback: (k) => ans(g.map((x, i) => (i === k % vars.length ? x.add(offset(k)) : x))),
          check: { kind: 'multivariable.gradient', task },
        };
      }
      case 'directional': {
        const v = attempt('direction', () => {
          const v = vars.map(() => rng.int(-4, 4));
          return v.filter((x) => x).length >= Math.min(2, vars.length) && dot(v, gi) !== 0 ? v : null;
        });
        const n = norm2(v);
        const val = exRad(new Frac(dot(v, gi), n), n);
        const ans = (e: Ex) => m(`D_{\\mathbf{u}}f(${p.join(', ')}) = ${exTex(e)}`);
        return {
          question: `Find the directional derivative of ${m(fdef(f, vars))} at ${where} in the direction of ${m(`\\mathbf{v} = ${vtex(v)}`)}.`,
          answer: ans(val),
          steps: [m(`${G}(${p.join(', ')}) = ${vtex(g)}`), m(`\\mathbf{u} = \\frac{\\mathbf{v}}{\\|\\mathbf{v}\\|} = \\frac{1}{${exTex(exRad(1, n))}}${vtex(v)}`), ans(val)],
          wrongs: [ans(ex(dot(v, gi))), ans(exScale(val, -1)), ans(exRad(1, norm2(gi)))],
          fallback: (k) => ans(exRad(new Frac(dot(v, gi) + k, n), n)),
          check: { kind: 'multivariable.gradient', task },
        };
      }
      case 'maxRate':
      default: {
        const N = norm2(gi);
        const ans = (e: Ex, w: ReadonlyArray<Frac | number>) => `Maximum rate: ${m(exTex(e))}; direction: ${m(vtex(w))}`;
        return {
          question: `Find the maximum rate of change of ${m(fdef(f, vars))} at ${where} and the direction in which it occurs.`,
          answer: ans(exRad(1, N), g),
          steps: [m(`${G}(${p.join(', ')}) = ${vtex(g)}`), m(`\\|${G}(${p.join(', ')})\\| = ${exTex(exRad(1, N))}`)],
          wrongs: [ans(ex(N), g), ans(exRad(1, N), g.map((x) => x.neg())), ans(ex(gi.reduce((s, x) => s + Math.abs(x), 0)), g)],
          fallback: (k) => ans(exRad(1, N + k), g),
          check: { kind: 'multivariable.gradient', task },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- tangent planes

type TTask = 'graph' | 'surface' | 'linearization' | 'approx';
const planeTex = (n: readonly number[], d: number) => `${sum(n.map((c, i) => ({ coef: c, sym: XYZ[i] })))} = ${d}`;

export const tangentPlanes = taskTopic<TTask>({
  id: 'mv.partial.tangent-planes',
  title: 'Tangent Planes and Linear Approximation',
  description: 'Tangent planes to graphs and level surfaces, linearizations and linear approximations.',
  category: CAT,
  instruction: 'Answer each question.',
  tasks: [
    { value: 'graph', label: 'Tangent plane to z = f(x, y)' },
    { value: 'surface', label: 'Tangent plane to a level surface' },
    { value: 'linearization', label: 'Linearization' },
    { value: 'approx', label: 'Linear approximation' },
  ],
  mix: { easy: ['graph', 'linearization'], medium: ['graph', 'surface', 'linearization', 'approx'], hard: ['surface', 'approx', 'graph'] },
  build(task, { rng, difficulty }) {
    if (task === 'surface') {
      const { F, P, n } = attempt('surface', () => {
        const F = sorted(randF(rng, difficulty === 'hard' ? 'medium' : 'easy', XYZ, false));
        const P = [rng.int(-2, 2), rng.int(-2, 2), rng.int(-2, 2)];
        const env = { x: P[0]!, y: P[1]!, z: P[2]! };
        const g = XYZ.map((v) => evalExact(diff(F, v), env)!.n);
        if (g.every((x) => x === 0) || g.filter((x) => x !== 0).length < 2) return null;
        const k = gcdAll(g) || 1;
        const s = g.find((x) => x !== 0)! < 0 ? -1 : 1;
        return { F, P, n: g.map((x) => (s * x) / k) };
      });
      const k = evalExact(F, { x: P[0]!, y: P[1]!, z: P[2]! })!;
      const d = dot(n, P);
      const ans = (a: readonly number[], b: number) => m(planeTex(a, b));
      return {
        question: `Find an equation of the tangent plane to the surface ${m(`${tex(F)} = ${num(k)}`)} at ${m(pt('P', P))}.`,
        answer: ans(n, d),
        steps: [m(`\\nabla F = ${vtex(XYZ.map((v) => tex(diff(F, v))))}`), m(`\\nabla F(${P.join(', ')}) \\parallel ${vtex(n)}`), ans(n, d)],
        wrongs: [ans(n, -d || d + 2), ans(P.some((x, i) => x !== n[i]) && P.some((x) => x !== 0) ? P : n.map((x) => x + 1), d), ans(n.map((x, i) => (i === 2 ? -x : x)), d)],
        fallback: (j) => ans(n, d + offset(j)),
        check: { kind: 'multivariable.tangentPlane', task },
      };
    }
    const { f, p, g, f0 } = fWithPoint(rng, difficulty === 'hard' ? 'medium' : difficulty, ['x', 'y']);
    const [a, b] = p as [number, number];
    // L(x, y) = f0 + fx(x − a) + fy(y − b)
    const C = f0.sub(g[0]!.mul(a)).sub(g[1]!.mul(b));
    const Ltex = (A: Frac, B: Frac, c: Frac) => sum([{ coef: A, sym: 'x' }, { coef: B, sym: 'y' }, { coef: c }]);
    const P3 = `(${a}, ${b}, ${num(f0)})`;
    switch (task) {
      case 'graph': {
        const ans = (A: Frac, B: Frac, c: Frac) => m(`z = ${Ltex(A, B, c)}`);
        return {
          question: `Find an equation of the tangent plane to ${m(`z = ${tex(f)}`)} at the point ${m(P3)}.`,
          answer: ans(g[0]!, g[1]!, C),
          steps: [
            m(`f_{x}(${a}, ${b}) = ${num(g[0]!)},\\ f_{y}(${a}, ${b}) = ${num(g[1]!)}`),
            m(`${sum([{ coef: 1, sym: 'z' }, { coef: f0.neg() }])} = ${lincomb([[g[0]!, sum([{ coef: 1, sym: 'x' }, { coef: -a }])], [g[1]!, sum([{ coef: 1, sym: 'y' }, { coef: -b }])]])}`),
            ans(g[0]!, g[1]!, C),
          ],
          wrongs: [ans(g[1]!, g[0]!, f0.sub(g[1]!.mul(a)).sub(g[0]!.mul(b))), ans(g[0]!, g[1]!, f0.add(g[0]!.mul(a)).add(g[1]!.mul(b))), ans(g[0]!, g[1]!, f0)],
          fallback: (k) => ans(g[0]!, g[1]!, C.add(offset(k))),
          check: { kind: 'multivariable.tangentPlane', task },
        };
      }
      case 'linearization': {
        const ans = (A: Frac, B: Frac, c: Frac) => m(`L(x, y) = ${Ltex(A, B, c)}`);
        return {
          question: `Find the linearization ${m('L(x, y)')} of ${m(fdef(f, ['x', 'y']))} at ${m(`(${a}, ${b})`)}.`,
          answer: ans(g[0]!, g[1]!, C),
          steps: [m(`f(${a}, ${b}) = ${num(f0)},\\ f_{x}(${a}, ${b}) = ${num(g[0]!)},\\ f_{y}(${a}, ${b}) = ${num(g[1]!)}`), ans(g[0]!, g[1]!, C)],
          wrongs: [ans(g[1]!, g[0]!, f0.sub(g[1]!.mul(a)).sub(g[0]!.mul(b))), ans(g[0]!, g[1]!, f0.add(g[0]!.mul(a)).add(g[1]!.mul(b))), ans(g[0]!, g[1]!, f0)],
          fallback: (k) => ans(g[0]!, g[1]!, C.add(offset(k))),
          check: { kind: 'multivariable.tangentPlane', task, at: [a, b] },
        };
      }
      case 'approx':
      default: {
        const dx = new Frac(rng.signedInt(1, 5, true), rng.pick([10, 100]));
        const dy = new Frac(rng.signedInt(1, 5, true), rng.pick([10, 100]));
        const tx = dx.add(a);
        const ty = dy.add(b);
        const est = f0.add(g[0]!.mul(dx)).add(g[1]!.mul(dy));
        const show = (x: Frac) => decimal(x.value, 4);
        const ans = (v: number) => m(`f(${show(tx)}, ${show(ty)}) \\approx ${decimal(v, 4)}`);
        return {
          question: `Use the linearization of ${m(fdef(f, ['x', 'y']))} at ${m(`(${a}, ${b})`)} to approximate ${m(`f(${show(tx)}, ${show(ty)})`)}.`,
          answer: ans(est.value),
          steps: [m(`f(${a}, ${b}) = ${num(f0)},\\ f_{x}(${a}, ${b}) = ${num(g[0]!)},\\ f_{y}(${a}, ${b}) = ${num(g[1]!)}`), m(`L = ${num(f0)} + (${num(g[0]!)})(${show(dx)}) + (${num(g[1]!)})(${show(dy)})`), ans(est.value)],
          wrongs: [ans(f0.add(g[1]!.mul(dx)).add(g[0]!.mul(dy)).value), ans(f0.value), ans(f0.sub(g[0]!.mul(dx)).sub(g[1]!.mul(dy)).value)],
          fallback: (k) => ans(est.value + offset(k) / 10),
          check: { kind: 'multivariable.tangentPlane', task, at: [a, b] },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- local extrema

type CP = { x: number; y: number; kind: 'max' | 'min' | 'saddle' };
const LABEL = { max: ['local maximum', 'local maxima'], min: ['local minimum', 'local minima'], saddle: ['saddle point', 'saddle points'] } as const;

function describe(cps: readonly CP[]): string {
  const parts: string[] = [];
  for (const k of ['max', 'min', 'saddle'] as const) {
    const ps = cps.filter((c) => c.kind === k).sort((a, b) => a.x - b.x || a.y - b.y);
    if (!ps.length) continue;
    const label = LABEL[k][ps.length > 1 ? 1 : 0];
    const list = ps.map((c) => m(`(${c.x}, ${c.y})`));
    parts.push(`${label} at ${list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]}`);
  }
  const s = parts.join('; ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** f with known critical points. */
function extremaFunction(rng: Rng, d: Difficulty): { f: MX; cps: CP[] } {
  const fam = rng.pick(d === 'easy' ? ['quad', 'sep'] : d === 'medium' ? ['sep', 'cubic', 'quad'] : ['sep2', 'cubic', 'quartic', 'sep']);
  const classify = (fxx: number, fyy: number, fxy: number): CP['kind'] => {
    const D = fxx * fyy - fxy * fxy;
    if (D < 0) return 'saddle';
    if (D === 0) throw new Error('degenerate');
    return fxx > 0 ? 'min' : 'max';
  };
  switch (fam) {
    case 'quad': {
      // f = A(x − h)² + B(x − h)(y − k) + C(y − k)², expanded (constant dropped)
      return attempt('quad', () => {
        const A = rng.signedInt(1, 4, true);
        const B = rng.int(-4, 4);
        const C = rng.signedInt(1, 4, true);
        const D = 4 * A * C - B * B;
        if (D === 0) return null;
        const h = rng.int(-3, 3);
        const k = rng.int(-3, 3);
        const f = norm([mt(A, { x: 2 }), mt(B, { x: 1, y: 1 }), mt(C, { y: 2 }), mt(-2 * A * h - B * k, { x: 1 }), mt(-2 * C * k - B * h, { y: 1 })]);
        return { f, cps: [{ x: h, y: k, kind: classify(2 * A, 2 * C, B) }] };
      });
    }
    case 'sep':
    case 'sep2': {
      // P(x) cubic with P' = 3a(x − r1)(x − r2); Q(y) quadratic (sep) or cubic (sep2)
      const cubic = (v: string) => {
        const a = rng.pick([1, -1]);
        const r1 = rng.int(-3, 2);
        const r2 = rng.int(r1 + 1, 3);
        // ∫ 3a(x − r1)(x − r2) = a x³ − (3a/2)(r1 + r2)x² + 3a r1 r2 x; double when the middle coefficient is fractional
        const k = (r1 + r2) % 2 === 0 ? 1 : 2;
        const poly = norm([mt(k * a, { [v]: 3 }), mt(new Frac(-3 * a * k * (r1 + r2), 2), { [v]: 2 }), mt(3 * a * k * r1 * r2, { [v]: 1 })]);
        return { poly, roots: [r1, r2], second: (t: number) => 6 * a * k * t - 3 * a * k * (r1 + r2) };
      };
      const quadratic = (v: string) => {
        const c = rng.signedInt(1, 3, true);
        const q = rng.int(-3, 3);
        return { poly: norm([mt(c, { [v]: 2 }), mt(-2 * c * q, { [v]: 1 })]), roots: [q], second: () => 2 * c };
      };
      const P = cubic('x');
      const Q = fam === 'sep2' ? cubic('y') : quadratic('y');
      const f = norm([...P.poly, ...Q.poly]);
      const cps: CP[] = [];
      for (const x of P.roots) for (const y of Q.roots) cps.push({ x, y, kind: classify(P.second(x), Q.second(y), 0) });
      return { f, cps };
    }
    case 'cubic': {
      const k = rng.signedInt(1, 3, true);
      const f = norm([mt(1, { x: 3 }), mt(1, { y: 3 }), mt(-3 * k, { x: 1, y: 1 })]);
      return { f, cps: [{ x: 0, y: 0, kind: 'saddle' }, { x: k, y: k, kind: k > 0 ? 'min' : 'max' }] };
    }
    case 'quartic':
    default: {
      const s = rng.sign();
      const neg = rng.bool(0.3) ? -1 : 1;
      const f = norm([mt(neg, { x: 4 }), mt(neg, { y: 4 }), mt(-4 * s * neg, { x: 1, y: 1 })]);
      const kind = neg > 0 ? 'min' : 'max';
      return { f, cps: [{ x: 0, y: 0, kind: 'saddle' }, { x: 1, y: s, kind }, { x: -1, y: -s, kind }] };
    }
  }
}

export const localExtrema = taskTopic<'classify'>({
  id: 'mv.partial.extrema',
  title: 'Local Extrema and Saddle Points',
  description: 'Find all critical points and classify them with the second derivative test.',
  category: CAT,
  instruction: 'Find and classify all critical points.',
  defaultCount: 8,
  tasks: [{ value: 'classify', label: 'Classify critical points' }],
  mix: { easy: ['classify'], medium: ['classify'], hard: ['classify'] },
  build(_task, { rng, difficulty }) {
    const { f, cps } = attempt('extrema', () => {
      try {
        return extremaFunction(rng, difficulty);
      } catch {
        return null;
      }
    });
    const fx = diff(f, 'x');
    const fy = diff(f, 'y');
    const answer = describe(cps);
    const flip = { max: 'min', min: 'max', saddle: 'min' } as const;
    const wrong1 = describe(cps.map((c) => ({ ...c, kind: flip[c.kind] })));
    const wrong2 = describe(cps.map((c) => ({ ...c, kind: c.kind === 'saddle' ? 'max' : c.kind })));
    const wrong3 = cps.length > 1 ? describe(cps.slice(1)) : describe([{ ...cps[0]!, y: -cps[0]!.y || 1 }]);
    const wrong4 = describe(cps.map((c) => ({ ...c, kind: c.kind === 'saddle' ? 'min' : 'saddle' })));
    return {
      question: `${m(fdef(f, ['x', 'y']))}`,
      answer,
      steps: [m(`f_{x} = ${tex(fx)} = 0,\\ f_{y} = ${tex(fy)} = 0`), `Critical points: ${cps.map((c) => m(`(${c.x}, ${c.y})`)).join(', ')}`, m(`D = f_{xx}f_{yy} - (f_{xy})^{2},\\ f_{xx} = ${tex(diff(fx, 'x'))},\\ f_{yy} = ${tex(diff(fy, 'y'))},\\ f_{xy} = ${tex(diff(fx, 'y'))}`), answer],
      wrongs: [wrong1, wrong2, wrong3, wrong4],
      fallback: (k) => describe(cps.map((c, i) => (i === 0 ? { ...c, x: c.x + k } : c))),
      check: { kind: 'multivariable.extrema' },
    };
  },
});

// ---------------------------------------------------------------- Lagrange multipliers

const PY2: Array<[number, number]> = [
  [3, 4],
  [6, 8],
  [5, 12],
  [8, 15],
  [4, 3],
  [12, 5],
];
const PY3: Array<[number, number, number]> = [
  [1, 2, 2],
  [2, 3, 6],
  [2, 6, 9],
  [4, 4, 7],
  [1, 4, 8],
];

interface LProblem {
  f: string;
  g: string;
  vars: string[];
  max: Ex;
  min: Ex;
  wrong: Array<[Ex, Ex]>;
  step: string;
}

function lagrangeProblem(rng: Rng, d: Difficulty): LProblem {
  const fam = rng.pick(d === 'easy' ? ['linear', 'quadform'] : d === 'medium' ? ['linear', 'quadform', 'xy', 'ellipse', 'x2y'] : ['linear3', 'xyz', 'x2y', 'linear', 'ellipse']);
  const sgn = (k: number, s: string) => (k === 1 ? s : k === -1 ? `-${s}` : `${k}${s}`);
  switch (fam) {
    case 'linear': {
      let [a, b] = d === 'easy' ? rng.pick(PY2) : [rng.signedInt(1, 5, true), rng.signedInt(1, 5, true)];
      if (d === 'easy') {
        a *= rng.sign();
        b *= rng.sign();
      }
      const r = rng.int(1, 4);
      const M = exRad(r, a * a + b * b);
      return {
        f: sum([{ coef: a, sym: 'x' }, { coef: b, sym: 'y' }]),
        g: `x^{2} + y^{2} = ${r * r}`,
        vars: ['x', 'y'],
        max: M,
        min: exScale(M, -1),
        wrong: [[ex(r * (Math.abs(a) + Math.abs(b))), ex(-r * (Math.abs(a) + Math.abs(b)))], [exRad(r * r, a * a + b * b), exRad(-r * r, a * a + b * b)], [M, ex(0)]],
        step: m(`\\nabla f = \\lambda\\nabla g:\\ ${a} = 2\\lambda x,\\ ${b} = 2\\lambda y`),
      };
    }
    case 'quadform': {
      const a = rng.signedInt(1, 6, true);
      const b = rng.intExcept(-6, 6, [0, a]);
      const r = rng.int(1, 3);
      const hi = Math.max(a, b) * r * r;
      const lo = Math.min(a, b) * r * r;
      return {
        f: sum([{ coef: a, sym: 'x^{2}' }, { coef: b, sym: 'y^{2}' }]),
        g: `x^{2} + y^{2} = ${r * r}`,
        vars: ['x', 'y'],
        max: ex(hi),
        min: ex(lo),
        wrong: [[ex(hi * r), ex(lo * r)], [ex((a + b) * r * r), ex(lo)], [ex(hi), ex(0)]],
        step: m(`${2 * a}x = 2\\lambda x,\\ ${2 * b}y = 2\\lambda y`),
      };
    }
    case 'xy': {
      const k = rng.int(1, 4);
      const r = rng.int(1, 4);
      const v = new Frac(k * r * r, 2);
      return {
        f: sgn(k, 'xy'),
        g: `x^{2} + y^{2} = ${r * r}`,
        vars: ['x', 'y'],
        max: ex(v),
        min: ex(v.neg()),
        wrong: [[ex(k * r * r), ex(-k * r * r)], [ex(v), ex(0)], [ex(new Frac(k * r, 2)), ex(new Frac(-k * r, 2))]],
        step: m(`${sgn(k, 'y')} = 2\\lambda x,\\ ${sgn(k, 'x')} = 2\\lambda y`),
      };
    }
    case 'ellipse': {
      // f = x² + y² on b²x² + a²y² = a²b²
      const a = rng.int(1, 4);
      const b = rng.intExcept(1, 5, [a]);
      return {
        f: 'x^{2} + y^{2}',
        g: `${sgn(b * b, 'x^{2}')} + ${sgn(a * a, 'y^{2}')} = ${a * a * b * b}`,
        vars: ['x', 'y'],
        max: ex(Math.max(a, b) ** 2),
        min: ex(Math.min(a, b) ** 2),
        wrong: [[ex(Math.max(a, b)), ex(Math.min(a, b))], [ex(a * a * b * b), ex(Math.min(a, b) ** 2)], [ex(Math.max(a, b) ** 2), ex(0)]],
        step: m(`2x = ${2 * b * b}\\lambda x,\\ 2y = ${2 * a * a}\\lambda y`),
      };
    }
    case 'x2y': {
      const k = rng.int(1, 3);
      const c = rng.int(1, 3);
      return {
        f: sgn(c, 'x^{2}y'),
        g: `x^{2} + y^{2} = ${3 * k * k}`,
        vars: ['x', 'y'],
        max: ex(2 * c * k ** 3),
        min: ex(-2 * c * k ** 3),
        wrong: [[ex(c * 3 * k * k), ex(-c * 3 * k * k)], [ex(2 * c * k ** 3), ex(0)], [ex(c * k ** 3), ex(-c * k ** 3)]],
        step: m(`${sgn(2 * c, 'xy')} = 2\\lambda x,\\ ${sgn(c, 'x^{2}')} = 2\\lambda y`),
      };
    }
    case 'linear3': {
      const [a, b, c] = rng.pick(PY3).map((x) => x * rng.sign());
      const r = rng.int(1, 3);
      const n = Math.sqrt(a! * a! + b! * b! + c! * c!);
      return {
        f: sum([{ coef: a!, sym: 'x' }, { coef: b!, sym: 'y' }, { coef: c!, sym: 'z' }]),
        g: `x^{2} + y^{2} + z^{2} = ${r * r}`,
        vars: ['x', 'y', 'z'],
        max: ex(r * n),
        min: ex(-r * n),
        wrong: [[ex(r * (Math.abs(a!) + Math.abs(b!) + Math.abs(c!))), ex(-r * (Math.abs(a!) + Math.abs(b!) + Math.abs(c!)))], [ex(r * r * n), ex(-r * r * n)], [ex(r * n), ex(0)]],
        step: m(`${a} = 2\\lambda x,\\ ${b} = 2\\lambda y,\\ ${c} = 2\\lambda z`),
      };
    }
    case 'xyz':
    default: {
      const k = rng.int(1, 3);
      const c = rng.int(1, 4);
      return {
        f: sgn(c, 'xyz'),
        g: `x^{2} + y^{2} + z^{2} = ${3 * k * k}`,
        vars: ['x', 'y', 'z'],
        max: ex(c * k ** 3),
        min: ex(-c * k ** 3),
        wrong: [[ex(3 * c * k * k), ex(-3 * c * k * k)], [ex(c * k ** 3), ex(0)], [ex(c * k ** 3 * 3), ex(-c * k ** 3 * 3)]],
        step: m(`${sgn(c, 'yz')} = 2\\lambda x,\\ ${sgn(c, 'xz')} = 2\\lambda y,\\ ${sgn(c, 'xy')} = 2\\lambda z`),
      };
    }
  }
}

export const lagrange = taskTopic<'maxmin'>({
  id: 'mv.partial.lagrange',
  title: 'Lagrange Multipliers',
  description: 'Maximum and minimum values of a function subject to a constraint, by Lagrange multipliers.',
  category: CAT,
  instruction: 'Use Lagrange multipliers to find the maximum and minimum values of f subject to the given constraint.',
  defaultCount: 8,
  tasks: [{ value: 'maxmin', label: 'Maximum and minimum' }],
  mix: { easy: ['maxmin'], medium: ['maxmin'], hard: ['maxmin'] },
  build(_t, { rng, difficulty }) {
    const L = lagrangeProblem(rng, difficulty);
    const ans = (hi: Ex, lo: Ex) => `Maximum: ${m(exTex(hi))}; minimum: ${m(exTex(lo))}`;
    return {
      question: `${m(`f(${L.vars.join(', ')}) = ${L.f}`)} subject to ${m(L.g)}`,
      answer: ans(L.max, L.min),
      steps: [L.step, 'Solve together with the constraint and compare the values of f at the solutions.', ans(L.max, L.min)],
      wrongs: L.wrong.map(([a, b]) => ans(a, b)),
      fallback: (k) => ans(exScale(L.max, k + 1), exScale(L.min, k + 1)),
      check: { kind: 'multivariable.lagrange' },
    };
  },
});
