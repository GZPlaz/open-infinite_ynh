/** Vectors in the plane: component form, magnitude, combinations, dot product, angles, unit vectors. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../generator';
import { isPerfectSquare, simplifySqrt, sqrtTex } from '../../radical';
import { decimal, m, num, paren, parenNeg, tuple } from '../../tex';
import type { ProblemContent } from '../../types';
import { triples } from '../geometry/common';

type Task = 'component' | 'magnitude' | 'combination' | 'dot' | 'angle' | 'unit';
type V = [number, number];

const vec = (v: readonly (number | Frac | string)[]) =>
  `\\left\\langle ${v.map((x) => (typeof x === 'string' ? x : num(x))).join(', ')} \\right\\rangle`;
const bold = (n: string) => `\\mathbf{${n}}`;

/** k/√n rationalised: `\frac{3\sqrt{13}}{13}`. */
function overRoot(k: number, n: number): string {
  const { out, inside } = simplifySqrt(n);
  // k / (out·√inside) = k√inside / (out·inside)
  const f = new Frac(k, out * inside);
  if (inside === 1) return num(new Frac(k, out));
  const top = `${Math.abs(f.n) === 1 ? '' : Math.abs(f.n)}\\sqrt{${inside}}`;
  const body = f.d === 1 ? top : `\\frac{${top}}{${f.d}}`;
  return f.n < 0 ? `-${body}` : body;
}

export const vectors = defineTopic({
  id: 'precalc.vectors',
  subject: 'precalculus',
  title: 'Vectors',
  description: 'Component form, magnitude, linear combinations, dot products, angles and unit vectors.',
  instruction: (o) => (o.answerForm === 'exact' ? 'Answer as indicated. Leave radicals in simplest form.' : 'Answer as indicated. Round to the nearest tenth.'),
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
        { value: 'component', label: 'Component form' },
        { value: 'magnitude', label: 'Magnitude' },
        { value: 'combination', label: 'Linear combinations' },
        { value: 'dot', label: 'Dot product' },
        { value: 'angle', label: 'Angle between vectors' },
        { value: 'unit', label: 'Unit vectors' },
      ],
    },
    opt.rounding('exact'),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const form = strOpt(ctx, 'answerForm');
    const task: Task =
      tOpt !== 'any'
        ? (tOpt as Task)
        : rng.pick<Task>(difficulty === 'easy' ? ['component', 'magnitude', 'combination'] : difficulty === 'medium' ? ['combination', 'dot', 'magnitude'] : ['angle', 'unit', 'dot']);
    const R = difficulty === 'easy' ? 6 : 9;
    const rv = (): V => [rng.signedInt(1, R, true), rng.signedInt(0, R, true)];
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];
    let fallback: (k: number) => string;
    let check: Record<string, unknown>;

    switch (task) {
      case 'component': {
        const P: V = [rng.int(-9, 9), rng.int(-9, 9)];
        const Q: V = attempt('vec-q', () => {
          const q: V = [rng.int(-9, 9), rng.int(-9, 9)];
          return q[0] === P[0] && q[1] === P[1] ? null : q;
        });
        const c: V = [Q[0] - P[0], Q[1] - P[1]];
        question = `Find the component form of the vector from $P${tuple(P)}$ to $Q${tuple(Q)}$.`;
        steps.push(m(`${vec([`${Q[0]} - ${parenNeg(P[0])}`, `${Q[1]} - ${parenNeg(P[1])}`])}`));
        answer = m(vec(c));
        wrongs = [m(vec([-c[0], -c[1]])), m(vec([P[0] + Q[0], P[1] + Q[1]])), m(vec([c[1], c[0]]))];
        fallback = (k) => m(vec([c[0] + offset(k), c[1]]));
        check = { kind: 'vector', task, P, Q };
        break;
      }
      case 'magnitude': {
        const v: V = attempt('vec-mag', () => {
          if (difficulty === 'easy') {
            const [a, b] = rng.pick(triples(30));
            return [a * rng.sign(), b * rng.sign()] as V;
          }
          const w = rv();
          return w[1] === 0 || isPerfectSquare(w[0] ** 2 + w[1] ** 2) ? null : w;
        });
        const n2 = v[0] ** 2 + v[1] ** 2;
        const exact = isPerfectSquare(n2) || form === 'exact';
        const show = (sq: number) => (isPerfectSquare(sq) || form === 'exact' ? `= ${sqrtTex(sq)}` : `\\approx ${decimal(Math.sqrt(sq))}`);
        question = `Find the magnitude of $${bold('v')} = ${vec(v)}$.`;
        steps.push(m(`\\|${bold('v')}\\| = \\sqrt{${paren(v[0])}^{2} + ${paren(v[1])}^{2}} = \\sqrt{${n2}}${exact ? '' : ` \\approx ${decimal(Math.sqrt(n2))}`}`));
        answer = m(`\\|${bold('v')}\\| ${show(n2)}`);
        const s1 = (Math.abs(v[0]) + Math.abs(v[1])) ** 2;
        const s2 = Math.abs(v[0] ** 2 - v[1] ** 2) || 2;
        wrongs = [m(`\\|${bold('v')}\\| ${show(s1)}`), m(`\\|${bold('v')}\\| ${show(s2)}`), m(`\\|${bold('v')}\\| ${show(n2 * 4)}`)];
        fallback = (k) => m(`\\|${bold('v')}\\| ${show(n2 + k)}`);
        check = { kind: 'vector', task, v };
        break;
      }
      case 'combination': {
        const u = rv();
        const w = rv();
        const a = difficulty === 'easy' ? 1 : rng.signedInt(1, 4, true);
        const b = difficulty === 'easy' ? rng.pick([1, -1]) : rng.signedInt(1, 4, true);
        const res: V = [a * u[0] + b * w[0], a * u[1] + b * w[1]];
        const combo = `${a === 1 ? '' : a === -1 ? '-' : a}${bold('u')} ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}${bold('v')}`;
        question = `$${bold('u')} = ${vec(u)},\\ ${bold('v')} = ${vec(w)}$. Find $${combo}$.`;
        steps.push(m(`${vec([a * u[0], a * u[1]])} + ${vec([b * w[0], b * w[1]])}`));
        answer = m(vec(res));
        wrongs = [m(vec([a * u[0] - b * w[0], a * u[1] - b * w[1]])), m(vec([u[0] + w[0], u[1] + w[1]])), m(vec([a * u[0] + b * w[1], a * u[1] + b * w[0]]))];
        fallback = (k) => m(vec([res[0], res[1] + offset(k)]));
        check = { kind: 'vector', task, u, v: w, a, b };
        break;
      }
      case 'dot': {
        const u = rv();
        const w = rv();
        const d = u[0] * w[0] + u[1] * w[1];
        question = `$${bold('u')} = ${vec(u)},\\ ${bold('v')} = ${vec(w)}$. Find $${bold('u')} \\cdot ${bold('v')}$.`;
        steps.push(m(`${paren(u[0])}${paren(w[0])} + ${paren(u[1])}${paren(w[1])} = ${d}`));
        answer = m(`${bold('u')} \\cdot ${bold('v')} = ${d}`);
        wrongs = [u[0] * w[1] + u[1] * w[0], u[0] * w[0] - u[1] * w[1], -d].map((x) => m(`${bold('u')} \\cdot ${bold('v')} = ${x}`));
        fallback = (k) => m(`${bold('u')} \\cdot ${bold('v')} = ${d + offset(k)}`);
        check = { kind: 'vector', task, u, v: w };
        break;
      }
      case 'angle': {
        const { u, w } = attempt('vec-angle', () => {
          const u = rv();
          const w = rv();
          const cross = u[0] * w[1] - u[1] * w[0];
          return cross === 0 ? null : { u, w };
        });
        const d = u[0] * w[0] + u[1] * w[1];
        const nu = u[0] ** 2 + u[1] ** 2;
        const nw = w[0] ** 2 + w[1] ** 2;
        const theta = (Math.acos(d / Math.sqrt(nu * nw)) * 180) / Math.PI;
        question = `Find the angle between $${bold('u')} = ${vec(u)}$ and $${bold('v')} = ${vec(w)}$.`;
        steps.push(m(`\\cos\\theta = \\frac{${bold('u')} \\cdot ${bold('v')}}{\\|${bold('u')}\\|\\,\\|${bold('v')}\\|} = \\frac{${d}}{\\sqrt{${nu}}\\sqrt{${nw}}}`));
        steps.push(m(`\\theta \\approx ${decimal(theta)}^\\circ`));
        answer = m(`\\theta \\approx ${decimal(theta)}^\\circ`);
        wrongs = [180 - theta, 90 - theta > 0 ? 90 - theta : theta + 90, (Math.acos(Math.max(-1, Math.min(1, d / (nu + nw)))) * 180) / Math.PI].map((x) => m(`\\theta \\approx ${decimal(x)}^\\circ`));
        fallback = (k) => m(`\\theta \\approx ${decimal(theta + offset(k) * 3.1)}^\\circ`);
        check = { kind: 'vector', task, u, v: w };
        break;
      }
      case 'unit':
      default: {
        const v: V = attempt('vec-unit', () => {
          if (rng.bool(0.5)) {
            const [a, b] = rng.pick(triples(26));
            return [a * rng.sign(), b * rng.sign()] as V;
          }
          const w = rv();
          return w[1] === 0 ? null : w;
        });
        const n2 = v[0] ** 2 + v[1] ** 2;
        question = `Find the unit vector in the direction of $${bold('v')} = ${vec(v)}$.`;
        steps.push(m(`\\|${bold('v')}\\| = ${sqrtTex(n2)}`));
        const ans = vec([overRoot(v[0], n2), overRoot(v[1], n2)]);
        steps.push(m(`\\frac{${bold('v')}}{\\|${bold('v')}\\|} = ${ans}`));
        answer = m(ans);
        wrongs = [m(vec([overRoot(v[1], n2), overRoot(v[0], n2)])), m(vec([overRoot(-v[0], n2), overRoot(-v[1], n2)])), m(vec([new Frac(v[0], n2), new Frac(v[1], n2)]))];
        fallback = (k) => m(vec([overRoot(v[0] + k, n2), overRoot(v[1], n2)]));
        check = { kind: 'vector', task, v };
        break;
      }
    }
    return { question, answer, steps, distractors: distinctDistractors(answer, wrongs, fallback), check };
  },
});
