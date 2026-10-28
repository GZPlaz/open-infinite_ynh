/** Vector fields, divergence and curl, conservative fields, line integrals, the fundamental theorem for line integrals. */
import { Frac } from '../../fraction';
import { attempt, offset } from '../../generator';
import type { Rng } from '../../rng';
import { m, num, sum } from '../../tex';
import type { Difficulty } from '../../types';
import {
  add,
  constOf,
  diff,
  evalExact,
  ex,
  exAdd,
  exMul,
  exRad,
  exScale,
  exTex,
  integ,
  mt,
  mul,
  norm,
  norm2,
  randF,
  randMono,
  scale,
  sorted,
  sub,
  subst,
  taskTopic,
  tex,
  trigPolyIntegral,
  vtex,
  type Ex,
  type MX,
} from './common';

const CAT = 'Vector Calculus';
const XYZ = ['x', 'y', 'z'];
const F = '\\mathbf{F}';
const fieldTex = (comps: readonly MX[], vars: readonly string[]) => `${F}(${vars.join(', ')}) = ${vtex(comps.map(tex))}`;
const pt = (p: readonly number[]) => `(${p.join(', ')})`;

function randPoly(rng: Rng, vars: readonly string[], maxDeg: number, n: number, cmax = 5): MX {
  for (;;) {
    const f = norm(Array.from({ length: n }, () => mt(rng.signedInt(1, cmax, true), randMono(rng, vars, 0, maxDeg))));
    if (f.length === n && f.some((t) => Object.keys(t.e).length)) return sorted(f);
  }
}

function randField(rng: Rng, d: Difficulty, vars: readonly string[]): MX[] {
  return attempt('field', () => {
    const comps = vars.map(() => (d === 'easy' ? randPoly(rng, vars, 2, rng.int(1, 2)) : sorted(randF(rng, d === 'hard' ? 'medium' : 'easy', vars, d === 'hard'))));
    return new Set(comps.map(tex)).size === comps.length ? comps : null;
  });
}

// ---------------------------------------------------------------- vector fields

const DESCRIPTIONS = ['Points directly away from the origin', 'Points directly toward the origin', 'Circulates counterclockwise about the origin', 'Circulates clockwise about the origin', 'Constant: every vector is the same'] as const;

type FTask = 'evaluate' | 'magnitude' | 'gradientField' | 'describe';

export const vectorFields = taskTopic<FTask>({
  id: 'mv.vcalc.fields',
  title: 'Vector Fields',
  description: 'Evaluate vector fields, find magnitudes and gradient fields, and describe simple fields in the plane.',
  category: CAT,
  instruction: 'Answer each question.',
  tasks: [
    { value: 'evaluate', label: 'Evaluate a vector field' },
    { value: 'magnitude', label: 'Magnitude at a point' },
    { value: 'gradientField', label: 'Gradient vector field' },
    { value: 'describe', label: 'Describe a field' },
  ],
  mix: { easy: ['evaluate', 'describe', 'gradientField'], medium: ['evaluate', 'magnitude', 'gradientField', 'describe'], hard: ['magnitude', 'gradientField', 'describe'] },
  build(task, { rng, difficulty }) {
    const three = difficulty !== 'easy' && rng.bool(0.5);
    const vars = three ? XYZ : ['x', 'y'];
    switch (task) {
      case 'evaluate':
      case 'magnitude': {
        const { comps, P, val } = attempt('evaluate', () => {
          const comps = randField(rng, difficulty === 'hard' ? 'medium' : difficulty, vars);
          const P = vars.map(() => rng.int(-3, 3));
          const env = Object.fromEntries(vars.map((v, i) => [v, P[i]!]));
          const val = comps.map((c) => evalExact(c, env));
          if (val.some((x) => !x || !x.isInt() || Math.abs(x.n) > 40) || val.every((x) => x!.isZero())) return null;
          return { comps, P, val: val.map((x) => x!.n) };
        });
        const at = `${F}${pt(P)}`;
        if (task === 'evaluate') {
          const ans = (w: readonly number[]) => m(`${at} = ${vtex(w)}`);
          return {
            question: `Find ${m(at)} for ${m(fieldTex(comps, vars))}.`,
            answer: ans(val),
            steps: [`Substitute ${vars.map((v, i) => m(`${v} = ${P[i]}`)).join(', ')} into each component.`, ans(val)],
            wrongs: [ans([...val].reverse()), ans(val.map((x) => -x)), ans(val.map((x, i) => (i === 0 ? x + 1 : x)))],
            fallback: (k) => ans(val.map((x, i) => (i === k % val.length ? x + offset(k) : x))),
            check: { kind: 'multivariable.field', task },
          };
        }
        const n = norm2(val);
        const ans = (e: Ex) => m(`\\|${at}\\| = ${exTex(e)}`);
        return {
          question: `Find the magnitude of ${m(fieldTex(comps, vars))} at ${m(pt(P))}.`,
          answer: ans(exRad(1, n)),
          steps: [m(`${at} = ${vtex(val)}`), ans(exRad(1, n))],
          wrongs: [ans(ex(n)), ans(ex(val.reduce((s, x) => s + Math.abs(x), 0))), ans(exRad(1, n + 1))],
          fallback: (k) => ans(exRad(1, n + k + 1)),
          check: { kind: 'multivariable.field', task },
        };
      }
      case 'gradientField': {
        const f = sorted(randF(rng, difficulty, vars, difficulty !== 'easy'));
        const g = vars.map((v) => diff(f, v));
        const ans = (cs: MX[]) => m(`${F} = \\nabla f = ${vtex(cs.map(tex))}`);
        return {
          question: `Find the gradient vector field of ${m(`f(${vars.join(', ')}) = ${tex(f)}`)}.`,
          answer: ans(g),
          steps: vars.map((v, i) => m(`f_{${v}} = ${tex(g[i]!)}`)).concat(ans(g)),
          wrongs: [ans([...g].reverse()), ans(g.map((c) => scale(c, -1))), ans(g.map((c, i) => (i === 0 ? norm([...c, ...f.filter((t) => !t.e.x && !t.a)]) : c)))],
          fallback: (k) => ans(g.map((c, i) => (i === k % g.length ? norm([...c, mt(offset(k))]) : c))),
          check: { kind: 'multivariable.field', task },
        };
      }
      case 'describe':
      default: {
        const kind = rng.pick(DESCRIPTIONS);
        const k = rng.int(1, 6);
        const s = (n: number) => (n === 1 ? '' : String(n));
        let comps: string[];
        switch (kind) {
          case 'Points directly away from the origin':
            comps = [`${s(k)}x`, `${s(k)}y`];
            break;
          case 'Points directly toward the origin':
            comps = [`-${s(k)}x`, `-${s(k)}y`];
            break;
          case 'Circulates counterclockwise about the origin':
            comps = [`-${s(k)}y`, `${s(k)}x`];
            break;
          case 'Circulates clockwise about the origin':
            comps = [`${s(k)}y`, `-${s(k)}x`];
            break;
          default: {
            const a = rng.int(-5, 5);
            const b = rng.intExcept(-5, 5, a === 0 ? [0] : []);
            comps = [String(a), String(b)];
          }
        }
        if (difficulty === 'hard' && kind !== 'Constant: every vector is the same' && rng.bool(0.5)) comps = comps.map((c) => `\\frac{${c}}{\\sqrt{x^{2} + y^{2}}}`);
        const near: Record<string, string[]> = {
          'Points directly away from the origin': ['Points directly toward the origin', 'Circulates counterclockwise about the origin', 'Constant: every vector is the same'],
          'Points directly toward the origin': ['Points directly away from the origin', 'Circulates clockwise about the origin', 'Constant: every vector is the same'],
          'Circulates counterclockwise about the origin': ['Circulates clockwise about the origin', 'Points directly away from the origin', 'Points directly toward the origin'],
          'Circulates clockwise about the origin': ['Circulates counterclockwise about the origin', 'Points directly toward the origin', 'Points directly away from the origin'],
          'Constant: every vector is the same': ['Points directly away from the origin', 'Circulates counterclockwise about the origin', 'Circulates clockwise about the origin'],
        };
        return {
          question: `Describe the vector field ${m(`${F}(x, y) = ${vtex(comps)}`)}.`,
          answer: kind,
          steps: [kind.startsWith('Points') ? `${m(F)} is a multiple of the position vector ${m('\\langle x, y \\rangle')}.` : kind.startsWith('Circ') ? `${m(`${F} \\cdot \\langle x, y \\rangle = 0`)}, so every vector is tangent to a circle about the origin.` : 'The components do not depend on x or y.', kind],
          wrongs: near[kind]!,
          fallback: () => null,
          check: { kind: 'multivariable.field', task },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- divergence and curl

export const divOf = (c: readonly MX[]) => sorted(add(...c.map((x, i) => diff(x, XYZ[i]!))));
export const curlOf = (c: readonly MX[]): MX[] => [sub(diff(c[2]!, 'y'), diff(c[1]!, 'z')), sub(diff(c[0]!, 'z'), diff(c[2]!, 'x')), sub(diff(c[1]!, 'x'), diff(c[0]!, 'y'))].map(sorted);

type DTask = 'div' | 'curl' | 'divPoint' | 'curlPoint';

export const divCurl = taskTopic<DTask>({
  id: 'mv.vcalc.div-curl',
  title: 'Divergence and Curl',
  description: 'Divergence and curl of vector fields in space, as expressions and at points.',
  category: CAT,
  instruction: 'Find the indicated quantity.',
  tasks: [
    { value: 'div', label: 'Divergence' },
    { value: 'curl', label: 'Curl' },
    { value: 'divPoint', label: 'Divergence at a point' },
    { value: 'curlPoint', label: 'Curl at a point' },
  ],
  mix: { easy: ['div', 'curl'], medium: ['div', 'curl', 'divPoint', 'curlPoint'], hard: ['curl', 'div', 'curlPoint'] },
  build(task, { rng, difficulty }) {
    const D = '\\nabla \\cdot \\mathbf{F}';
    const C = '\\nabla \\times \\mathbf{F}';
    if (task === 'div' || task === 'curl') {
      const c = attempt('div/curl', () => {
        const c = randField(rng, difficulty, XYZ);
        return divOf(c).length && curlOf(c).some((x) => x.length) ? c : null;
      });
      if (task === 'div') {
        const ans = (e: MX) => m(`${D} = ${tex(e)}`);
        const wrongSum = add(diff(c[0]!, 'y'), diff(c[1]!, 'z'), diff(c[2]!, 'x'));
        return {
          question: `Find the divergence of ${m(fieldTex(c, XYZ))}.`,
          answer: ans(divOf(c)),
          steps: [m(`${D} = \\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}`), ans(divOf(c))],
          wrongs: [ans(wrongSum), ans(add(diff(c[0]!, 'x'), diff(c[1]!, 'y'))), ans(scale(divOf(c), -1))],
          fallback: (k) => ans(norm([...divOf(c), mt(offset(k))])),
          check: { kind: 'multivariable.divcurl', task },
        };
      }
      const cu = curlOf(c);
      const ans = (w: MX[]) => m(`${C} = ${vtex(w.map(tex))}`);
      return {
        question: `Find the curl of ${m(fieldTex(c, XYZ))}.`,
        answer: ans(cu),
        steps: [m(`${C} = \\left\\langle R_{y} - Q_{z},\\ P_{z} - R_{x},\\ Q_{x} - P_{y} \\right\\rangle`), ans(cu)],
        wrongs: [ans(cu.map((x) => scale(x, -1))), ans([cu[0]!, scale(cu[1]!, -1), cu[2]!]), ans([...cu].reverse())],
        fallback: (k) => ans(cu.map((x, i) => (i === k % 3 ? norm([...x, mt(offset(k))]) : x))),
        check: { kind: 'multivariable.divcurl', task },
      };
    }
    const { c, P, dv, cv } = attempt('at point', () => {
      const c = randField(rng, difficulty === 'easy' ? 'easy' : 'medium', XYZ);
      const P = [rng.int(-2, 2), rng.int(-2, 2), rng.int(-2, 2)];
      const env = { x: P[0]!, y: P[1]!, z: P[2]! };
      const dv = evalExact(divOf(c), env);
      const cv = curlOf(c).map((x) => evalExact(x, env));
      if (!dv || cv.some((x) => !x) || (task === 'curlPoint' && cv.every((x) => x!.isZero()))) return null;
      return { c, P, dv, cv: cv as Frac[] };
    });
    if (task === 'divPoint') {
      const ans = (v: Frac) => m(`${D} = ${num(v)}`);
      return {
        question: `Find the divergence of ${m(fieldTex(c, XYZ))} at ${m(pt(P))}.`,
        answer: ans(dv),
        steps: [m(`${D} = ${tex(divOf(c))}`), ans(dv)],
        wrongs: [ans(dv.neg()), ans(dv.add(1)), ans(cv.reduce((s, x) => s.add(x), Frac.ZERO).eq(dv) ? dv.add(2) : cv.reduce((s, x) => s.add(x), Frac.ZERO))],
        fallback: (k) => ans(dv.add(offset(k) + 1)),
        check: { kind: 'multivariable.divcurl', task },
      };
    }
    const ans = (w: readonly Frac[]) => m(`${C} = ${vtex(w)}`);
    return {
      question: `Find the curl of ${m(fieldTex(c, XYZ))} at ${m(pt(P))}.`,
      answer: ans(cv),
      steps: [m(`${C} = ${vtex(curlOf(c).map(tex))}`), ans(cv)],
      wrongs: [ans(cv.map((x) => x.neg())), ans([cv[0]!, cv[1]!.neg(), cv[2]!]), ans([...cv].reverse())],
      fallback: (k) => ans(cv.map((x, i) => (i === k % 3 ? x.add(offset(k)) : x))),
      check: { kind: 'multivariable.divcurl', task },
    };
  },
});

// ---------------------------------------------------------------- conservative fields

const NOT = 'Not conservative';

/** Integrate each component in its own variable and add (double-counting mixed terms) — the classic slip. */
function naivePotential(f: MX, vars: readonly string[]): MX {
  return norm(f.map((t) => ({ ...t, c: t.c.mul(Math.max(1, vars.filter((v) => (t.e[v] ?? 0) !== 0 || (t.a?.e[v] ?? 0) !== 0).length)) })));
}

export const conservativeFields = taskTopic<'potential'>({
  id: 'mv.vcalc.conservative',
  title: 'Conservative Vector Fields and Potential Functions',
  description: 'Test whether a vector field is conservative and find a potential function.',
  category: CAT,
  instruction: 'Determine whether the vector field is conservative. If it is, find a potential function f.',
  tasks: [{ value: 'potential', label: 'Test and find a potential' }],
  mix: { easy: ['potential'], medium: ['potential'], hard: ['potential'] },
  options: [{ type: 'boolean', id: 'threeD', label: 'Include fields in space', default: true }],
  build(_t, ctx) {
    const { rng, difficulty } = ctx;
    const three = ctx.options.threeD !== false && difficulty !== 'easy' && rng.bool(0.5);
    const vars = three ? XYZ : ['x', 'y'];
    const conservative = rng.bool(0.65);
    const { f, comps } = attempt('potential', () => {
      const f = sorted(randF(rng, difficulty, vars, difficulty !== 'easy'));
      // a potential needs a mixed term to make the test interesting
      if (!f.some((t) => Object.keys(t.e).length + (t.a ? Object.keys(t.a.e).length : 0) >= 2)) return null;
      const comps = vars.map((v) => diff(f, v));
      if (conservative) return { f, comps };
      // spoil one mixed partial: change the coefficient of one term of one component
      const i = rng.int(0, vars.length - 1);
      const ci = comps[i]!;
      const j = ci.findIndex((t) => Object.keys({ ...t.e, ...(t.a?.e ?? {}) }).some((v) => v !== vars[i]));
      if (j < 0) return null;
      const bad = ci.map((t, k) => (k === j ? { ...t, c: t.c.mul(rng.pick([2, -1, 3])) } : t));
      const next = comps.map((c, k) => (k === i ? norm(bad) : c));
      const curl = vars.length === 2 ? [sub(diff(next[1]!, 'x'), diff(next[0]!, 'y'))] : curlOf(next);
      return curl.some((x) => x.length) ? { f, comps: next } : null;
    });
    const pot = (g: MX) => m(`f(${vars.join(', ')}) = ${tex(g)} + C`);
    const answer = conservative ? pot(f) : NOT;
    const wrongs = conservative ? [NOT, pot(naivePotential(f, vars)), pot(norm(f.map((t, k) => (k === f.length - 1 ? { ...t, c: t.c.neg() } : t))))] : [pot(f), pot(naivePotential(f, vars)), pot(norm(f.map((t, k) => (k === 0 ? { ...t, c: t.c.mul(2) } : t))))];
    const mixed = vars.length === 2 ? m(`\\frac{\\partial P}{\\partial y} = ${tex(diff(comps[0]!, 'y'))},\\ \\frac{\\partial Q}{\\partial x} = ${tex(diff(comps[1]!, 'x'))}`) : m(`\\nabla \\times \\mathbf{F} = ${vtex(curlOf(comps).map(tex))}`);
    return {
      question: m(fieldTex(comps, vars)),
      answer,
      steps: [mixed, conservative ? `The test is satisfied, so ${m(F)} is conservative. Integrate and match terms.` : 'The test fails, so the field is not conservative.', answer],
      wrongs,
      fallback: (k) => pot(norm([...f, mt(1, { [vars[0]!]: 1 }), mt(k)].slice(0, f.length + 1))),
      check: { kind: 'multivariable.conservative', vars },
    };
  },
});

// ---------------------------------------------------------------- line integrals

type LTask = 'scalarSegment' | 'scalarCircle' | 'vectorCurve' | 'work' | 'differential';

const tPoly = (rng: Rng, deg: number): MX => norm([mt(rng.signedInt(1, 3, true), { t: deg }), ...(rng.bool(0.5) ? [mt(rng.int(-2, 2))] : [])]);

export const lineIntegrals = taskTopic<LTask>({
  id: 'mv.vcalc.line-integrals',
  title: 'Line Integrals',
  description: 'Line integrals of scalar functions and of vector fields along parametrized curves, and work.',
  category: CAT,
  instruction: 'Evaluate each line integral. Leave answers in exact form.',
  defaultCount: 8,
  tasks: [
    { value: 'scalarSegment', label: 'Scalar, along a segment' },
    { value: 'scalarCircle', label: 'Scalar, along a circle or helix' },
    { value: 'vectorCurve', label: 'Vector field along a curve' },
    { value: 'work', label: 'Work along a circle' },
    { value: 'differential', label: 'Differential form' },
  ],
  mix: { easy: ['scalarSegment', 'vectorCurve'], medium: ['scalarSegment', 'scalarCircle', 'vectorCurve', 'differential'], hard: ['scalarCircle', 'vectorCurve', 'work', 'differential'] },
  build(task, { rng, difficulty }) {
    const ans = (lhs: string, e: Ex) => m(`${lhs} = ${exTex(e)}`);
    switch (task) {
      case 'scalarSegment': {
        const three = difficulty !== 'easy' && rng.bool(0.5);
        const vars = three ? XYZ : ['x', 'y'];
        const P = vars.map(() => rng.int(-2, 3));
        const Q = attempt('segment', () => {
          const Q = vars.map(() => rng.int(-2, 4));
          return Q.some((x, i) => x !== P[i]) ? Q : null;
        });
        const f = randPoly(rng, vars, difficulty === 'easy' ? 1 : 2, 2, 4);
        const d = Q.map((x, i) => x - P[i]!);
        const N = norm2(d);
        let g = f;
        vars.forEach((v, i) => (g = subst(g, v, norm([mt(P[i]!), mt(d[i]!, { t: 1 })]))));
        const I = constOf(sub(subst(integ(g, 't'), 't', [mt(1)]), subst(integ(g, 't'), 't', [])));
        const val = exRad(I, N);
        const L = '\\int_{C} f\\,ds';
        return {
          question: `Evaluate ${m(`\\displaystyle \\int_{C} ${tex(f).includes(' ') ? `(${tex(f)})` : tex(f)}\\,ds`)}, where ${m('C')} is the line segment from ${m(`P${pt(P)}`)} to ${m(`Q${pt(Q)}`)}.`,
          answer: ans(L, val),
          steps: [m(`\\mathbf{r}(t) = ${vtex(vars.map((_, i) => sum([{ coef: P[i]! }, { coef: d[i]!, sym: 't' }])))},\\ 0 \\le t \\le 1`), m(`\\|\\mathbf{r}'(t)\\| = ${exTex(exRad(1, N))}`), ans(L, val)],
          wrongs: [ans(L, ex(I)), ans(L, exRad(I.mul(2), N)), ans(L, exScale(val, -1))],
          fallback: (k) => ans(L, exRad(I.add(k), N)),
          check: { kind: 'multivariable.lineIntegral', task },
        };
      }
      case 'scalarCircle': {
        const helix = difficulty === 'hard' && rng.bool(0.5);
        const a = rng.int(1, 3);
        const range = rng.pick(['quarter', 'half', 'full'] as const);
        const T = { quarter: '\\frac{\\pi}{2}', half: '\\pi', full: '2\\pi' }[range];
        const b = rng.int(1, 3);
        // f in x, y (polynomial); along the circle x = a cos t, y = a sin t
        const f = attempt('f', () => {
          const f = randPoly(rng, ['x', 'y'], 2, 2, 4);
          const g = subst(subst(f, 'x', [mt(a, { c: 1 })]), 'y', [mt(a, { s: 1 })]);
          return trigPolyIntegral(g, [['c', 's', range]]).length ? f : null;
        });
        const g = subst(subst(f, 'x', [mt(a, { c: 1 })]), 'y', [mt(a, { s: 1 })]);
        const I = trigPolyIntegral(g, [['c', 's', range]]);
        const speed = helix ? exRad(1, a * a + b * b) : ex(a);
        const val = exMul(I, speed);
        const L = '\\int_{C} f\\,ds';
        const comps = [`${a === 1 ? '' : a}\\cos t`, `${a === 1 ? '' : a}\\sin t`, ...(helix ? [`${b === 1 ? '' : b}t`] : [])];
        return {
          question: `Evaluate ${m(`\\displaystyle \\int_{C} ${tex(f).includes(' ') ? `(${tex(f)})` : tex(f)}\\,ds`)}, where ${m(`C: \\mathbf{r}(t) = ${vtex(comps)},\\ 0 \\le t \\le ${T}`)}.`,
          answer: ans(L, val),
          steps: [m(`\\|\\mathbf{r}'(t)\\| = ${exTex(speed)}`), m(`${L} = \\int_{0}^{${T}} f(\\mathbf{r}(t))\\,\\|\\mathbf{r}'(t)\\|\\,dt`), ans(L, val)],
          wrongs: [ans(L, I), ans(L, exScale(val, 2)), ans(L, exScale(val, -1))],
          fallback: (k) => ans(L, exScale(val, k + 2)),
          check: { kind: 'multivariable.lineIntegral', task: 'scalarCurve' },
        };
      }
      case 'work':
      case 'differential':
      case 'vectorCurve':
      default: {
        const circle = task === 'work';
        const three = task === 'vectorCurve' && difficulty !== 'easy' && rng.bool(0.5);
        const vars = three ? XYZ : ['x', 'y'];
        let comps: MX[];
        let r: MX[];
        let t1 = 1;
        let val: Ex;
        let rangeT = '1';
        if (circle) {
          const a = rng.int(1, 3);
          const range = rng.pick(['quarter', 'half', 'full'] as const);
          rangeT = { quarter: '\\frac{\\pi}{2}', half: '\\pi', full: '2\\pi' }[range];
          ({ comps, val } = attempt('work', () => {
            const comps = vars.map(() => randPoly(rng, vars, 2, rng.int(1, 2), 4));
            // F(r(t))·r'(t) with r = (a c, a s), r' = (−a s, a c)
            const sub2 = (g: MX) => subst(subst(g, 'x', [mt(a, { c: 1 })]), 'y', [mt(a, { s: 1 })]);
            const integrand = add(mul(sub2(comps[0]!), [mt(-a, { s: 1 })]), mul(sub2(comps[1]!), [mt(a, { c: 1 })]));
            const val = trigPolyIntegral(integrand, [['c', 's', range]]);
            return val.length ? { comps, val } : null;
          }));
          r = [[mt(a, { c: 1 })], [mt(a, { s: 1 })]];
        } else {
          t1 = rng.int(1, 2);
          r = attempt('curve', () => {
            const r = vars.map((_, i) => (i === 0 && rng.bool(0.5) ? [mt(1, { t: 1 })] : tPoly(rng, rng.int(1, 3))));
            return new Set(r.map(tex)).size === r.length ? r : null;
          });
          comps = vars.map(() => randPoly(rng, vars, difficulty === 'easy' ? 1 : 2, rng.int(1, 2), 4));
          let integrand: MX = [];
          comps.forEach((c, i) => {
            let g = c;
            vars.forEach((v, j) => (g = subst(g, v, r[j]!)));
            integrand = add(integrand, mul(g, diff(r[i]!, 't')));
          });
          const A = integ(integrand, 't');
          val = ex(constOf(sub(subst(A, 't', [mt(t1)]), subst(A, 't', []))));
        }
        const rTex = circle ? vtex(r.map(tex).map((s) => s.replace(/c$/, '\\cos t').replace(/s$/, '\\sin t'))) : vtex(r.map(tex));
        const curve = m(`C: \\mathbf{r}(t) = ${rTex},\\ 0 \\le t \\le ${circle ? rangeT : t1}`);
        const wrongVals = [exScale(val, -1), exScale(val, 2), exAdd(val, ex(1))];
        if (task === 'differential') {
          const form = comps
            .map((c, i) => {
              const single = norm(c).length === 1;
              const neg = single && c[0]!.c.sign < 0;
              const body = single ? tex(neg ? scale(c, -1) : c) : `(${tex(c)})`;
              return `${i === 0 ? (neg ? '-' : '') : neg ? ' - ' : ' + '}${body}\\,d${vars[i]}`;
            })
            .join('');
          const L = `\\int_{C} ${form}`;
          const lhs = '\\int_{C} P\\,dx + Q\\,dy';
          return {
            question: `Evaluate ${m(`\\displaystyle ${L}`)}, where ${curve}.`,
            answer: ans(lhs, val),
            steps: [`Substitute ${m(`x = ${tex(r[0]!)}`)}, ${m(`y = ${tex(r[1]!)}`)}, ${m(`dx = ${tex(diff(r[0]!, 't'))}\\,dt`)}, ${m(`dy = ${tex(diff(r[1]!, 't'))}\\,dt`)}.`, ans(lhs, val)],
            wrongs: wrongVals.map((w) => ans(lhs, w)),
            fallback: (k) => ans(lhs, exAdd(val, ex(k + 1))),
            check: { kind: 'multivariable.lineIntegral', task: 'differential' },
          };
        }
        const lhs = circle ? 'W' : `\\int_{C} ${F} \\cdot d\\mathbf{r}`;
        const lead = circle ? `Find the work done by the force field ${m(fieldTex(comps, vars))} on a particle that moves along ${curve}.` : `Evaluate ${m(`\\displaystyle \\int_{C} ${F} \\cdot d\\mathbf{r}`)} for ${m(fieldTex(comps, vars))}, where ${curve}.`;
        return {
          question: lead,
          answer: ans(lhs, val),
          steps: [m(`\\int_{C} ${F} \\cdot d\\mathbf{r} = \\int ${F}(\\mathbf{r}(t)) \\cdot \\mathbf{r}'(t)\\,dt`), ans(lhs, val)],
          wrongs: wrongVals.map((w) => ans(lhs, w)),
          fallback: (k) => ans(lhs, exAdd(val, ex(k + 1))),
          check: { kind: 'multivariable.lineIntegral', task: 'vector' },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- fundamental theorem for line integrals

export const ftli = taskTopic<'curve' | 'points'>({
  id: 'mv.vcalc.fundamental-theorem',
  title: 'The Fundamental Theorem for Line Integrals',
  description: 'Evaluate line integrals of conservative fields from a potential function.',
  category: CAT,
  instruction: 'Use the Fundamental Theorem for Line Integrals to evaluate each integral.',
  defaultCount: 8,
  tasks: [
    { value: 'curve', label: 'Along a parametrized curve' },
    { value: 'points', label: 'Between two points' },
  ],
  mix: { easy: ['points', 'curve'], medium: ['curve', 'points'], hard: ['curve', 'points'] },
  build(task, { rng, difficulty }) {
    const three = difficulty === 'hard' && rng.bool(0.5);
    const vars = three ? XYZ : ['x', 'y'];
    const { f, A, B, val } = attempt('ftli', () => {
      const f = sorted(randF(rng, difficulty === 'easy' ? 'easy' : 'medium', vars, difficulty !== 'easy'));
      const A = vars.map(() => rng.int(-2, 2));
      const B = vars.map(() => rng.int(-2, 3));
      if (A.every((x, i) => x === B[i])) return null;
      const fa = evalExact(f, Object.fromEntries(vars.map((v, i) => [v, A[i]!])));
      const fb = evalExact(f, Object.fromEntries(vars.map((v, i) => [v, B[i]!])));
      return fa && fb ? { f, A, B, val: fb.sub(fa) } : null;
    });
    const comps = vars.map((v) => diff(f, v));
    const lhs = `\\int_{C} ${F} \\cdot d\\mathbf{r}`;
    const ans = (v: Frac) => m(`${lhs} = ${num(v)}`);
    let where: string;
    if (task === 'curve') {
      // r(t) = A + (B − A)·t^k per component, 0 ≤ t ≤ 1
      const r = vars.map((_, i) => norm([mt(A[i]!), mt(B[i]! - A[i]!, { t: rng.int(1, 3) })]));
      if (r.filter((c) => c.some((t) => t.e.t)).length < Math.min(2, vars.length)) r[0] = norm([...r[0]!, mt(1, { t: 2 }), mt(-1, { t: 1 })]);
      where = `${m(`C: \\mathbf{r}(t) = ${vtex(r.map(tex))},\\ 0 \\le t \\le 1`)}`;
    } else where = `${m('C')} is any smooth curve from ${m(`P${pt(A)}`)} to ${m(`Q${pt(B)}`)}`;
    const fa = evalExact(f, Object.fromEntries(vars.map((v, i) => [v, A[i]!])))!;
    const fb = evalExact(f, Object.fromEntries(vars.map((v, i) => [v, B[i]!])))!;
    return {
      question: `Evaluate ${m(`\\displaystyle ${lhs}`)} for ${m(fieldTex(comps, vars))}, where ${where}.`,
      answer: ans(val),
      steps: [m(`f(${vars.join(', ')}) = ${tex(f)}`), m(`f${pt(B)} - f${pt(A)} = ${num(fb)} - ${fa.sign < 0 ? `(${num(fa)})` : num(fa)}`), ans(val)],
      wrongs: [ans(val.neg()), ans(fb.add(fa)), ans(fb)],
      fallback: (k) => ans(val.add(offset(k))),
      check: { kind: 'multivariable.lineIntegral', task: task === 'curve' ? 'vector' : 'points' },
    };
  },
});
