/** Properties of exponents: simplify, answers with positive exponents only. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { ProblemContent } from '../../types';

/** coef · Π var^exp */
interface Mono {
  coef: Frac;
  exps: Record<string, number>;
}

const mono = (coef: number | Frac, exps: Record<string, number>): Mono => ({ coef: Frac.of(coef), exps });

function mulM(a: Mono, b: Mono): Mono {
  const exps = { ...a.exps };
  for (const [v, e] of Object.entries(b.exps)) exps[v] = (exps[v] ?? 0) + e;
  return { coef: a.coef.mul(b.coef), exps };
}

function divM(a: Mono, b: Mono): Mono {
  return mulM(a, { coef: b.coef.inv(), exps: Object.fromEntries(Object.entries(b.exps).map(([v, e]) => [v, -e])) });
}

function powM(a: Mono, k: number): Mono {
  return { coef: a.coef.pow(k), exps: Object.fromEntries(Object.entries(a.exps).map(([v, e]) => [v, e * k])) };
}

function varsTex(exps: Record<string, number>, sign: 1 | -1 | 0): string {
  return Object.keys(exps)
    .sort()
    .filter((v) => sign === 0 || Math.sign(exps[v]!) === sign)
    .map((v) => {
      const e = sign === -1 ? -exps[v]! : exps[v]!;
      return e === 1 ? v : `${v}^{${e}}`;
    })
    .join('');
}

/** As written in a problem: any exponents (negative or zero) may appear. */
function rawTex(a: Mono): string {
  const vars = varsTex(a.exps, 0);
  const c = a.coef;
  if (!c.isInt()) {
    // only used for quotient coefficients; keep as a fraction in front
    return `${c.toTex()}${vars}`;
  }
  if (!vars) return String(c.n);
  if (c.n === 1) return vars;
  if (c.n === -1) return `-${vars}`;
  return `${c.n}${vars}`;
}

/** Simplified with positive exponents only: `-\frac{3x^{2}}{2y^{4}}`. */
function simplifiedTex(a: Mono): string {
  const clean: Record<string, number> = {};
  for (const [v, e] of Object.entries(a.exps)) if (e !== 0) clean[v] = e;
  const top = varsTex(clean, 1);
  const bottom = varsTex(clean, -1);
  const n = Math.abs(a.coef.n);
  const d = a.coef.d;
  const sign = a.coef.sign < 0 ? '-' : '';
  const numer = top ? (n === 1 ? top : `${n}${top}`) : String(n);
  const denom = bottom ? (d === 1 ? bottom : `${d}${bottom}`) : d === 1 ? '' : String(d);
  return denom ? `${sign}\\frac{${numer}}{${denom}}` : `${sign}${numer}`;
}

function hasNegative(a: Mono): boolean {
  return Object.values(a.exps).some((e) => e < 0) || !a.coef.isInt();
}

type Shape = 'product' | 'quotient' | 'power' | 'power-product' | 'power-quotient' | 'quotient-power';

export const exponentProperties = defineTopic({
  id: 'alg1.exponents',
  subject: 'algebra1',
  category: 'Exponents',
  title: 'Properties of Exponents',
  description: 'Product, quotient and power rules; zero and negative exponents.',
  instruction: 'Simplify. Your answer should contain only positive exponents.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    { type: 'boolean', id: 'negExp', label: 'Negative exponents in problems', default: true },
    { type: 'boolean', id: 'twoVars', label: 'Two variables', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negExp = boolOpt(ctx, 'negExp') && difficulty !== 'easy';
    const vars = boolOpt(ctx, 'twoVars') && difficulty !== 'easy' ? rng.pick([['x', 'y'], ['a', 'b'], ['m', 'n'], ['u', 'v']]) : [rng.pick(['x', 'a', 'n', 'k', 'p', 'v'])];
    const shapes: Shape[] =
      difficulty === 'easy'
        ? ['product', 'quotient', 'power']
        : difficulty === 'medium'
          ? ['product', 'quotient', 'power', 'power-product']
          : ['power-product', 'power-quotient', 'quotient-power'];

    const randMono = (r: Rng, coefMax: number): Mono => {
      const exps: Record<string, number> = {};
      for (const v of vars) {
        const e = negExp && r.bool(0.35) ? -r.int(1, 4) : r.int(difficulty === 'hard' && r.bool(0.1) ? 0 : 1, difficulty === 'easy' ? 6 : 5);
        exps[v] = e;
      }
      return mono(r.signedInt(1, coefMax, difficulty !== 'easy'), exps);
    };

    const built = attempt('exponents', () => {
      const shape = rng.pick(shapes);
      const k = rng.int(2, difficulty === 'hard' ? 3 : 4) * (negExp && difficulty === 'hard' && rng.bool(0.2) ? -1 : 1);
      const a = randMono(rng, shape.startsWith('power') || shape === 'quotient-power' ? 3 : 6);
      const b = randMono(rng, 6);
      let question: string;
      let expanded: string | null = null;
      let result: Mono;
      let naive: Mono | null = null;
      const paren = (x: Mono) => `\\left(${rawTex(x)}\\right)`;
      // a right-hand factor with a negative coefficient needs brackets: 2x · (-3x)
      const factor = (x: Mono) => (x.coef.sign < 0 ? paren(x) : rawTex(x));
      switch (shape) {
        case 'product':
          question = `${rawTex(a)} \\cdot ${factor(b)}`;
          result = mulM(a, b);
          naive = { coef: a.coef.mul(b.coef), exps: Object.fromEntries(vars.map((v) => [v, a.exps[v]! * b.exps[v]!])) };
          break;
        case 'quotient':
          if (!a.coef.div(b.coef).isInt() && rng.bool(0.6)) return null;
          question = `\\frac{${rawTex(a)}}{${rawTex(b)}}`;
          result = divM(a, b);
          naive = { coef: result.coef, exps: Object.fromEntries(vars.map((v) => [v, a.exps[v]! + b.exps[v]!])) };
          break;
        case 'power':
          question = `${paren(a)}^{${k}}`;
          result = powM(a, k);
          naive = { coef: a.coef.mul(k), exps: result.exps };
          break;
        case 'power-product':
          question = `${paren(a)}^{${k}} \\cdot ${factor(b)}`;
          expanded = `${rawTex(powM(a, k))} \\cdot ${factor(b)}`;
          result = mulM(powM(a, k), b);
          naive = mulM({ coef: a.coef, exps: powM(a, k).exps }, b);
          break;
        case 'power-quotient':
          question = `\\frac{${paren(a)}^{${k}}}{${rawTex(b)}}`;
          expanded = `\\frac{${rawTex(powM(a, k))}}{${rawTex(b)}}`;
          result = divM(powM(a, k), b);
          naive = divM({ coef: a.coef, exps: powM(a, k).exps }, b);
          break;
        case 'quotient-power':
        default: {
          const kk = Math.abs(k) > 2 ? 2 : k;
          question = `\\left(\\frac{${rawTex(a)}}{${rawTex(b)}}\\right)^{${kk}}`;
          expanded = `\\frac{${rawTex(powM(a, kk))}}{${rawTex(powM(b, kk))}}`;
          result = powM(divM(a, b), kk);
          naive = divM(powM(a, kk), b);
          break;
        }
      }
      if (Math.abs(result.coef.n) > 2000 || result.coef.d > 2000) return null;
      if (Object.values(result.exps).some((e) => Math.abs(e) > 24)) return null;
      return { question, expanded, result, naive };
    });

    const { question, expanded, result, naive } = built;
    const steps: string[] = [];
    if (expanded) steps.push(m(`= ${expanded}`));
    if (hasNegative(result) || Object.values(result.exps).some((e) => e === 0)) steps.push(m(`= ${rawTex(result)}`));
    steps.push(m(`= ${simplifiedTex(result)}`));

    const answer = m(simplifiedTex(result));
    const flipped = (v: string): Mono => ({ coef: result.coef, exps: { ...result.exps, [v]: -(result.exps[v] ?? 0) } });
    const bumped = (v: string, d: number): Mono => ({ coef: result.coef, exps: { ...result.exps, [v]: (result.exps[v] ?? 0) + d } });
    const distractors = distinctDistractors(
      answer,
      [naive ? m(simplifiedTex(naive)) : null, m(simplifiedTex(flipped(vars[0]!))), m(simplifiedTex(bumped(vars[vars.length - 1]!, 1)))],
      (n) => m(simplifiedTex(bumped(vars[0]!, n % 2 ? n : -n))),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars, positive: true },
    };
  },
});
