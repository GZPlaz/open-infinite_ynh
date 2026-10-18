/** Factoring polynomials: grouping, sums/differences of cubes, quadratic form, and all techniques. */
import { gcd } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, pow, sum } from '../../../tex';
import type { Difficulty, ProblemContent, TopicGenerator } from '../../../types';
import { CATEGORY, contentOf, expandFactored, type Factor, type Factored, factoredKey, factoredTex, isCube, isSquare, timesTex } from './common';

export interface FactorProblem {
  answer: Factored;
  steps: string[];
  wrongs: Factored[];
}

const fac = (k: number, monoDeg: number, ps: Poly[]): Factored => ({ k, mono: monoDeg, factors: ps.map((p): Factor => ({ p, e: 1 })) });

/** Split p·x^m + q further when it is a difference of squares (m = 2) or a sum/difference of cubes (m = 3). */
export function splitBinomial(p: number, q: number, mm: number): Poly[] {
  if (mm === 2 && q < 0 && isSquare(p) && isSquare(-q)) {
    const t = Math.round(Math.sqrt(p));
    const s = Math.round(Math.sqrt(-q));
    return [Poly.linear(t, s), Poly.linear(t, -s)];
  }
  if (mm === 3 && isCube(p) && isCube(q)) {
    const t = Math.round(Math.cbrt(p));
    const w = Math.sign(q) * Math.round(Math.cbrt(Math.abs(q)));
    return [Poly.linear(t, w), Poly.of(w * w, -t * w, t * t)];
  }
  const c = Array.from({ length: mm + 1 }, () => 0);
  c[mm] = p;
  c[0] = q;
  return [new Poly(c)];
}

/** Optional greatest common factor k·x^j. */
function pickGcf(rng: Rng, prob: number, monoOk: boolean, negatives = false): { k: number; j: number } {
  if (!rng.bool(prob)) return { k: 1, j: 0 };
  const k = rng.int(1, 4) * (negatives && rng.bool(0.2) ? -1 : 1);
  const j = monoOk && (k === 1 || rng.bool(0.4)) ? rng.int(1, 2) : 0;
  if (k === 1 && j === 0) return { k: 2, j: 0 };
  return { k, j };
}

function gcfStep(g: { k: number; j: number }, inner: Poly, v: string): string | null {
  if (g.k === 1 && g.j === 0) return null;
  return `Factor out the GCF: $${timesTex(g.k, pow(v, g.j), inner.toTex(v), true)}$`;
}

export function buildGrouping(rng: Rng, d: Difficulty, v: string): FactorProblem {
  return attempt('grouping', () => {
    const a = d === 'easy' ? 1 : rng.int(1, 3);
    let c = d === 'easy' ? 1 : rng.int(1, 4);
    const b = rng.signedInt(1, d === 'easy' ? 6 : 7, true);
    let dd = rng.signedInt(1, 9, true);
    if (d === 'hard' && rng.bool(0.45)) {
      const t = rng.int(1, 2);
      const s = rng.int(1, 3);
      if (gcd(t, s) !== 1) return null;
      c = t * t;
      dd = -(s * s);
    }
    if (gcd(a, b) !== 1 || gcd(c, dd) !== 1) return null;
    if (d === 'medium' && a === 1 && c === 1 && rng.bool(0.6)) return null;
    const L = Poly.linear(a, b);
    const Q = Poly.of(dd, 0, c);
    const g = pickGcf(rng, d === 'hard' ? 0.45 : 0, true);
    const split = splitBinomial(c, dd, 2);
    const answer = fac(g.k, g.j, [...split, L]);
    const inner = Q.mul(L);
    const steps: string[] = [];
    const gs = gcfStep(g, inner, v);
    if (gs) steps.push(gs);
    const hi = new Poly([0, 0, inner.coef(2), inner.coef(3)]);
    const lo = new Poly([inner.coef(0), inner.coef(1)]);
    steps.push(`Group: $(${hi.toTex(v)}) + (${lo.toTex(v)})$`);
    steps.push(`Factor each group: $${timesTex(c, pow(v, 2), L.toTex(v), true)}${timesTex(dd, '', L.toTex(v), false)}$`);
    steps.push(`$= ${factoredTex(fac(g.k, g.j, [Q, L]), v)}$`);
    if (split.length > 1) steps.push(`Difference of squares: $${factoredTex(answer, v)}$`);
    const wrongs = [
      fac(g.k, g.j, [Poly.of(-dd, 0, c), L]),
      fac(g.k, g.j, [Q, Poly.linear(a, -b)]),
      split.length > 1 ? fac(g.k, g.j, [Q, L]) : fac(g.k, g.j, [Poly.of(dd, 0, a), Poly.linear(c, b)]),
      g.k !== 1 || g.j !== 0 ? fac(1, 0, [...split, L]) : fac(1, 0, [Poly.of(b, 0, c), Poly.linear(a, dd)]),
    ];
    if (Math.abs(inner.coef(3).value) > 30 || Math.abs(inner.coef(0).value) > 60) return null;
    return { answer, steps, wrongs };
  });
}

export function buildCubes(rng: Rng, d: Difficulty, v: string, type: string): FactorProblem {
  return attempt('cubes', () => {
    const s = type === 'sum' ? 1 : type === 'difference' ? -1 : rng.sign();
    if (d === 'hard' && s < 0 && rng.bool(0.2)) {
      const b = rng.int(1, 2);
      const answer = fac(1, 0, [Poly.linear(1, b), Poly.linear(1, -b), Poly.of(b * b, b, 1), Poly.of(b * b, -b, 1)]);
      const b3 = b ** 3;
      return {
        answer,
        steps: [
          `Difference of squares first: $(${v}^{3} + ${b3})(${v}^{3} - ${b3})$`,
          `Factor the sum and difference of cubes: $${factoredTex(answer, v)}$`,
        ],
        wrongs: [
          fac(1, 0, [Poly.of(b3, 0, 0, 1), Poly.of(-b3, 0, 0, 1)]),
          fac(1, 0, [Poly.linear(1, b), Poly.linear(1, -b), Poly.of(b * b, 0, 1), Poly.of(-b * b, 0, 1)]),
          fac(1, 0, [Poly.of(b * b, 0, 1), Poly.of(-b * b, 0, 1), Poly.of(b * b, 0, 1)]),
          fac(1, 0, [Poly.linear(1, b), Poly.linear(1, -b), Poly.of(b * b, 2 * b, 1), Poly.of(b * b, -2 * b, 1)]),
        ],
      };
    }
    const a = d === 'easy' ? 1 : rng.int(1, d === 'medium' ? 3 : 4);
    const b = rng.int(1, d === 'easy' ? 4 : 5);
    if (gcd(a, b) !== 1) return null;
    const g = pickGcf(rng, d === 'hard' ? 0.5 : 0, true);
    const L = Poly.linear(a, s * b);
    const Q = Poly.of(b * b, -s * a * b, a * a);
    const answer = fac(g.k, g.j, [L, Q]);
    const word = s > 0 ? 'Sum' : 'Difference';
    const steps: string[] = [];
    const gs = gcfStep(g, L.mul(Q), v);
    if (gs) steps.push(gs);
    const at = a === 1 ? v : `${a}${v}`;
    steps.push(`${word} of cubes: $(${at})^{3} ${s > 0 ? '+' : '-'} (${b})^{3}$`);
    steps.push(s > 0 ? 'Use $a^{3} + b^{3} = (a + b)(a^{2} - ab + b^{2})$' : 'Use $a^{3} - b^{3} = (a - b)(a^{2} + ab + b^{2})$');
    steps.push(`$= ${factoredTex(answer, v)}$`);
    const wrongs = [
      fac(g.k, g.j, [L, Poly.of(b * b, s * a * b, a * a)]),
      fac(g.k, g.j, [Poly.linear(a, -s * b), Poly.of(b * b, s * a * b, a * a)]),
      fac(g.k, g.j, [L, Poly.of(b * b, -2 * s * a * b, a * a)]),
      { k: g.k, mono: g.j, factors: [{ p: L, e: 3 }] },
    ];
    return { answer, steps, wrongs };
  });
}

export function buildQuadForm(rng: Rng, d: Difficulty, v: string): FactorProblem {
  return attempt('quadratic-form', () => {
    const mm = d === 'hard' && rng.bool(0.3) ? 3 : 2;
    const nonmonic = d === 'hard' && mm === 2 && rng.bool(0.6);
    const p = nonmonic ? rng.pick([1, 2, 3, 4, 9]) : 1;
    const r = nonmonic ? rng.pick([1, 2, 4, 9]) : 1;
    if (p * r === 1 && nonmonic) return null;
    const pick = () => {
      if (mm === 3) return rng.pick([1, -1, 8, -8, 27, -27, 2, -3, 5]);
      const sq = rng.bool(d === 'easy' ? 0.75 : 0.55);
      return sq ? -rng.pick([1, 4, 9, 16, 25, 36]) : rng.signedInt(1, d === 'easy' ? 6 : 10, true);
    };
    const q = pick();
    const s = pick();
    if (gcd(p, q) !== 1 || gcd(r, s) !== 1) return null;
    if (p === r && q === s && rng.bool(0.7)) return null;
    const g = pickGcf(rng, d === 'easy' ? 0 : 0.3, false);
    const f1 = splitBinomial(p, q, mm);
    const f2 = splitBinomial(r, s, mm);
    const answer = fac(g.k, g.j, [...f1, ...f2]);
    const b1 = new Poly(Array.from({ length: mm + 1 }, (_, i) => (i === mm ? p : i === 0 ? q : 0)));
    const b2 = new Poly(Array.from({ length: mm + 1 }, (_, i) => (i === mm ? r : i === 0 ? s : 0)));
    const inner = b1.mul(b2);
    if (inner.c.some((c) => Math.abs(c.value) > 120)) return null;
    // the u-trinomial must look like a quadratic in x^m: middle coefficient non-zero
    if (inner.coef(mm).isZero()) return null;
    const steps: string[] = [];
    const gs = gcfStep(g, inner, v);
    if (gs) steps.push(gs);
    const uTri = Poly.of(inner.coef(0), inner.coef(mm), inner.coef(2 * mm));
    steps.push(`Let $u = ${pow(v, mm)}$: $${uTri.toTex('u')} = (${Poly.linear(p, q).toTex('u')})(${Poly.linear(r, s).toTex('u')})$`);
    steps.push(`Substitute back: $${factoredTex(fac(g.k, g.j, [b1, b2]), v)}$`);
    if (f1.length + f2.length > 2) steps.push(`Factor completely: $${factoredTex(answer, v)}$`);
    const flip = (pp: number, qq: number) => splitBinomial(pp, -qq, mm);
    const wrongs: Factored[] = [
      f1.length + f2.length > 2 ? fac(g.k, g.j, [b1, b2]) : fac(g.k, g.j, [...flip(p, q), ...flip(r, s)]),
      fac(g.k, g.j, [...flip(p, q), ...flip(r, s)]),
      p !== r ? fac(g.k, g.j, [...splitBinomial(p, s, mm), ...splitBinomial(r, q, mm)]) : fac(g.k, g.j, [...f1, ...flip(r, s)]),
      fac(g.k, g.j, [...flip(p, q), ...f2]),
    ];
    return { answer, steps, wrongs };
  });
}

function buildTrinomial(rng: Rng, d: Difficulty, v: string): FactorProblem {
  return attempt('trinomial', () => {
    const m1 = d === 'easy' ? 1 : rng.int(1, 3);
    const m2 = d === 'easy' ? 1 : rng.int(1, 2);
    const p = rng.signedInt(1, 7, true);
    const q = rng.signedInt(1, 7, true);
    if (gcd(m1, p) !== 1 || gcd(m2, q) !== 1) return null;
    const g = pickGcf(rng, 0.85, true, d === 'hard');
    const f1 = Poly.linear(m1, p);
    const f2 = Poly.linear(m2, q);
    const inner = f1.mul(f2);
    const answer = fac(g.k, g.j, [f1, f2]);
    const steps: string[] = [];
    const gs = gcfStep(g, inner, v);
    if (gs) steps.push(gs);
    steps.push(`Factor the trinomial: $${inner.toTex(v)} = (${f1.toTex(v)})(${f2.toTex(v)})$`);
    steps.push(`$${factoredTex(answer, v)}$`);
    const wrongs = [
      fac(g.k, g.j, [Poly.linear(m1, -p), Poly.linear(m2, -q)]),
      fac(g.k, g.j, [Poly.linear(m1, q), Poly.linear(m2, p)]),
      fac(1, 0, [f1, f2]),
      fac(g.k, g.j, [f1, Poly.linear(m2, -q)]),
    ];
    return { answer, steps, wrongs };
  });
}

function buildSquares(rng: Rng, d: Difficulty, v: string): FactorProblem {
  return attempt('squares', () => {
    const quartic = d !== 'easy' && rng.bool(0.4);
    const a = quartic ? 1 : rng.int(1, d === 'easy' ? 3 : 5);
    const b = rng.int(1, quartic ? 3 : 9);
    if (gcd(a, b) !== 1) return null;
    const g = pickGcf(rng, d === 'easy' ? 0.4 : 0.6, true);
    let answer: Factored;
    let inner: Poly;
    let wrongs: Factored[];
    if (quartic) {
      inner = Poly.of(-(b ** 4), 0, 0, 0, 1);
      answer = fac(g.k, g.j, [Poly.of(b * b, 0, 1), Poly.linear(1, b), Poly.linear(1, -b)]);
      wrongs = [
        fac(g.k, g.j, [Poly.of(b * b, 0, 1), Poly.of(-b * b, 0, 1)]),
        fac(g.k, g.j, [Poly.linear(1, b), Poly.linear(1, -b), Poly.linear(1, b), Poly.linear(1, -b)]),
        fac(g.k, g.j, [Poly.linear(1, -b), Poly.linear(1, -b), Poly.of(b * b, 0, 1)]),
      ];
    } else {
      inner = Poly.of(-b * b, 0, a * a);
      answer = fac(g.k, g.j, [Poly.linear(a, b), Poly.linear(a, -b)]);
      wrongs = [
        { k: g.k, mono: g.j, factors: [{ p: Poly.linear(a, -b), e: 2 }] },
        { k: g.k, mono: g.j, factors: [{ p: Poly.linear(a, b), e: 2 }] },
        fac(1, 0, [Poly.linear(a, b), Poly.linear(a, -b)]),
        fac(g.k, g.j, [Poly.linear(a * a, b), Poly.linear(1, -b)]),
      ];
    }
    const steps: string[] = [];
    const gs = gcfStep(g, inner, v);
    if (gs) steps.push(gs);
    steps.push(`Difference of squares${quartic ? ' (twice)' : ''}: $${factoredTex(answer, v)}$`);
    return { answer, steps, wrongs };
  });
}

function buildGcfOnly(rng: Rng, d: Difficulty, v: string): FactorProblem {
  return attempt('gcf', () => {
    const inner = Poly.of(rng.signedInt(1, 7, true), rng.signedInt(1, 7, true), rng.int(1, 5));
    const D = inner.coef(1).value ** 2 - 4 * inner.coef(2).value * inner.coef(0).value;
    if (isSquare(D) || contentOf(inner) !== 1) return null;
    const g = { k: rng.int(2, d === 'easy' ? 5 : 9), j: rng.int(1, d === 'hard' ? 3 : 2) };
    const answer = fac(g.k, g.j, [inner]);
    const steps = [`Factor out the GCF: $${factoredTex(answer, v)}$`, `$${inner.toTex(v)}$ does not factor further.`];
    const wrongs = [
      fac(g.k, Math.max(0, g.j - 1), [inner.mul(Poly.of(0, 1))]),
      fac(1, g.j, [inner.scale(g.k)]),
      fac(g.k, g.j, [new Poly(inner.c.map((c, i) => (i === 0 ? c.neg() : c)))]),
    ];
    return { answer, steps, wrongs };
  });
}

/** Fallback wrong answers: perturb the constant term of one factor. */
function perturb(ans: Factored, k: number): Factored {
  const fs = ans.factors.map((f) => ({ ...f }));
  if (fs.length === 0) return { ...ans, k: ans.k + offset(k) || 7 };
  const i = k % fs.length;
  const p = fs[i]!.p;
  const c0 = p.coef(0).value;
  const nc = k <= fs.length ? -c0 : c0 + offset(k);
  fs[i] = { p: new Poly(p.c.map((c, j) => (j === 0 ? nc : c))), e: fs[i]!.e };
  return { ...ans, factors: fs };
}

export function factorContent(fp: FactorProblem, v: string): ProblemContent {
  const poly = expandFactored(fp.answer);
  const answer = m(factoredTex(fp.answer, v));
  const key = factoredKey(fp.answer);
  const wrongs = fp.wrongs.filter((w) => factoredKey(w) !== key && !expandFactored(w).isZero() && w.factors.every((f) => !f.p.isZero() && f.p.degree > 0));
  return {
    question: m(poly.toTex(v)),
    answer,
    steps: fp.steps,
    distractors: distinctDistractors(
      answer,
      wrongs.map((w) => m(factoredTex(w, v))),
      (k) => {
        const w = perturb(fp.answer, k);
        return factoredKey(w) === key || w.factors.some((f) => f.p.coef(0).isZero()) ? null : m(factoredTex(w, v));
      },
    ),
    check: { kind: 'alg2-polynomials.factored', vars: [v] },
  };
}

const FACTOR_INSTRUCTION = 'Factor each completely.';

export const factoringByGrouping: TopicGenerator = defineTopic({
  id: 'alg2.poly.factor-grouping',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Factoring by Grouping',
  description: 'Factor four-term cubic polynomials by grouping, then factor any difference of squares that remains.',
  instruction: FACTOR_INSTRUCTION,
  multipleChoice: true,
  defaultCount: 10,
  options: [opt.variedVariables(true)],
  generate(ctx) {
    const v = pickVar(ctx.rng, boolOpt(ctx, 'variedVars'));
    return factorContent(buildGrouping(ctx.rng, ctx.difficulty, v), v);
  },
});

/** Two-variable sum/difference of cubes a³x³ ± b³y³. */
function twoVarCubes(rng: Rng, d: Difficulty, v: string, type: string): ProblemContent {
  const { a, b } = attempt('cubes-2var', () => {
    const a1 = rng.int(1, d === 'easy' ? 2 : 4);
    const b1 = rng.int(1, d === 'easy' ? 3 : 5);
    return gcd(a1, b1) === 1 && a1 * b1 > 1 ? { a: a1, b: b1 } : null;
  });
  const s = type === 'sum' ? 1 : type === 'difference' ? -1 : rng.sign();
  const x = v;
  const y = 'y';
  const lin = (sb: number) => sum([{ coef: a, sym: x }, { coef: sb * b, sym: y }]);
  const quad = (mid: number) => sum([{ coef: a * a, sym: `${x}^{2}` }, { coef: mid, sym: `${x}${y}` }, { coef: b * b, sym: `${y}^{2}` }]);
  const question = sum([{ coef: a ** 3, sym: `${x}^{3}` }, { coef: s * b ** 3, sym: `${y}^{3}` }]);
  const answerTex = `(${lin(s)})(${quad(-s * a * b)})`;
  const answer = m(answerTex);
  const wrongs = [`(${lin(s)})(${quad(s * a * b)})`, `(${lin(-s)})(${quad(s * a * b)})`, `(${lin(s)})(${quad(-2 * s * a * b)})`, `(${lin(s)})^{3}`];
  return {
    question: m(question),
    answer,
    steps: [
      `${s > 0 ? 'Sum' : 'Difference'} of cubes with $a = ${a === 1 ? '' : a}${x}$ and $b = ${b === 1 ? '' : b}${y}$`,
      s > 0 ? 'Use $a^{3} + b^{3} = (a + b)(a^{2} - ab + b^{2})$' : 'Use $a^{3} - b^{3} = (a - b)(a^{2} + ab + b^{2})$',
      `$= ${answerTex}$`,
    ],
    distractors: distinctDistractors(answer, wrongs.map(m), (k) => m(`(${lin(s)})(${quad(-s * a * b + offset(k))})`)),
    check: { kind: 'alg2-polynomials.factored', vars: [x, y] },
  };
}

export const factoringCubes: TopicGenerator = defineTopic({
  id: 'alg2.poly.factor-cubes',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Factoring Sums and Differences of Cubes',
  description: 'Factor a³ + b³ and a³ − b³, pulling out any common factor first.',
  instruction: FACTOR_INSTRUCTION,
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Type',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'sum', label: 'Sum of cubes' },
        { value: 'difference', label: 'Difference of cubes' },
      ],
    },
    { type: 'boolean', id: 'twoVars', label: 'Two variables', default: false },
    opt.variedVariables(true),
  ],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const type = strOpt(ctx, 'type');
    if (boolOpt(ctx, 'twoVars') && rng.bool(0.5)) return twoVarCubes(rng, difficulty, v === 'y' ? 'x' : v, type);
    return factorContent(buildCubes(rng, difficulty, v, type), v);
  },
});

export const factoringQuadraticForm: TopicGenerator = defineTopic({
  id: 'alg2.poly.factor-quadratic-form',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Factoring Quadratic Form',
  description: 'Factor polynomials such as x⁴ − 13x² + 36 by treating them as quadratics in x² (or x³).',
  instruction: FACTOR_INSTRUCTION,
  multipleChoice: true,
  defaultCount: 10,
  options: [opt.variedVariables(true)],
  generate(ctx) {
    const v = pickVar(ctx.rng, boolOpt(ctx, 'variedVars'));
    return factorContent(buildQuadForm(ctx.rng, ctx.difficulty, v), v);
  },
});

type AllKind = 'trinomial' | 'squares' | 'gcf' | 'grouping' | 'cubes' | 'quadform';

export const factoringAll: TopicGenerator = defineTopic({
  id: 'alg2.poly.factor-all',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Factoring All Techniques',
  description: 'Mixed factoring: greatest common factor first, then trinomials, squares, cubes, grouping and quadratic form.',
  instruction: FACTOR_INSTRUCTION,
  multipleChoice: true,
  defaultCount: 12,
  options: [opt.variedVariables(true)],
  generate(ctx) {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const kinds: AllKind[] =
      difficulty === 'easy' ? ['trinomial', 'squares', 'gcf'] : difficulty === 'medium' ? ['trinomial', 'squares', 'grouping', 'cubes', 'gcf'] : ['trinomial', 'squares', 'grouping', 'cubes', 'quadform'];
    const kind = rng.pick(kinds);
    const fp =
      kind === 'trinomial'
        ? buildTrinomial(rng, difficulty, v)
        : kind === 'squares'
          ? buildSquares(rng, difficulty, v)
          : kind === 'gcf'
            ? buildGcfOnly(rng, difficulty, v)
            : kind === 'grouping'
              ? buildGrouping(rng, difficulty, v)
              : kind === 'cubes'
                ? buildCubes(rng, difficulty, v, 'mixed')
                : buildQuadForm(rng, difficulty, v);
    return factorContent(fp, v);
  },
});

