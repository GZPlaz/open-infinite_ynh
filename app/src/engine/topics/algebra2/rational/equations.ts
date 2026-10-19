/** Rational equations, including extraneous solutions. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../../generator';
import { Poly } from '../../../polynomial';
import { m, num } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { joinTerms } from '../radicals/common';
import { solutionText } from '../radicals/equations';
import { RATIONAL_CATEGORY } from './expressions';
import { exactDiv, lin, polyFactoredTex, prod, Rat, rationalRoots } from './ratpoly';

interface Term {
  num: Poly;
  /** Linear denominator factors and a constant. */
  den: Poly[];
  k?: number;
  /** Show the denominator expanded (default: factored). */
  expanded?: boolean;
}

function denPoly(t: Term): Poly {
  return prod(t.den).scale(t.k ?? 1);
}

function termTex(t: Term, v: string): string {
  const D = denPoly(t);
  const lead = t.num.lead();
  const negConst = t.num.degree === 0 && lead.sign < 0;
  const N = negConst ? t.num.scale(-1) : t.num;
  if (D.degree === 0 && D.coef(0).eq(1)) return t.num.toTex(v);
  const dTex = t.expanded || t.den.length <= 1 ? D.toTex(v) : polyFactoredTex(D, v);
  return `${negConst ? '-' : ''}\\frac{${N.toTex(v)}}{${dTex}}`;
}

const sideTex = (ts: Term[], v: string) => joinTerms(ts.map((t) => termTex(t, v)));
const sideRat = (ts: Term[]) => ts.reduce((acc, t) => acc.add(Rat.of(t.num, denPoly(t))), Rat.of(Poly.of(0)));
const C = (c: number): Term => ({ num: Poly.of(c), den: [] });

type Form = 'proportion' | 'monomial' | 'sumConst' | 'xPlus' | 'extraneous' | 'sameDen';

export const rationalEquations = defineTopic({
  id: 'alg2.rational.equations',
  subject: 'algebra2',
  title: 'Solving Rational Equations',
  description: 'Clear denominators, solve, and reject extraneous solutions.',
  category: RATIONAL_CATEGORY,
  instruction: 'Solve each equation. Remember to check for extraneous solutions.',
  multipleChoice: true,
  defaultCount: 10,
  options: [opt.fractionAnswers(false), opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const fractions = boolOpt(ctx, 'fractions');
    const forms: Form[] =
      difficulty === 'easy' ? ['proportion', 'monomial'] : difficulty === 'medium' ? ['proportion', 'sumConst', 'xPlus', 'sameDen'] : ['sumConst', 'extraneous', 'extraneous', 'sameDen', 'xPlus'];
    const form = rng.pick(forms);
    const built = attempt('rational-equation', () => {
      let lhs: Term[];
      let rhs: Term[];
      const p = rng.signedInt(1, 7, true);
      let q = rng.signedInt(1, 7, true);
      if (q === p) q = -p === p ? p + 1 : -p;
      switch (form) {
        case 'proportion': {
          const numA = difficulty === 'easy' || rng.bool(0.5) ? Poly.of(rng.int(1, 9)) : lin(1, rng.int(-6, 6));
          lhs = [{ num: numA, den: [lin(1, p)] }];
          rhs = rng.bool(0.6) ? [{ num: Poly.of(rng.int(1, 9)), den: [lin(1, q)] }] : [{ num: Poly.of(rng.int(1, 9)), den: [], k: rng.int(2, 6) }];
          break;
        }
        case 'monomial': {
          const k = rng.int(2, 6);
          lhs = [{ num: Poly.of(rng.int(1, 9)), den: [lin(1, 0)] }, { num: Poly.of(rng.signedInt(1, 9, true)), den: [], k }];
          rhs = [{ num: Poly.of(rng.int(1, 12)), den: [lin(1, 0)], k: rng.pick([1, k]) }];
          break;
        }
        case 'sumConst':
          lhs = [
            { num: Poly.of(rng.int(1, 9)), den: [lin(1, p)] },
            { num: Poly.of(rng.signedInt(1, 9, true)), den: [lin(1, q)] },
          ];
          rhs = [C(rng.signedInt(1, 4, true))];
          break;
        case 'xPlus': {
          // x + a/x = b with chosen roots
          const r1 = rng.signedInt(1, 8, true);
          const r2 = rng.signedInt(1, 8, true);
          lhs = [{ num: lin(1, 0), den: [] }, { num: Poly.of(r1 * r2), den: [lin(1, 0)] }];
          rhs = [C(r1 + r2)];
          if (r1 + r2 === 0) return null;
          break;
        }
        case 'sameDen': {
          // a·x/(x + p) = b/(x + p) + c
          const a = rng.int(1, 5);
          const c = rng.signedInt(1, 4, true);
          const ext = rng.bool(0.4);
          const b = ext ? -p * a : rng.int(-9, 9);
          if (b === 0) return null;
          lhs = [{ num: lin(a, 0), den: [lin(1, p)] }];
          rhs = [{ num: Poly.of(b), den: [lin(1, p)] }, C(c)];
          break;
        }
        case 'extraneous':
        default: {
          // m·x/(x + p) + a/(x + q) = c/((x + p)(x + q)), c chosen so −p or −q is a root of the cleared equation
          const mm = rng.int(1, 3);
          const a = rng.signedInt(1, 6, true);
          const e = rng.pick([-p, -q]);
          const c = mm * e * (e + q) + a * (e + p);
          if (c === 0) return null;
          lhs = [
            { num: lin(mm, 0), den: [lin(1, p)] },
            { num: Poly.of(a), den: [lin(1, q)] },
          ];
          rhs = [{ num: Poly.of(c), den: [lin(1, p), lin(1, q)], expanded: rng.bool(0.6) }];
          break;
        }
      }
      const all = [...lhs, ...rhs];
      const factors: Poly[] = [];
      for (const t of all) for (const f of t.den) if (!factors.some((g) => g.eq(f))) factors.push(f);
      const kl = all.reduce((acc, t) => (t.k ? (acc * t.k) / gcdInt(acc, t.k) : acc), 1);
      const LCD = prod(factors).scale(kl);
      const E = sideRat(lhs).sub(sideRat(rhs));
      if (E.isZero()) return null;
      const cleared = exactDiv(E.N.mul(LCD), E.D);
      if (cleared.degree < 1 && !(form === 'sameDen' || form === 'extraneous')) return null;
      const { roots, rest } = cleared.degree >= 1 ? rationalRoots(cleared) : { roots: [], rest: cleared };
      if (rest.degree > 0) return null;
      const cands: Frac[] = [];
      for (const r of roots) if (!cands.some((x) => x.eq(r))) cands.push(r);
      const maxDen = fractions || difficulty === 'hard' ? 4 : 1;
      if (cands.some((r) => r.d > maxDen || Math.abs(r.value) > 15)) return null;
      const bad = (r: Frac) => factors.some((f) => f.eval(r).isZero());
      const sols = cands.filter((r) => !bad(r));
      const extraneous = cands.filter(bad);
      if (!fractions && difficulty !== 'hard' && sols.some((r) => !r.isInt())) return null;
      if (form === 'extraneous' && extraneous.length === 0) return null;
      return { lhs, rhs, LCD, cleared, cands, sols, extraneous, factors };
    });
    const { lhs, rhs, LCD, cleared, cands, sols, extraneous, factors } = built;
    const question = `${sideTex(lhs, v)} = ${sideTex(rhs, v)}`;
    const steps: string[] = [];
    steps.push(`Excluded values: ${m(factors.map((f) => `${v} \\neq ${num(rationalRoots(f).roots[0]!)}`).join(',\\ '))}.`);
    steps.push(`Multiply both sides by the LCD ${m(polyFactoredTex(LCD, v))}:`);
    if (cleared.degree >= 1) {
      steps.push(m(`${cleared.toTex(v)} = 0`));
      steps.push(`Candidates: ${m(`${v} = ${cands.map((c) => num(c)).join(', ')}`)}`);
    } else steps.push(m(`${cleared.toTex(v)} = 0`) + ' is false.');
    for (const e of extraneous) steps.push(`${m(`${v} = ${num(e)}`)} makes a denominator zero, so it is extraneous.`);
    const answer = solutionText(v, sols);
    const wrongSets: Frac[][] = [cands, extraneous, sols.map((s) => s.neg()), cands.map((c) => c.neg()), sols.length ? [] : [new Frac(1)]];
    if (sols.length === 2) wrongSets.push([sols[0]!], [sols[1]!]);
    const distractors = distinctDistractors(
      answer,
      wrongSets.map((ws) => (ws.length === 0 && sols.length === 0 ? null : solutionText(v, ws))),
      (k) => solutionText(v, [(sols[0] ?? cands[0] ?? new Frac(0)).add(k)]),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.roots', variable: v, solutions: sols.map((s) => s.value), extraneous: extraneous.map((s) => s.value) },
    };
  },
});

function gcdInt(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}
