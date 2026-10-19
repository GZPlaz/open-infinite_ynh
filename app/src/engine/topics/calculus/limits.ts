/** Evaluating limits: substitution, factoring, conjugates, limits at infinity. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, paren } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Kind = 'substitution' | 'factor' | 'conjugate' | 'infinity';

const lim = (a: string) => `\\lim_{x \\to ${a}}`;
const frac = (n: string, d: string) => `\\frac{${n}}{${d}}`;
/** x − r without and with brackets. */
const factor = (r: number) => (r === 0 ? 'x' : `x ${r > 0 ? '-' : '+'} ${Math.abs(r)}`);
const wrapped = (r: number) => (r === 0 ? 'x' : `(${factor(r)})`);
const product = (roots: number[]) =>
  roots
    .slice()
    .sort((p, q) => Number(q === 0) - Number(p === 0))
    .map(wrapped)
    .join('');

/** p(a) written out term by term: `2(-2)^{2} - 3(-2) + 1`. */
function substituted(p: Poly, a: number): string {
  let out = '';
  for (let i = p.degree; i >= 0; i--) {
    const c = p.coef(i);
    if (c.isZero()) continue;
    const body = i === 0 ? num(c.abs()) : `${c.abs().eq(1) ? '' : num(c.abs())}${paren(a)}${i > 1 ? `^{${i}}` : ''}`;
    out += out ? (c.sign < 0 ? ` - ${body}` : ` + ${body}`) : c.sign < 0 ? `-${body}` : body;
  }
  return out;
}

function randPoly(rng: Rng, deg: number, max: number): Poly {
  return attempt('limit-poly', () => {
    const p = new Poly([...Array.from({ length: deg }, () => rng.int(-max, max)), rng.signedInt(1, max, true)]);
    return p.degree === deg ? p : null;
  });
}

const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['substitution', 'substitution', 'factor'],
  medium: ['factor', 'factor', 'infinity', 'substitution'],
  hard: ['conjugate', 'infinity', 'factor'],
};

export const limits = defineTopic({
  id: 'calc.limits',
  subject: 'calculus',
  category: 'Limits and Continuity',
  title: 'Evaluating Limits',
  description: 'Direct substitution, factoring and cancelling, conjugates, limits at infinity.',
  instruction: 'Evaluate each limit.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Technique',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'substitution', label: 'Direct substitution' },
        { value: 'factor', label: 'Factor and cancel' },
        { value: 'conjugate', label: 'Conjugates' },
        { value: 'infinity', label: 'Limits at infinity' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'type');
    const kind: Kind = tOpt === 'any' ? rng.pick(KINDS[difficulty]) : (tOpt as Kind);
    const steps: string[] = [];
    let question: string;
    let value: Frac | 'inf' | '-inf';
    let wrong: Array<Frac | 'inf' | '-inf'>;
    let point: number | 'inf';

    switch (kind) {
      case 'substitution': {
        const a = rng.int(-5, 5);
        point = a;
        if (rng.bool(0.5) || difficulty === 'easy') {
          const p = randPoly(rng, rng.int(2, 3), 6);
          question = `${lim(String(a))} (${p.toTex()})`;
          value = p.eval(a);
          steps.push(m(`= ${substituted(p, a)} = ${num(value)}`));
          wrong = [p.eval(-a), p.eval(a).add(1), p.coef(0)];
        } else {
          const { p, q } = attempt('limit-sub', () => {
            const p = randPoly(rng, rng.int(1, 2), 6);
            const q = randPoly(rng, 1, 6);
            return q.eval(a).isZero() ? null : { p, q };
          });
          question = `${lim(String(a))} ${frac(p.toTex(), q.toTex())}`;
          value = p.eval(a).div(q.eval(a));
          steps.push(m(`= ${frac(num(p.eval(a)), num(q.eval(a)))}${value.d !== q.eval(a).value ? ` = ${num(value)}` : ''}`));
          wrong = [p.eval(-a).div(q.eval(-a).isZero() ? 1 : q.eval(-a)), p.eval(a), value.neg()];
        }
        break;
      }
      case 'factor': {
        const built = attempt('limit-factor', () => {
          const a = rng.signedInt(1, 6, true);
          const b = rng.int(-7, 7);
          const linearDen = difficulty === 'easy' || rng.bool(0.4);
          const c = linearDen ? null : rng.int(-7, 7);
          if (b === a || c === a || (c !== null && c === b)) return null;
          const k = difficulty === 'hard' ? rng.signedInt(1, 3, true) : 1;
          return { a, b, c, k };
        });
        const { a, b, c, k } = built;
        point = a;
        const num_ = Poly.fromRoots([a, b]).scale(k);
        const den = c === null ? Poly.fromRoots([a]) : Poly.fromRoots([a, c]);
        question = `${lim(String(a))} ${frac(num_.toTex(), den.toTex())}`;
        const kTex = k === 1 ? '' : k === -1 ? '-' : String(k);
        const factoredNum = `${kTex}${product([a, b])}`;
        const factoredDen = c === null ? factor(a) : product([a, c]);
        steps.push(m(`= ${lim(String(a))} ${frac(factoredNum, factoredDen)}`));
        const reducedNum = k === 1 ? factor(b) : `${kTex}${wrapped(b)}`;
        const reduced = c === null ? (k === 1 ? `(${factor(b)})` : reducedNum) : frac(reducedNum, factor(c));
        value = c === null ? new Frac(k * (a - b)) : new Frac(k * (a - b), a - c);
        steps.push(m(`= ${lim(String(a))} ${reduced} = ${num(value)}`));
        wrong = [c === null ? new Frac(k * (a + b)) : new Frac(k * (a + b), a + c === 0 ? 1 : a + c), value.neg(), new Frac(0)];
        break;
      }
      case 'conjugate': {
        const kk = rng.int(1, 5);
        const a = rng.int(-3, 6);
        const c = kk * kk - a;
        point = a;
        const inside = Poly.of(c, 1).toTex();
        question = `${lim(String(a))} ${frac(`\\sqrt{${inside}} - ${kk}`, Poly.of(-a, 1).toTex())}`;
        steps.push(m(`= ${lim(String(a))} ${frac(`(${inside}) - ${kk * kk}`, `(${Poly.of(-a, 1).toTex()})(\\sqrt{${inside}} + ${kk})`)}`));
        steps.push(m(`= ${lim(String(a))} ${frac('1', `\\sqrt{${inside}} + ${kk}`)} = ${frac('1', String(2 * kk))}`));
        value = new Frac(1, 2 * kk);
        wrong = [new Frac(1, kk), new Frac(0), new Frac(2 * kk)];
        break;
      }
      case 'infinity':
      default: {
        point = 'inf';
        const dn = rng.int(1, 3);
        const rel = rng.pick(['equal', 'lower', 'higher', 'equal']);
        const dd = rel === 'equal' ? dn : rel === 'lower' ? dn + rng.int(1, 2) : Math.max(1, dn - 1);
        const p = randPoly(rng, rel === 'higher' ? dd + 1 : dn, 9);
        const q = randPoly(rng, dd, 9);
        question = `${lim('\\infty')} ${frac(p.toTex(), q.toTex())}`;
        if (p.degree === q.degree) {
          value = p.lead().div(q.lead());
          steps.push(`Degrees are equal; divide the leading coefficients: $${frac(num(p.lead()), num(q.lead()))}${value.d !== q.lead().value ? ` = ${num(value)}` : ''}$`);
          wrong = [new Frac(0), p.coef(0).isZero() || q.coef(0).isZero() ? value.inv() : p.coef(0).div(q.coef(0)), value.neg()];
        } else if (p.degree < q.degree) {
          value = Frac.ZERO;
          steps.push('The denominator has the higher degree, so the fraction approaches $0$.');
          wrong = [p.lead().div(q.lead()), 'inf', Frac.ONE];
        } else {
          value = p.lead().div(q.lead()).sign > 0 ? 'inf' : '-inf';
          steps.push(`The numerator has the higher degree; the sign of $${frac(num(p.lead()), num(q.lead()))}$ gives $${value === 'inf' ? '\\infty' : '-\\infty'}$.`);
          wrong = [value === 'inf' ? '-inf' : 'inf', p.lead().div(q.lead()), Frac.ZERO];
        }
        break;
      }
    }
    const show = (v: Frac | 'inf' | '-inf') => m(v === 'inf' ? '\\infty' : v === '-inf' ? '-\\infty' : num(v));
    const answer = show(value);
    const base = value;
    return {
      question: m(`\\displaystyle ${question}`),
      answer,
      steps: steps.map((st) => st.replace(/^\$= /, '$\\displaystyle = ')),
      distractors: distinctDistractors(answer, wrong.map(show), (k) => show(base instanceof Frac ? base.add(offset(k)) : new Frac(offset(k)))),
      check: { kind: 'limit', point },
    };
  },
});
