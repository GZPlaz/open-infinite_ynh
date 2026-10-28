/** Vectors in three dimensions: magnitude, unit vectors, operations, dot and cross products. */
import { Frac } from '../../fraction';
import { attempt, offset } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, sum } from '../../tex';
import type { Difficulty } from '../../types';
import { bf, cross, dot, exRad, exTex, isZeroV, norm2, randV, taskTopic, vadd, vscale, vsub, vtex, type V3 } from './common';

const CAT = 'Vectors and the Geometry of Space';
const U = bf('u');
const V = bf('v');
const W = bf('w');
const NV = (s: string) => `\\|${s}\\|`;

/** Integer vectors whose length is an integer. */
const QUADS: V3[] = [
  [1, 2, 2],
  [2, 3, 6],
  [1, 4, 8],
  [2, 6, 9],
  [4, 4, 7],
  [2, 10, 11],
  [6, 6, 7],
  [3, 4, 12],
  [2, 5, 14],
  [8, 9, 12],
  [1, 12, 12],
];

function quadVec(rng: Rng): V3 {
  const b = rng.shuffle(rng.pick(QUADS));
  const k = rng.pick([1, 1, 2]);
  return b.map((x) => x * k * rng.sign());
}

const pt = (name: string, p: readonly number[]) => `${name}(${p.join(', ')})`;
const sqrtOf = (n: number) => exTex(exRad(1, n));
const vecName = (name: string, v: readonly number[]) => m(`${name} = ${vtex(v)}`);

/** Unit vector components as LaTeX (rationalised). */
const unitTex = (v: readonly number[]) => vtex(v.map((x) => exTex(exRad(new Frac(x, norm2(v)), norm2(v)))));

type VTask = 'magnitude' | 'unit' | 'combo' | 'pq' | 'distance';

export const vectors3d = taskTopic<VTask>({
  id: 'mv.vectors.three-d',
  title: 'Vectors in Three Dimensions',
  description: 'Magnitudes, unit vectors, vector operations, component form and distance in space.',
  category: CAT,
  instruction: 'Answer each question. Leave answers in exact form.',
  tasks: [
    { value: 'magnitude', label: 'Magnitude' },
    { value: 'unit', label: 'Unit vector' },
    { value: 'combo', label: 'Linear combination' },
    { value: 'pq', label: 'Component form from two points' },
    { value: 'distance', label: 'Distance between points' },
  ],
  mix: { easy: ['magnitude', 'combo', 'pq'], medium: ['magnitude', 'unit', 'combo', 'distance'], hard: ['unit', 'combo', 'distance', 'magnitude'] },
  build(task, { rng, difficulty }) {
    const R = difficulty === 'easy' ? 5 : 9;
    switch (task) {
      case 'magnitude': {
        const v = difficulty === 'easy' && rng.bool(0.5) ? quadVec(rng) : randV(rng, R, 3);
        const n = norm2(v);
        const ans = (t: string) => m(`${NV(V)} = ${t}`);
        return {
          question: `Find ${m(NV(V))} for ${vecName(V, v)}.`,
          answer: ans(sqrtOf(n)),
          steps: [m(`${NV(V)} = \\sqrt{${v.map((x) => `${x < 0 ? `(${x})` : x}^{2}`).join(' + ')}} = \\sqrt{${n}}`), ans(sqrtOf(n))],
          wrongs: [ans(String(n)), ans(sqrtOf(Math.abs(v.reduce((s, x) => s + x, 0)) || 2)), ans(String(v.reduce((s, x) => s + Math.abs(x), 0)))],
          fallback: (k) => ans(sqrtOf(n + 2 * k)),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'unit': {
        const v = difficulty === 'medium' ? quadVec(rng) : randV(rng, 6, 3);
        const n = norm2(v);
        const ans = (t: string) => m(t);
        const answer = ans(unitTex(v));
        return {
          question: `Find the unit vector in the direction of ${vecName(V, v)}.`,
          answer,
          steps: [m(`${NV(V)} = ${sqrtOf(n)}`), m(`\\frac{${V}}{${NV(V)}} = ${unitTex(v)}`)],
          wrongs: [ans(vtex(v.map((x) => new Frac(x, n)))), ans(unitTex(v.map((x, i) => (i === 0 ? -x : x)))), ans(vtex(v.map((x) => exTex(exRad(new Frac(x, n + 1), n + 1)))))],
          fallback: (k) => ans(vtex(v.map((x) => exTex(exRad(new Frac(x, n + k + 1), n + k + 1))))),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'combo': {
        const u = randV(rng, R, 2);
        const v = randV(rng, R, 2);
        const a = difficulty === 'hard' && rng.bool(0.5) ? new Frac(1, rng.pick([2, 3])) : new Frac(rng.signedInt(1, 4, true));
        const b = new Frac(rng.signedInt(1, 4, true));
        const r = u.map((x, i) => a.mul(x).add(b.mul(v[i]!)));
        const expr = sum([
          { coef: a, sym: U },
          { coef: b, sym: V },
        ]);
        const ans = (w: Frac[]) => m(`${expr} = ${vtex(w)}`);
        return {
          question: `Find ${m(expr)} for ${vecName(U, u)} and ${vecName(V, v)}.`,
          answer: ans(r),
          steps: [m(`${expr} = ${vtex(u.map((x) => a.mul(x)))} + ${vtex(v.map((x) => b.mul(x)))}`), ans(r)],
          wrongs: [ans(u.map((x, i) => a.mul(x).sub(b.mul(v[i]!)))), ans(u.map((x, i) => b.mul(x).add(a.mul(v[i]!)))), ans(u.map((x, i) => a.mul(x).add(v[i]!)))],
          fallback: (k) => ans(r.map((x, i) => (i === 2 ? x.add(offset(k)) : x))),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'pq': {
        const p = randV(rng, R, 1);
        const q = attempt('pq', () => {
          const q = randV(rng, R, 1);
          return isZeroV(vsub(q, p)) ? null : q;
        });
        const d = vsub(q, p);
        const ans = (w: number[]) => m(`\\overrightarrow{PQ} = ${vtex(w)}`);
        return {
          question: `Find the component form of ${m('\\overrightarrow{PQ}')} for ${m(pt('P', p))} and ${m(pt('Q', q))}.`,
          answer: ans(d),
          steps: [m(`\\overrightarrow{PQ} = ${vtex(q.map((x, i) => `${x} - ${p[i]! < 0 ? `(${p[i]})` : p[i]}`))} = ${vtex(d)}`)],
          wrongs: [ans(vscale(d, -1)), ans(vadd(p, q)), ans([d[0]!, -d[1]!, d[2]!])],
          fallback: (k) => ans([d[0]! + offset(k), d[1]!, d[2]!]),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'distance':
      default: {
        const p = randV(rng, R, 1);
        const dv = difficulty === 'medium' && rng.bool(0.6) ? quadVec(rng) : randV(rng, 6, 2);
        const q = vadd(p, dv);
        const n = norm2(dv);
        const ans = (t: string) => m(`d = ${t}`);
        return {
          question: `Find the distance between ${m(pt('P', p))} and ${m(pt('Q', q))}.`,
          answer: ans(sqrtOf(n)),
          steps: [m(`d = \\sqrt{${dv.map((x) => `${x < 0 ? `(${x})` : x}^{2}`).join(' + ')}} = ${sqrtOf(n)}`)],
          wrongs: [ans(String(n)), ans(sqrtOf(norm2(vadd(p, q)) || 3)), ans(String(dv.reduce((s, x) => s + Math.abs(x), 0)))],
          fallback: (k) => ans(sqrtOf(n + k)),
          check: { kind: 'multivariable.vec', task },
        };
      }
    }
  },
});

// ---------------------------------------------------------------- dot and cross products

type DTask = 'dot' | 'angle' | 'classify' | 'cross' | 'parallelogram' | 'triangle' | 'triple';
const CLASSES = ['Orthogonal', 'Parallel', 'Neither', 'Both orthogonal and parallel'];

function gcdV(v: readonly number[]): number {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : Math.abs(a));
  return v.reduce((a, x) => g(a, x), 0) || 1;
}

function classifyPair(rng: Rng, kind: string, d: Difficulty): [V3, V3] {
  return attempt('classify', () => {
    const u = randV(rng, d === 'easy' ? 5 : 7, 2);
    let v: V3;
    if (kind === 'Parallel') {
      const prim = vscale(u, 1 / gcdV(u));
      v = vscale(prim, rng.pick([-3, -2, -1, 2, 3]));
    } else if (kind === 'Orthogonal') {
      const w = randV(rng, 4, 2);
      const c = cross(u, w);
      v = vscale(c, 1 / gcdV(c));
    } else v = randV(rng, 7, 2);
    if (isZeroV(v) || v.some((x) => Math.abs(x) > 15) || v.every((x, i) => x === u[i])) return null;
    const got = dot(u, v) === 0 ? 'Orthogonal' : isZeroV(cross(u, v)) ? 'Parallel' : 'Neither';
    return got === kind ? [u, v] : null;
  });
}

const prods = (u: readonly number[], v: readonly number[]) => u.map((x, i) => `(${x})(${v[i]})`).join(' + ');

export const dotCross = taskTopic<DTask>({
  id: 'mv.vectors.dot-cross',
  title: 'Dot and Cross Products',
  description: 'Dot products, angles, orthogonality, cross products, areas and the triple scalar product.',
  category: CAT,
  instruction: 'Answer each question. Round angles to the nearest tenth of a degree.',
  tasks: [
    { value: 'dot', label: 'Dot product' },
    { value: 'angle', label: 'Angle between vectors' },
    { value: 'classify', label: 'Orthogonal, parallel or neither' },
    { value: 'cross', label: 'Cross product' },
    { value: 'parallelogram', label: 'Area of a parallelogram' },
    { value: 'triangle', label: 'Area of a triangle' },
    { value: 'triple', label: 'Triple scalar product / volume' },
  ],
  mix: {
    easy: ['dot', 'classify', 'cross'],
    medium: ['angle', 'cross', 'parallelogram', 'classify', 'dot'],
    hard: ['angle', 'parallelogram', 'triangle', 'triple'],
  },
  build(task, { rng, difficulty }) {
    const R = difficulty === 'easy' ? 5 : 7;
    const given = (u: V3, v: V3) => `${vecName(U, u)} and ${vecName(V, v)}`;
    switch (task) {
      case 'dot': {
        const u = randV(rng, R, 2);
        const v = randV(rng, R, 2);
        const d = dot(u, v);
        const ans = (x: number) => m(`${U} \\cdot ${V} = ${x}`);
        return {
          question: `Find ${m(`${U} \\cdot ${V}`)} for ${given(u, v)}.`,
          answer: ans(d),
          steps: [m(`${U} \\cdot ${V} = ${prods(u, v)} = ${d}`)],
          wrongs: [ans(-d), ans(u[0]! * v[1]! + u[1]! * v[2]! + u[2]! * v[0]!), ans(u.reduce((s, x, i) => s + x + v[i]!, 0))],
          fallback: (k) => ans(d + offset(k)),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'angle': {
        const [u, v] = attempt('angle', () => {
          const u = randV(rng, R, 2);
          const v = randV(rng, R, 2);
          return isZeroV(cross(u, v)) ? null : [u, v];
        });
        const d = dot(u, v);
        const th = (Math.acos(d / Math.sqrt(norm2(u) * norm2(v))) * 180) / Math.PI;
        const ans = (t: number) => m(`\\theta ${d === 0 && t === 90 ? '=' : '\\approx'} ${decimal(t)}^\\circ`);
        return {
          question: `Find the angle between ${given(u, v)}.`,
          answer: ans(th),
          steps: [m(`\\cos\\theta = \\frac{${U} \\cdot ${V}}{${NV(U)}\\,${NV(V)}} = \\frac{${d}}{\\sqrt{${norm2(u)}}\\sqrt{${norm2(v)}}}`), ans(th)],
          wrongs: [ans(180 - th), ans(Math.abs(90 - th)), ans((Math.asin(Math.min(1, Math.abs(d) / Math.sqrt(norm2(u) * norm2(v)))) * 180) / Math.PI)],
          fallback: (k) => ans(th + 3.7 * offset(k)),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'classify': {
        const kind = rng.pick(['Orthogonal', 'Parallel', 'Neither']);
        const [u, v] = classifyPair(rng, kind, difficulty);
        const d = dot(u, v);
        return {
          question: `Determine whether ${given(u, v)} are orthogonal, parallel, or neither.`,
          answer: kind,
          steps: [m(`${U} \\cdot ${V} = ${prods(u, v)} = ${d}`), kind === 'Orthogonal' ? 'The dot product is zero, so the vectors are orthogonal.' : kind === 'Parallel' ? 'The vectors are scalar multiples of each other, so they are parallel.' : 'The dot product is not zero and the vectors are not scalar multiples.'],
          wrongs: CLASSES.filter((c) => c !== kind),
          fallback: () => null,
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'cross': {
        const u = randV(rng, R, 2);
        const v = attempt('cross', () => {
          const v = randV(rng, R, 2);
          return isZeroV(cross(u, v)) ? null : v;
        });
        const c = cross(u, v);
        const ans = (w: number[]) => m(`${U} \\times ${V} = ${vtex(w)}`);
        return {
          question: `Find ${m(`${U} \\times ${V}`)} for ${given(u, v)}.`,
          answer: ans(c),
          steps: [
            m(`${U} \\times ${V} = \\left\\langle (${u[1]})(${v[2]}) - (${u[2]})(${v[1]}),\\ (${u[2]})(${v[0]}) - (${u[0]})(${v[2]}),\\ (${u[0]})(${v[1]}) - (${u[1]})(${v[0]}) \\right\\rangle`),
            ans(c),
          ],
          wrongs: [ans(vscale(c, -1)), ans([c[0]!, -c[1]!, c[2]!]), ans(u.map((x, i) => x * v[i]!))],
          fallback: (k) => ans([c[0]!, c[1]!, c[2]! + offset(k)]),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'parallelogram':
      case 'triangle': {
        const tri = task === 'triangle';
        const [u, v] = attempt('area', () => {
          const u = randV(rng, 5, 2);
          const v = randV(rng, 5, 2);
          return isZeroV(cross(u, v)) ? null : [u, v];
        });
        const n = norm2(cross(u, v));
        const val = exRad(tri ? new Frac(1, 2) : 1, n);
        const ans = (t: string) => m(`A = ${t}`);
        let question: string;
        let steps: string[];
        if (tri) {
          const p = randV(rng, 5, 0);
          const q = vadd(p, u);
          const r = vadd(p, v);
          question = `Find the area of the triangle with vertices ${m(pt('P', p))}, ${m(pt('Q', q))}, and ${m(pt('R', r))}.`;
          steps = [m(`\\overrightarrow{PQ} = ${vtex(u)},\\ \\overrightarrow{PR} = ${vtex(v)}`), m(`\\overrightarrow{PQ} \\times \\overrightarrow{PR} = ${vtex(cross(u, v))}`), ans(`\\frac{1}{2}\\sqrt{${n}} = ${exTex(val)}`)];
        } else {
          question = `Find the area of the parallelogram with adjacent sides ${given(u, v)}.`;
          steps = [m(`${U} \\times ${V} = ${vtex(cross(u, v))}`), ans(`\\|${U} \\times ${V}\\| = ${exTex(val)}`)];
        }
        return {
          question,
          answer: ans(exTex(val)),
          steps,
          wrongs: [ans(exTex(exRad(tri ? 1 : new Frac(1, 2), n))), ans(String(Math.abs(dot(u, v)) || n)), ans(exTex(exRad(tri ? new Frac(1, 2) : 1, n + 6)))],
          fallback: (k) => ans(exTex(exRad(tri ? new Frac(1, 2) : 1, n + k))),
          check: { kind: 'multivariable.vec', task },
        };
      }
      case 'triple':
      default: {
        const [u, v, w] = attempt('triple', () => {
          const u = randV(rng, 4, 2);
          const v = randV(rng, 4, 2);
          const w = randV(rng, 4, 2);
          return dot(u, cross(v, w)) === 0 ? null : [u, v, w];
        });
        const t = dot(u, cross(v, w));
        const volume = rng.bool(0.5);
        const given3 = `${vecName(U, u)}, ${vecName(V, v)}, and ${vecName(W, w)}`;
        const ans = volume ? (x: number) => m(`V = ${Math.abs(x)}`) : (x: number) => m(`${U} \\cdot (${V} \\times ${W}) = ${x}`);
        return {
          question: volume ? `Find the volume of the parallelepiped determined by ${given3}.` : `Find the triple scalar product ${m(`${U} \\cdot (${V} \\times ${W})`)} for ${given3}.`,
          answer: ans(t),
          steps: [m(`${V} \\times ${W} = ${vtex(cross(v, w))}`), m(`${U} \\cdot (${V} \\times ${W}) = ${t}`), ...(volume ? [m(`V = |${t}| = ${Math.abs(t)}`)] : [])],
          wrongs: volume ? [ans(2 * Math.abs(t)), ans(Math.abs(dot(u, v)) + Math.abs(dot(v, w)) + 1), ans(Math.abs(t) + 6)] : [ans(-t), ans(dot(u, v) + dot(v, w) + dot(u, w)), ans(t + (t > 0 ? 6 : -6))],
          fallback: (k) => ans(t + (t > 0 ? 1 : -1) * k),
          check: { kind: 'multivariable.vec', task: volume ? 'volume' : 'triple' },
        };
      }
    }
  },
});

