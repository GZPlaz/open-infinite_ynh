/** Dot product, angle between vectors, orthogonal / parallel tests, projections. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m, num, paren, sum, term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Task = 'dot' | 'angle' | 'classify' | 'findK' | 'proj';
const TASKS: Record<Difficulty, Task[]> = {
  easy: ['dot', 'classify', 'dot'],
  medium: ['dot', 'angle', 'classify', 'findK'],
  hard: ['angle', 'classify', 'findK', 'proj'],
};

const vec = (v: ReadonlyArray<number | Frac | string>) => `\\left\\langle ${v.map((x) => (typeof x === 'string' ? x : num(x))).join(', ')} \\right\\rangle`;
const U = '\\mathbf{u}';
const V = '\\mathbf{v}';
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);
const isZero = (a: number[]) => a.every((x) => x === 0);
const cross0 = (a: number[], b: number[]) => (a.length === 2 ? a[0]! * b[1]! - a[1]! * b[0]! === 0 : [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!].every((x) => x === 0));

const CLASSES = ['Orthogonal', 'Parallel', 'Neither', 'Both parallel and orthogonal'];

function randVec(rng: Rng, dim: number, R: number): number[] {
  return attempt('vector', () => {
    const v = Array.from({ length: dim }, () => rng.int(-R, R));
    return v.filter((x) => x !== 0).length >= Math.min(2, dim) ? v : null;
  });
}

export const dotProduct = defineTopic({
  id: 'precalc.vectors.dot-product',
  subject: 'precalculus',
  category: 'Vectors',
  title: 'Dot Product and Angle Between Vectors',
  description: 'Dot products, angles between vectors, orthogonal and parallel tests, and vector projections.',
  instruction: 'Answer as indicated. Round angles to the nearest tenth of a degree.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'dot', label: 'Dot product' },
        { value: 'angle', label: 'Angle between vectors' },
        { value: 'classify', label: 'Orthogonal, parallel or neither' },
        { value: 'findK', label: 'Value making vectors orthogonal' },
        { value: 'proj', label: 'Vector projection' },
      ],
    },
    { type: 'boolean', id: 'threeD', label: 'Include 3-D vectors', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task: Task = tOpt === 'any' ? rng.pick(TASKS[difficulty]) : (tOpt as Task);
    const dim = ctx.options.threeD === true && difficulty === 'hard' && task !== 'proj' && task !== 'findK' && rng.bool(0.5) ? 3 : 2;
    const R = difficulty === 'easy' ? 6 : 9;
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];
    let fallback: (k: number) => string;
    const given = (u: number[], v: number[]) => `${m(`${U} = ${vec(u)}`)}, ${m(`${V} = ${vec(v)}`)}`;
    const products = (u: number[], v: number[]) => u.map((x, i) => `${paren(x)}${paren(v[i]!)}`).join(' + ');

    switch (task) {
      case 'dot': {
        const u = randVec(rng, dim, R);
        const v = randVec(rng, dim, R);
        const d = dot(u, v);
        question = `Find ${m(`${U} \\cdot ${V}`)} for ${given(u, v)}.`;
        steps.push(m(`${U} \\cdot ${V} = ${products(u, v)} = ${d}`));
        const ans = (x: number) => m(`${U} \\cdot ${V} = ${x}`);
        answer = ans(d);
        const swapped = dim === 2 ? u[0]! * v[1]! + u[1]! * v[0]! : u[0]! * v[1]! + u[1]! * v[2]! + u[2]! * v[0]!;
        wrongs = [ans(swapped), ans(-d), ans(u.reduce((s, x, i) => s + x + v[i]!, 0))];
        fallback = (k) => ans(d + offset(k));
        break;
      }
      case 'angle': {
        const { u, v } = attempt('angle', () => {
          const u = randVec(rng, dim, R);
          const v = randVec(rng, dim, R);
          return cross0(u, v) ? null : { u, v };
        });
        const d = dot(u, v);
        const nu = dot(u, u);
        const nv = dot(v, v);
        const theta = (Math.acos(d / Math.sqrt(nu * nv)) * 180) / Math.PI;
        const exact = d === 0;
        const ans = (t: number, eq = false) => m(`\\theta ${eq ? '=' : '\\approx'} ${decimal(t)}^\\circ`);
        question = `Find the angle between ${given(u, v)}.`;
        steps.push(m(`\\cos\\theta = \\frac{${U} \\cdot ${V}}{\\|${U}\\|\\,\\|${V}\\|} = \\frac{${d}}{\\sqrt{${nu}}\\sqrt{${nv}}}`));
        answer = ans(theta, exact);
        steps.push(answer);
        wrongs = [ans(180 - theta), ans(Math.abs(90 - theta)), ans((Math.acos(Math.max(-1, Math.min(1, d / (nu + nv)))) * 180) / Math.PI)];
        fallback = (k) => ans(theta + offset(k) * 4.3);
        break;
      }
      case 'classify': {
        const kind = rng.pick(['Orthogonal', 'Parallel', 'Neither']);
        const { u, v } = attempt('classify', () => {
          const u = randVec(rng, dim, difficulty === 'easy' ? 5 : 7);
          let v: number[];
          if (kind === 'Parallel') {
            const g = u.reduce((a, x) => gcd2(a, x), 0);
            const prim = u.map((x) => x / g);
            const k = rng.pick([-3, -2, -1, 2, 3]);
            v = prim.map((x) => x * k);
            if (v.every((x, i) => x === u[i])) return null;
          } else if (kind === 'Orthogonal') {
            if (dim === 2) v = [-u[1]!, u[0]!].map((x) => x * rng.pick([1, -1, 2, -2]));
            else {
              const w = randVec(rng, 3, 4);
              v = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
              const g = v.reduce((a, x) => gcd2(a, x), 0) || 1;
              v = v.map((x) => x / g);
            }
          } else v = randVec(rng, dim, R);
          if (isZero(v) || v.some((x) => Math.abs(x) > 15)) return null;
          const dz = dot(u, v) === 0;
          const pz = cross0(u, v);
          const got = dz ? 'Orthogonal' : pz ? 'Parallel' : 'Neither';
          return got === kind ? { u, v } : null;
        });
        question = `Determine whether ${given(u, v)} are orthogonal, parallel, or neither.`;
        const d = dot(u, v);
        steps.push(m(`${U} \\cdot ${V} = ${products(u, v)} = ${d}`));
        if (kind === 'Orthogonal') steps.push('The dot product is zero, so the vectors are orthogonal.');
        else if (kind === 'Parallel') steps.push(`The dot product is not zero, but ${m(`${V} = ${term(new Frac(v.find((x) => x !== 0)!, u[v.findIndex((x) => x !== 0)]!), U)}`)}, so the vectors are parallel.`);
        else steps.push('The dot product is not zero and the vectors are not scalar multiples, so neither.');
        answer = kind;
        wrongs = CLASSES.filter((c) => c !== kind);
        fallback = () => 'Neither';
        break;
      }
      case 'findK': {
        const { u, v, pos } = attempt('findK', () => {
          const u = randVec(rng, 2, R);
          const pos = rng.int(0, 1);
          const c = rng.signedInt(1, R, true);
          if (u[pos] === 0) return null;
          const v = pos === 0 ? [0, c] : [c, 0];
          return { u, v, pos };
        });
        // u·v = u[pos]·k + u[1−pos]·c = 0
        const c = v[1 - pos]!;
        const k = new Frac(-u[1 - pos]! * c, u[pos]!);
        const shown = pos === 0 ? vec(['k', c]) : vec([c, 'k']);
        question = `Find ${m('k')} so that ${m(`${U} = ${vec(u)}`)} and ${m(`${V} = ${shown}`)} are orthogonal.`;
        steps.push(m(`${U} \\cdot ${V} = ${sum([{ coef: u[pos]!, sym: 'k' }, { coef: u[1 - pos]! * c }])} = 0`));
        const ans = (x: Frac) => m(`k = ${num(x)}`);
        answer = ans(k);
        steps.push(answer);
        wrongs = [ans(k.neg()), u[1 - pos]! !== 0 ? ans(new Frac(u[pos]! * c, u[1 - pos]!).neg()) : ans(k.add(1)), ans(new Frac(-u[1 - pos]!, u[pos]!))];
        fallback = (j) => ans(k.add(offset(j)));
        break;
      }
      case 'proj':
      default: {
        const { u, v } = attempt('proj', () => {
          const u = randVec(rng, 2, 8);
          const v = randVec(rng, 2, 6);
          return dot(u, v) === 0 || cross0(u, v) ? null : { u, v };
        });
        const d = dot(u, v);
        const nv = dot(v, v);
        const s = new Frac(d, nv);
        const res = v.map((x) => s.mul(x));
        question = `Find ${m(`\\operatorname{proj}_{${V}}${U}`)} for ${given(u, v)}.`;
        steps.push(m(`\\operatorname{proj}_{${V}}${U} = \\frac{${U} \\cdot ${V}}{\\|${V}\\|^{2}}${V} = \\frac{${d}}{${nv}}${vec(v)}`));
        const ans = (w: Frac[]) => m(`\\operatorname{proj}_{${V}}${U} = ${vec(w)}`);
        answer = ans(res);
        steps.push(answer);
        const nu = dot(u, u);
        wrongs = [ans(u.map((x) => new Frac(d, nu).mul(x))), ans(v.map((x) => new Frac(d).mul(x))), ans(res.map((x) => x.neg()))];
        fallback = (j) => ans([res[0]!.add(offset(j)), res[1]!]);
        break;
      }
    }
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, fallback),
      check: { kind: 'precalculus.vectors', task },
    };
  },
});

function gcd2(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}
