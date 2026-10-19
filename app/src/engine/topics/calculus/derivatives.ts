/** Differentiation: power rule, product and quotient rules, chain rule. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { derive, powerSumTex, pt, type PowerTerm } from './power-terms';

type Kind = 'power' | 'general' | 'product' | 'quotient' | 'chain' | 'transcendental';

const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['power'],
  medium: ['general', 'product', 'quotient'],
  hard: ['chain', 'quotient', 'chain'],
};

const DYDX = '\\frac{dy}{dx}';

function randPoly(rng: Rng, deg: number, max: number, terms: number): Poly {
  return attempt('deriv-poly', () => {
    const c = Array.from({ length: deg + 1 }, () => 0);
    c[deg] = rng.signedInt(1, max, true);
    rng.sample(Array.from({ length: deg }, (_, i) => i), Math.min(terms - 1, deg)).forEach((i) => (c[i] = rng.signedInt(1, max, true)));
    return new Poly(c);
  });
}

const polyTerms = (p: Poly): PowerTerm[] => p.c.map((c, i) => pt(c, i));
const coefTex = (k: Frac) => (k.eq(1) ? '' : k.eq(-1) ? '-' : num(k));

export const derivatives = defineTopic({
  id: 'calc.derivatives',
  subject: 'calculus',
  category: 'Differentiation',
  title: 'Differentiation Rules',
  description: 'Power rule, product and quotient rules, chain rule; optional trig, exponential and log functions.',
  instruction: 'Differentiate each function with respect to x.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'rules',
      label: 'Rules',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'power', label: 'Power rule' },
        { value: 'productQuotient', label: 'Product & quotient rules' },
        { value: 'chain', label: 'Chain rule' },
      ],
    },
    { type: 'boolean', id: 'transcendental', label: 'Include trig, exponential and log functions', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const rules = strOpt(ctx, 'rules');
    const trans = boolOpt(ctx, 'transcendental');
    let kind: Kind =
      rules === 'power'
        ? difficulty === 'easy'
          ? 'power'
          : 'general'
        : rules === 'productQuotient'
          ? rng.pick<Kind>(['product', 'quotient'])
          : rules === 'chain'
            ? 'chain'
            : rng.pick(KINDS[difficulty]);
    if (trans && (kind === 'chain' || (difficulty !== 'easy' && rng.bool(0.35)))) kind = rng.bool(0.6) ? 'transcendental' : kind;

    const steps: string[] = [];
    let fTex: string;
    let dTex: string;
    let wrongs: string[];

    switch (kind) {
      case 'power': {
        const p = randPoly(rng, rng.int(2, 5), 9, rng.int(3, 4));
        fTex = p.toTex();
        const d = p.derivative();
        dTex = d.toTex();
        steps.push(`Power rule on each term: $${powerSumTex(polyTerms(p).map((t) => pt(t.c.mul(t.p), t.p.sub(1))).filter((t) => !t.c.isZero()))}$`);
        wrongs = [
          new Poly(p.c.slice(1)).toTex(),
          new Poly(d.c.map((c, i) => (i === 0 ? c.add(p.coef(0).isZero() ? 1 : p.coef(0)) : c))).toTex(),
          new Poly(p.c.map((c, i) => c.mul(i))).toTex(),
        ];
        break;
      }
      case 'general': {
        const terms = attempt('deriv-general', () => {
          const ts: PowerTerm[] = [pt(rng.signedInt(1, 8, true), rng.int(2, 4))];
          const extra = rng.sample<Frac>([new Frac(-1), new Frac(-2), new Frac(-3), new Frac(1, 2), new Frac(-1, 2), new Frac(1)], 2);
          for (const p of extra) {
            const c = p.isInt() ? rng.signedInt(1, 9, true) : rng.signedInt(1, 5, true) * 2;
            ts.push(pt(c, p));
          }
          if (rng.bool(0.5)) ts.push(pt(rng.signedInt(1, 9, true), 0));
          return ts;
        });
        fTex = powerSumTex(terms);
        const d = derive(terms);
        dTex = powerSumTex(d);
        if (terms.some((t) => !t.p.isInt() || t.p.sign < 0)) {
          const rewritten = sum(terms.map((t) => ({ coef: t.c, sym: t.p.isZero() ? '' : t.p.eq(1) ? 'x' : `x^{${t.p.toTex()}}` })));
          steps.push(`Rewrite with exponents: $y = ${rewritten}$`);
        }
        steps.push(`Power rule: $${dTex}$`);
        wrongs = [
          powerSumTex(terms.filter((t) => !t.p.isZero()).map((t) => pt(t.c.mul(t.p), t.p.add(1)))),
          powerSumTex(terms.filter((t) => !t.p.isZero()).map((t) => pt(t.c, t.p.sub(1)))),
          powerSumTex(d.map((t) => (t.p.sign < 0 ? pt(t.c.neg(), t.p) : t))),
        ];
        break;
      }
      case 'product': {
        const f = randPoly(rng, rng.int(1, 2), 6, 2);
        const g = randPoly(rng, rng.int(1, 2), 6, 2);
        fTex = `(${f.toTex()})(${g.toTex()})`;
        const d = f.derivative().mul(g).add(f.mul(g.derivative()));
        dTex = d.toTex();
        steps.push(m(`${DYDX} = (${f.toTex()})(${g.derivative().toTex()}) + (${g.toTex()})(${f.derivative().toTex()})`));
        steps.push(m(`${DYDX} = ${dTex}`));
        wrongs = [f.derivative().mul(g.derivative()).toTex(), f.derivative().mul(g).sub(f.mul(g.derivative())).toTex(), f.mul(g).derivative().add(Poly.of(1)).toTex()];
        break;
      }
      case 'quotient': {
        const { nP, dP } = attempt('deriv-quot', () => {
          const nP = randPoly(rng, difficulty === 'hard' ? rng.int(1, 2) : 1, 6, 2);
          const dP = randPoly(rng, 1, 6, 2);
          const top = nP.derivative().mul(dP).sub(nP.mul(dP.derivative()));
          return top.isZero() ? null : { nP, dP };
        });
        fTex = `\\frac{${nP.toTex()}}{${dP.toTex()}}`;
        const top = nP.derivative().mul(dP).sub(nP.mul(dP.derivative()));
        dTex = `\\frac{${top.toTex()}}{(${dP.toTex()})^{2}}`;
        steps.push(m(`${DYDX} = \\frac{(${dP.toTex()})(${nP.derivative().toTex()}) - (${nP.toTex()})(${dP.derivative().toTex()})}{(${dP.toTex()})^{2}}`));
        steps.push(m(`${DYDX} = ${dTex}`));
        const swapped = nP.mul(dP.derivative()).sub(nP.derivative().mul(dP));
        wrongs = [
          `\\frac{${swapped.toTex()}}{(${dP.toTex()})^{2}}`,
          `\\frac{${top.toTex()}}{${dP.toTex()}}`,
          `\\frac{${nP.derivative().toTex()}}{${dP.derivative().toTex()}}`,
        ];
        break;
      }
      case 'chain': {
        const n = rng.int(2, 6);
        const k = rng.int(1, 3);
        const a = rng.signedInt(1, 6, true);
        const b = rng.signedInt(1, 9, true);
        const inner = Poly.of(b, ...Array.from({ length: k - 1 }, () => 0), a);
        const innerTex = inner.toTex();
        const useRoot = rng.bool(0.3);
        if (useRoot) {
          // y = √(inner), inner > 0 near x > 0 requires a, b > 0
          const inn = Poly.of(Math.abs(b), ...Array.from({ length: k - 1 }, () => 0), Math.abs(a));
          const t = inn.toTex();
          fTex = `\\sqrt{${t}}`;
          const top = inn.derivative();
          const halved = top.c.every((c) => c.mul(new Frac(1, 2)).isInt());
          dTex = halved ? `\\frac{${top.scale(new Frac(1, 2)).toTex()}}{\\sqrt{${t}}}` : `\\frac{${top.toTex()}}{2\\sqrt{${t}}}`;
          steps.push(m(`y = (${t})^{\\frac{1}{2}}`));
          steps.push(m(`${DYDX} = \\frac{1}{2}(${t})^{-\\frac{1}{2}} \\cdot ${top.toTex().includes(' ') ? `(${top.toTex()})` : top.toTex()}`));
          const half = top.scale(new Frac(1, 2));
          const halfLead = half.degree === 0 ? coefTex(half.coef(0)) : half.toTex().includes(' ') ? `(${half.toTex()})` : half.toTex();
          wrongs = [`\\frac{1}{2\\sqrt{${t}}}`, `\\frac{${top.toTex()}}{\\sqrt{${t}}}`, `${halfLead}\\sqrt{${t}}`];
        } else {
          fTex = `(${innerTex})^{${n}}`;
          const coef = new Frac(n * k * a);
          const xPart = k === 1 ? '' : k === 2 ? 'x' : `x^{${k - 1}}`;
          const outer = n - 1 === 1 ? `(${innerTex})` : `(${innerTex})^{${n - 1}}`;
          dTex = `${coefTex(coef)}${xPart}${outer}`;
          const innerD = powerSumTex([pt(k * a, k - 1)]);
          steps.push(m(`${DYDX} = ${n}(${innerTex})${n - 1 === 1 ? '' : `^{${n - 1}}`} \\cdot ${k * a < 0 ? `(${innerD})` : innerD}`));
          steps.push(m(`${DYDX} = ${dTex}`));
          const outerAlt = n - 1 === 1 ? `(${innerTex})` : `(${innerTex})^{${n - 1}}`;
          wrongs = [
            `${n === 1 ? '' : n}${outerAlt}`,
            `${coefTex(new Frac(n * k * a))}${xPart}(${innerTex})^{${n}}`,
            `${coefTex(new Frac(n * a))}${xPart}${outer}`,
          ];
        }
        break;
      }
      case 'transcendental':
      default: {
        const fn = rng.pick(['sin', 'cos', 'exp', 'ln']);
        const a = rng.int(1, 6);
        const k = rng.int(1, 3);
        const b = fn === 'ln' ? rng.int(1, 9) : rng.int(-5, 5);
        const inner = Poly.of(b, ...Array.from({ length: k - 1 }, () => 0), a);
        const t = inner.toTex();
        const di = inner.derivative();
        const diTex = di.toTex();
        const coefPart = (s: Poly) => (s.degree === 0 ? coefTex(s.coef(0)) : s.c.filter((c) => !c.isZero()).length > 1 ? `(${s.toTex()})` : s.toTex());
        switch (fn) {
          case 'sin':
            fTex = `\\sin(${t})`;
            dTex = `${coefPart(di)}\\cos(${t})`;
            wrongs = [`\\cos(${t})`, `-${coefPart(di)}\\cos(${t})`, `${coefPart(di)}\\sin(${t})`];
            break;
          case 'cos':
            fTex = `\\cos(${t})`;
            dTex = `-${coefPart(di)}\\sin(${t})`;
            wrongs = [`${coefPart(di)}\\sin(${t})`, `-\\sin(${t})`, `-${coefPart(di)}\\cos(${t})`];
            break;
          case 'exp':
            fTex = `e^{${t}}`;
            dTex = `${coefPart(di)}e^{${t}}`;
            wrongs = [`e^{${t}}`, `${coefPart(di)}e^{${di.degree === 0 ? `${t} - 1` : di.toTex()}}`, `(${t})e^{${Poly.of(b - 1, ...Array.from({ length: k - 1 }, () => 0), a).toTex()}}`];
            break;
          case 'ln':
          default:
            fTex = `\\ln(${t})`;
            dTex = `\\frac{${diTex}}{${t}}`;
            wrongs = [`\\frac{1}{${t}}`, `\\frac{${t}}{${diTex}}`, `${coefPart(di)}\\ln(${t})`];
            break;
        }
        steps.push(`Chain rule with $u = ${t}$, $u' = ${diTex}$: $${DYDX} = ${dTex}$`);
        break;
      }
    }
    const answer = m(`\\displaystyle ${DYDX} = ${dTex}`);
    return {
      question: m(`\\displaystyle y = ${fTex}`),
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        wrongs.map((w) => m(`\\displaystyle ${DYDX} = ${w}`)),
        (k) => m(`\\displaystyle ${DYDX} = ${dTex} ${offset(k) > 0 ? '+' : '-'} ${Math.abs(offset(k))}`),
      ),
      check: { kind: 'derivative' },
    };
  },
});
