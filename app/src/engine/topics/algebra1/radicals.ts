/** Simplifying radicals: square and cube roots, like radicals, products, rationalizing. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { rootTex, simplifyRoot } from '../../radical';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { ProblemContent } from '../../types';

const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

type Kind = 'simplify' | 'coef' | 'cube' | 'variables' | 'add' | 'multiply' | 'rationalize';

function radical(n: number, index = 2): string {
  return index === 2 ? `\\sqrt{${n}}` : `\\sqrt[${index}]{${n}}`;
}

/** n written as (perfect power) · (rest) for the worked step. */
function splitTex(n: number, index: number): string {
  const { out, inside } = simplifyRoot(n, index);
  return `${radical(out ** index, index).replace(/\{(\d+)\}$/, `{${out ** index} \\cdot ${inside}}`)}`;
}

function varPart(exps: Record<string, number>): string {
  return Object.keys(exps)
    .sort()
    .filter((v) => exps[v]! > 0)
    .map((v) => (exps[v] === 1 ? v : `${v}^{${exps[v]}}`))
    .join('');
}

export const simplifyingRadicals = defineTopic({
  id: 'alg1.radicals',
  subject: 'algebra1',
  category: 'Radical Expressions',
  title: 'Simplifying Radicals',
  description: 'Simplest radical form, like radicals, products and rationalizing denominators.',
  instruction: (o) => (o.variables ? 'Simplify. Assume all variables are positive.' : 'Simplify.'),
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Any' },
        { value: 'simplify', label: 'Simplify a single radical' },
        { value: 'operations', label: 'Add, multiply, rationalize' },
      ],
    },
    { type: 'boolean', id: 'variables', label: 'Include variables (hard)', default: false },
    { type: 'boolean', id: 'cube', label: 'Include cube roots (hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const type = strOpt(ctx, 'type');
    const single: Kind[] = difficulty === 'easy' ? ['simplify'] : difficulty === 'medium' ? ['simplify', 'coef'] : ['coef'];
    if (difficulty === 'hard' && boolOpt(ctx, 'cube')) single.push('cube');
    if (difficulty === 'hard' && boolOpt(ctx, 'variables')) single.push('variables', 'variables');
    const ops: Kind[] = difficulty === 'easy' ? ['multiply'] : difficulty === 'medium' ? ['add', 'multiply'] : ['add', 'multiply', 'rationalize'];
    const kinds = type === 'simplify' ? single : type === 'operations' ? ops : [...single, ...ops];
    const kind = rng.pick(kinds);
    const steps: string[] = [];
    let question: string;
    let answerTex: string;
    let wrongs: string[] = [];

    const pickRadicand = (r: Rng, maxOut: number) => {
      const out = r.int(2, maxOut);
      const inside = r.pick(SQUAREFREE);
      return { n: out * out * inside, out, inside };
    };

    switch (kind) {
      case 'simplify':
      case 'coef': {
        const { n, out, inside } = pickRadicand(rng, difficulty === 'easy' ? 6 : 8);
        const c = kind === 'coef' ? rng.int(2, 6) * (rng.bool(0.2) ? -1 : 1) : 1;
        question = `${c === 1 ? '' : c === -1 ? '-' : c}${radical(n)}`;
        answerTex = rootTex(c * out, inside);
        steps.push(m(`${c === 1 ? '' : c}\\sqrt{${out * out} \\cdot ${inside}} = ${c === 1 ? '' : `${c} \\cdot `}${out}\\sqrt{${inside}}`));
        if (c !== 1) steps.push(m(`= ${answerTex}`));
        wrongs = [rootTex(c * inside, out * out === n ? 1 : out), rootTex(c * out * out, inside), rootTex(c * (out + 1), inside)];
        break;
      }
      case 'cube': {
        const out = rng.int(2, 5);
        const inside = rng.pick([2, 3, 4, 5, 6, 7, 9, 10]);
        const n = out ** 3 * inside;
        question = radical(n, 3);
        answerTex = rootTex(out, inside, 3);
        steps.push(m(`${splitTex(n, 3)} = ${answerTex}`));
        wrongs = [rootTex(out, inside * out, 3), rootTex(out * out, inside, 3), rootTex(out + 1, inside, 3)];
        break;
      }
      case 'variables': {
        const { n, out, inside } = pickRadicand(rng, 6);
        const vars = rng.pick([['x'], ['x', 'y'], ['a', 'b'], ['m', 'n']]);
        const exps: Record<string, number> = {};
        for (const v of vars) exps[v] = rng.int(1, 9);
        const outside: Record<string, number> = {};
        const inner: Record<string, number> = {};
        for (const v of vars) {
          outside[v] = Math.floor(exps[v]! / 2);
          inner[v] = exps[v]! % 2;
        }
        question = `\\sqrt{${n}${varPart(exps)}}`;
        const outTex = `${out}${varPart(outside)}`;
        const inTex = `${inside}${varPart(inner)}`;
        answerTex = `${outTex}\\sqrt{${inTex}}`;
        steps.push(m(`\\sqrt{${out * out}${varPart(Object.fromEntries(vars.map((v) => [v, outside[v]! * 2])))}} \\cdot \\sqrt{${inTex}}`));
        steps.push(m(`= ${answerTex}`));
        const halved = Object.fromEntries(vars.map((v) => [v, Math.max(1, exps[v]! - 1)]));
        wrongs = [`${out}${varPart(halved)}\\sqrt{${inTex}}`, `${out * out}${varPart(outside)}\\sqrt{${inTex}}`, `${out}${varPart(outside)}\\sqrt{${inside}}`];
        break;
      }
      case 'add': {
        const inside = rng.pick(SQUAREFREE.slice(0, 6));
        const terms = attempt('radicals-add', () => {
          const count = difficulty === 'hard' ? 3 : 2;
          const ts = Array.from({ length: count }, (_, i) => ({
            c: rng.int(1, 6) * (i > 0 && rng.bool(0.4) ? -1 : 1),
            out: rng.int(1, 5),
          }));
          const total = ts.reduce((s, t) => s + t.c * t.out, 0);
          if (total === 0 || ts.every((t) => t.out === 1)) return null;
          return ts;
        });
        question = terms
          .map((t, i) => {
            const n = t.out * t.out * inside;
            const mag = `${Math.abs(t.c) === 1 ? '' : Math.abs(t.c)}${radical(n)}`;
            return i === 0 ? (t.c < 0 ? `-${mag}` : mag) : `${t.c < 0 ? '-' : '+'} ${mag}`;
          })
          .join(' ');
        const simplified = terms
          .map((t, i) => {
            const k = t.c * t.out;
            const mag = `${Math.abs(k) === 1 ? '' : Math.abs(k)}\\sqrt{${inside}}`;
            return i === 0 ? (k < 0 ? `-${mag}` : mag) : `${k < 0 ? '-' : '+'} ${mag}`;
          })
          .join(' ');
        const total = terms.reduce((s, t) => s + t.c * t.out, 0);
        answerTex = rootTex(total, inside);
        steps.push(m(`= ${simplified}`));
        steps.push(m(`= ${answerTex}`));
        const naive = terms.reduce((s, t) => s + t.c, 0);
        wrongs = [rootTex(naive === 0 ? total + 1 : naive, inside), rootTex(total, inside * terms.length), rootTex(-total, inside)];
        break;
      }
      case 'multiply': {
        const built = attempt('radicals-mul', () => {
          const a = rng.int(2, 15);
          const b = rng.int(2, 15);
          const { out, inside } = simplifyRoot(a * b);
          if (out === 1 || a === b) return null;
          const ca = difficulty === 'easy' ? 1 : rng.int(1, 4);
          const cb = difficulty === 'easy' ? 1 : rng.int(1, 4);
          return { a, b, ca, cb, out, inside };
        });
        const { a, b, ca, cb, out, inside } = built;
        const coef = (c: number) => (c === 1 ? '' : String(c));
        question = `${coef(ca)}${radical(a)} \\cdot ${coef(cb)}${radical(b)}`;
        answerTex = rootTex(ca * cb * out, inside);
        steps.push(m(`= ${coef(ca * cb)}\\sqrt{${a * b}}`));
        steps.push(m(`= ${answerTex}`));
        wrongs = [rootTex(ca * cb, a * b), rootTex(ca * cb * out * out, inside), rootTex(ca + cb, a * b)];
        if (inside === 1) wrongs[0] = rootTex(ca * cb * out + 1, 1);
        break;
      }
      case 'rationalize':
      default: {
        const built = attempt('radicals-rationalize', () => {
          const inside = rng.pick(SQUAREFREE.slice(0, 7));
          const out = rng.bool(0.5) ? 1 : rng.int(2, 3);
          const c = rng.int(1, 3);
          const k = rng.int(1, 12);
          // k / (c·√(out²·inside)) = k / (c·out·√inside) = k√inside / (c·out·inside)
          const value = new Frac(k, c * out * inside);
          if (value.n === 0) return null;
          return { inside, out, c, k, value };
        });
        const { inside, out, c, k, value } = built;
        const n = out * out * inside;
        const den = `${c === 1 ? '' : c}${radical(n)}`;
        question = `\\frac{${k}}{${den}}`;
        const numer = `${value.n === 1 ? '' : value.n}\\sqrt{${inside}}`;
        answerTex = value.d === 1 ? numer : `\\frac{${numer}}{${value.d}}`;
        if (out !== 1) steps.push(m(`= \\frac{${k}}{${c * out === 1 ? '' : c * out}\\sqrt{${inside}}}`));
        steps.push(m(`= \\frac{${k}}{${c * out === 1 ? '' : c * out}\\sqrt{${inside}}} \\cdot \\frac{\\sqrt{${inside}}}{\\sqrt{${inside}}} = \\frac{${k}\\sqrt{${inside}}}{${c * out * inside}}`));
        steps.push(m(`= ${answerTex}`));
        const wrongVal = new Frac(k, c * out);
        wrongs = [
          `\\frac{${wrongVal.n === 1 ? '' : wrongVal.n}\\sqrt{${inside}}}{${wrongVal.d}}`.replace(/\\frac\{(.*)\}\{1\}$/, '$1'),
          `\\frac{${k}\\sqrt{${inside}}}{${c * out}}`,
          `\\frac{${value.n === 1 ? '' : value.n}}{${value.d === 1 ? '' : value.d}\\sqrt{${inside}}}`,
        ];
        break;
      }
    }
    const answer = m(answerTex);
    const distractors = distinctDistractors(
      answer,
      wrongs.map((w) => m(w)),
      (k) => m(rootTex(k + 1, 2)),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars: ['x', 'y', 'a', 'b', 'm', 'n'], positive: true },
    };
  },
});
