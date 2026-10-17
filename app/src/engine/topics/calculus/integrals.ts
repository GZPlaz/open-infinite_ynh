/** Integration: power rule, definite integrals, u-substitution. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, paren, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { integrate, powerSumTex, pt, type PowerTerm } from './power-terms';

type Kind = 'poly' | 'general' | 'definite' | 'usub' | 'transcendental';

const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['poly'],
  medium: ['general', 'definite', 'poly'],
  hard: ['usub', 'definite', 'general'],
};

/** Polynomial whose antiderivative has integer coefficients (unless fractions are allowed). */
function nicePoly(rng: Rng, deg: number, fractions: boolean): Poly {
  return attempt('integral-poly', () => {
    const c = Array.from({ length: deg + 1 }, (_, i) => (rng.bool(i === deg ? 1 : 0.7) ? rng.signedInt(1, fractions ? 9 : 4, true) * (fractions ? 1 : i + 1) : 0));
    const p = new Poly(c);
    return p.degree === deg && p.c.filter((x) => !x.isZero()).length >= 2 ? p : null;
  });
}

/** Coefficient in front of a non-constant factor: `''`, `-`, `3`, `\frac{1}{2}`. */
const lead = (x: Frac) => (x.eq(1) ? '' : x.eq(-1) ? '-' : num(x));

const polyTerms = (p: Poly): PowerTerm[] => p.c.map((c, i) => pt(c, i)).filter((t) => !t.c.isZero());

export const integrals = defineTopic({
  id: 'calc.integrals',
  subject: 'calculus',
  title: 'Integration',
  description: 'Indefinite integrals by the power rule, definite integrals, u-substitution.',
  instruction: 'Evaluate each integral.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Integrals',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'indefinite', label: 'Indefinite only' },
        { value: 'definite', label: 'Definite only' },
      ],
    },
    { type: 'boolean', id: 'fractions', label: 'Allow fractional coefficients', default: false },
    { type: 'boolean', id: 'transcendental', label: 'Include trig, exponential and log integrands (hard)', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'type');
    const fractions = boolOpt(ctx, 'fractions');
    let kind: Kind = rng.pick(KINDS[difficulty]);
    if (tOpt === 'definite') kind = 'definite';
    else if (tOpt === 'indefinite' && kind === 'definite') kind = difficulty === 'hard' ? 'usub' : 'poly';
    if (kind === 'usub' && boolOpt(ctx, 'transcendental') && rng.bool(0.5)) kind = 'transcendental';

    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrongs: string[];
    let fallback: (k: number) => string;
    let check: Record<string, unknown> = { kind: 'integral' };

    switch (kind) {
      case 'poly':
      case 'general': {
        let terms: PowerTerm[];
        if (kind === 'poly') terms = polyTerms(nicePoly(rng, rng.int(1, 3), fractions));
        else {
          terms = attempt('integral-general', () => {
            const ts: PowerTerm[] = [];
            const pool = rng.sample<Frac>([new Frac(-2), new Frac(-3), new Frac(1, 2), new Frac(-1, 2), new Frac(2), new Frac(1)], 2);
            for (const p of pool) {
              // c = k·(numerator of p + 1) makes c / (p + 1) an integer
              const q = p.add(1);
              ts.push(pt(rng.signedInt(1, 4, true) * (fractions ? 1 : q.n), p));
            }
            if (rng.bool(0.4)) ts.push(pt(rng.signedInt(1, 9, true), 0));
            return ts;
          });
        }
        terms = [...terms].sort((a, b) => b.p.cmp(a.p));
        const F = integrate(terms);
        const integrand = powerSumTex(terms, 'x', true);
        question = `\\int (${integrand})\\,dx`;
        const rewritten = sum(terms.map((t) => ({ coef: t.c, sym: t.p.isZero() ? '' : t.p.eq(1) ? 'x' : `x^{${t.p.toTex()}}` })));
        if (terms.some((t) => !t.p.isInt() || t.p.sign < 0)) steps.push(`Rewrite: $\\int (${rewritten})\\,dx$`);
        const raw = terms
          .map((t) => {
            const e = t.p.add(1);
            const c = t.c.abs();
            const body = t.p.isZero() ? `${c.eq(1) ? '' : num(c)}x` : `\\frac{${c.eq(1) ? '' : num(c)}x^{${e.toTex()}}}{${e.toTex()}}`;
            return { neg: t.c.sign < 0, body };
          })
          .map((x, i) => (i === 0 ? `${x.neg ? '-' : ''}${x.body}` : `${x.neg ? ' - ' : ' + '}${x.body}`))
          .join('');
        steps.push(`Power rule: $${raw} + C$`);
        const FTex = powerSumTex(F);
        answer = m(`${FTex} + C`);
        steps.push(answer);
        wrongs = [
          `${powerSumTex(terms.filter((t) => !t.p.isZero()).map((t) => pt(t.c.mul(t.p), t.p.sub(1))))} + C`,
          `${powerSumTex(terms.map((t) => pt(t.c, t.p.add(1))))} + C`,
          FTex,
        ];
        fallback = (k) => m(`${powerSumTex([...F, pt(offset(k), 1)])} + C`);
        break;
      }
      case 'definite': {
        const p = nicePoly(rng, rng.int(1, 3), fractions);
        const a = rng.int(-3, 2);
        const b = a + rng.int(1, 4);
        const F = p.antiderivative();
        const value = F.eval(b).sub(F.eval(a));
        question = `\\int_{${a}}^{${b}} (${p.toTex()})\\,dx`;
        steps.push(m(`= \\left[ ${F.toTex()} \\right]_{${a}}^{${b}}`));
        steps.push(m(`= ${paren(F.eval(b))} - ${paren(F.eval(a))} = ${num(value)}`));
        answer = m(num(value));
        wrongs = [num(F.eval(b).add(F.eval(a))), num(p.eval(b).sub(p.eval(a))), num(value.neg())];
        fallback = (k) => m(num(value.add(offset(k))));
        check = { kind: 'integral', bounds: [a, b] };
        break;
      }
      case 'usub': {
        const mPow = rng.int(1, 3);
        const n = rng.int(2, 6);
        const a = rng.int(1, 5);
        const b = rng.signedInt(1, 9, true);
        const inner = Poly.of(b, ...Array.from({ length: mPow - 1 }, () => 0), a);
        const t = inner.toTex();
        // integrand c·x^{m-1}(inner)^n; du = m·a·x^{m-1} dx; choose c as a multiple of m·a·(n+1) for a tidy answer
        const k = rng.signedInt(1, 3, true);
        const c = fractions ? rng.signedInt(1, 9, true) : k * mPow * a * (n + 1);
        const coef = new Frac(c, mPow * a * (n + 1));
        const xPart = mPow === 1 ? '' : mPow === 2 ? 'x' : `x^{${mPow - 1}}`;
        question = `\\int ${c === 1 ? '' : c === -1 ? '-' : c}${xPart}(${t})^{${n}}\\,dx`;
        const du = `${mPow * a === 1 ? '' : mPow * a}${xPart}`;
        steps.push(`Let $u = ${t}$, so $du = ${du || '1'}\\,dx$`);
        steps.push(m(`= ${lead(new Frac(c, mPow * a))}\\int u^{${n}}\\,du = ${lead(coef)}u^{${n + 1}} + C`));
        answer = m(`${lead(coef)}(${t})^{${n + 1}} + C`);
        const alt = (f: Frac, e: number) => `${lead(f)}(${t})${e === 1 ? '' : `^{${e}}`} + C`;
        wrongs = [alt(new Frac(c, n + 1), n + 1), alt(new Frac(c * n, mPow * a), n - 1), alt(coef.neg(), n + 1)];
        fallback = (q) => m(alt(coef.add(offset(q)), n + 1));
        break;
      }
      case 'transcendental':
      default: {
        const fn = rng.pick(['exp', 'cos', 'sin', 'log']);
        const a = rng.int(2, 6);
        const c = a * rng.signedInt(1, 4, true) * (fn === 'exp' || fn === 'log' ? 2 : 1);
        switch (fn) {
          case 'exp': {
            // ∫ c·x·e^{a x²} dx = c/(2a) e^{a x²}
            const f = new Frac(c, 2 * a);
            question = `\\int ${c}xe^{${a}x^{2}}\\,dx`;
            steps.push(`Let $u = ${a}x^{2}$, $du = ${2 * a}x\\,dx$`);
            answer = m(`${lead(f)}e^{${a}x^{2}} + C`);
            wrongs = [`${lead(new Frac(c))}e^{${a}x^{2}} + C`, `${lead(new Frac(c, a))}e^{${a}x^{2}} + C`, `${lead(f.neg())}e^{${a}x^{2}} + C`];
            fallback = (k) => m(`${lead(f.add(offset(k)))}e^{${a}x^{2}} + C`);
            break;
          }
          case 'cos':
          case 'sin': {
            // ∫ c·cos(ax) dx = (c/a) sin(ax);  ∫ c·sin(ax) dx = -(c/a) cos(ax)
            const f = new Frac(c, a);
            const g = fn === 'cos' ? 'sin' : 'cos';
            const s = fn === 'cos' ? f : f.neg();
            question = `\\int ${c}\\${fn}(${a}x)\\,dx`;
            steps.push(`Let $u = ${a}x$, $du = ${a}\\,dx$`);
            answer = m(`${lead(s)}\\${g}(${a}x) + C`);
            wrongs = [`${lead(s.neg())}\\${g}(${a}x) + C`, `${lead(new Frac(c * a))}\\${g}(${a}x) + C`, `${lead(s)}\\${fn}(${a}x) + C`];
            fallback = (k) => m(`${lead(s.add(offset(k)))}\\${g}(${a}x) + C`);
            break;
          }
          case 'log':
          default: {
            // ∫ c·x / (x² + a) dx = c/2 · ln(x² + a)
            const f = new Frac(c, 2);
            question = `\\int \\frac{${c}x}{x^{2} + ${a}}\\,dx`;
            steps.push(`Let $u = x^{2} + ${a}$, $du = 2x\\,dx$`);
            answer = m(`${lead(f)}\\ln(x^{2} + ${a}) + C`);
            wrongs = [`${lead(new Frac(c))}\\ln(x^{2} + ${a}) + C`, `\\frac{${c}}{x^{2} + ${a}} + C`, `${lead(f.neg())}\\ln(x^{2} + ${a}) + C`];
            fallback = (k) => m(`${lead(f.add(offset(k)))}\\ln(x^{2} + ${a}) + C`);
            break;
          }
        }
        break;
      }
    }
    return {
      question: m(`\\displaystyle ${question}`),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.map((w) => m(w)), fallback),
      check,
    };
  },
});
