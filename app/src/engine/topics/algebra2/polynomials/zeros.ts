/** Writing polynomial functions from their zeros, and the Conjugate Root Theorem. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num, tuple } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, type Cx, divMod, factoredTex, makePair, type Pair, type PairKind, rootFactor } from './common';
import { factorContent } from './factoring';

const bounded = (p: Poly, max: number) => p.c.every((c) => Math.abs(c.value) <= max);

const WRITE_INSTRUCTION = 'Write a polynomial function of least degree with integer coefficients that has the given zeros.';

interface Zero {
  r: Frac;
  e: number;
}

function zerosText(items: Array<{ tex: string; e: number }>): string {
  return `Zeros: ${items.map((z) => `$${z.tex}$${z.e > 1 ? ` (multiplicity ${z.e})` : ''}`).join(', ')}`;
}

function fromZeros(zs: readonly Zero[]): Poly {
  return zs.reduce((p, z) => p.mul(rootFactor(z.r).powInt(z.e)), Poly.of(1));
}

function perturbConst(p: Poly, k: number): Poly {
  return p.add(Poly.of(offset(k) * (k > 4 ? 3 : 1)));
}

export const writingFromZeros = defineTopic({
  id: 'alg2.poly.write-from-zeros',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Writing Polynomial Functions',
  description: 'Write the polynomial of least degree with given integer or rational zeros, optionally with a leading coefficient or a point.',
  instruction: WRITE_INSTRUCTION,
  multipleChoice: true,
  defaultCount: 10,
  options: [
    { type: 'boolean', id: 'fractions', label: 'Include fractional zeros', default: false },
    { type: 'boolean', id: 'multiplicity', label: 'Include repeated zeros (multiplicity)', default: false },
    {
      type: 'select',
      id: 'condition',
      label: 'Extra condition',
      default: 'none',
      choices: [
        { value: 'none', label: 'None' },
        { value: 'lead', label: 'Given leading coefficient' },
        { value: 'point', label: 'Passes through a point' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const condOpt = strOpt(ctx, 'condition');
    const cond = condOpt === 'mixed' ? rng.pick(['none', 'lead', 'point']) : condOpt;
    const built = attempt('write-zeros', () => {
      const count = difficulty === 'easy' ? rng.int(2, 3) : difficulty === 'medium' ? 3 : rng.int(3, 4);
      const zs: Zero[] = [];
      const fracProb = boolOpt(ctx, 'fractions') ? (difficulty === 'easy' ? 0.35 : 0.6) : 0;
      for (let i = 0; i < count; i++) {
        let r: Frac;
        if (i === 0 && rng.bool(fracProb)) {
          const d = rng.int(2, 3);
          r = new Frac(rng.signedInt(1, 3 * d, true), d);
          if (r.isInt()) return null;
        } else r = new Frac(rng.int(-5, 5));
        if (zs.some((z) => z.r.eq(r))) return null;
        zs.push({ r, e: 1 });
      }
      if (boolOpt(ctx, 'multiplicity') && rng.bool(0.7)) rng.pick(zs).e = difficulty === 'hard' && rng.bool(0.3) ? 3 : 2;
      const deg = zs.reduce((s, z) => s + z.e, 0);
      if (deg > 5) return null;
      const P = fromZeros(zs);
      const t = cond === 'none' ? 1 : rng.signedInt(1, 3, true);
      if (cond !== 'none' && t === 1 && rng.bool(0.7)) return null;
      const f = P.scale(t);
      if (!bounded(f, 300)) return null;
      let point: [number, number] | null = null;
      if (cond === 'point') {
        const x0 = rng.int(-3, 3);
        const y0 = f.eval(x0);
        if (y0.isZero() || Math.abs(y0.value) > 300) return null;
        point = [x0, y0.value];
      }
      return { zs: rng.shuffle(zs), P, t, f, point };
    });
    const { zs, P, t, f, point } = built;
    let question = zerosText(zs.map((z) => ({ tex: num(z.r), e: z.e })));
    if (cond === 'lead') question += `; leading coefficient $${f.lead().toTex()}$`;
    if (point) question += `; passes through $${tuple(point)}$`;
    const factorsTex = factoredTex({ k: 1, mono: 0, factors: zs.map((z) => ({ p: rootFactor(z.r), e: z.e })) }, 'x');
    const steps: string[] = [`Each zero $r$ gives a factor: $${factorsTex}$`];
    if (cond === 'lead') steps.push(`Scale so the leading coefficient is $${f.lead().toTex()}$: multiply by $${t}$.`);
    if (point) steps.push(`$f(x) = a${factorsTex}$; $f(${point[0]}) = ${point[1]}$ gives $a = ${t}$.`);
    steps.push(`Multiply out: $f(x) = ${f.toTex('x')}$`);
    const answer = m(`f(x) = ${f.toTex('x')}`);
    const neg = fromZeros(zs.map((z) => ({ r: z.r.neg(), e: z.e }))).scale(t);
    const noMult = fromZeros(zs.map((z) => ({ r: z.r, e: 1 }))).scale(t);
    const constFlip = new Poly(f.c.map((c, i) => (i === 0 ? c.neg() : c)));
    const wrongs = [neg, t !== 1 ? P : constFlip, noMult.eq(f) ? constFlip : noMult, new Poly(f.c.map((c, i) => (i % 2 === 1 ? c.neg() : c))).scale(-1)];
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        wrongs.map((w) => m(`f(x) = ${w.toTex('x')}`)),
        (k) => m(`f(x) = ${perturbConst(f, k).toTex('x')}`),
      ),
      check: { kind: 'alg2-polynomials.zeros', condition: cond },
    };
  },
});

function pairKind(rng: Rng, opt: string): PairKind {
  return opt === 'mixed' ? (rng.bool() ? 'irrational' : 'complex') : (opt as PairKind);
}

const KIND_OPTION = {
  type: 'select' as const,
  id: 'kind',
  label: 'Kind of zero',
  default: 'mixed',
  choices: [
    { value: 'mixed', label: 'Mixed' },
    { value: 'irrational', label: 'Irrational (a ± √b)' },
    { value: 'complex', label: 'Imaginary (a ± bi)' },
  ],
};

export const conjugateWriting = defineTopic({
  id: 'alg2.poly.conjugate-write',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Conjugate Roots: Writing Functions',
  description: 'Use the Conjugate Root Theorem to write a polynomial with integer coefficients from zeros such as a ± √b or a ± bi.',
  instruction: WRITE_INSTRUCTION,
  multipleChoice: true,
  defaultCount: 10,
  options: [KIND_OPTION, { type: 'boolean', id: 'showConjugates', label: 'List both conjugates', default: false }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kindOpt = strOpt(ctx, 'kind');
    const built = attempt('conjugate-write', () => {
      const twoPairs = difficulty === 'hard' && rng.bool(0.5);
      const pairs: Pair[] = [makePair(rng, pairKind(rng, kindOpt), difficulty)];
      if (twoPairs) {
        const k2: PairKind = kindOpt === 'mixed' ? (pairs[0]!.kind === 'complex' ? 'irrational' : 'complex') : (kindOpt as PairKind);
        const p2 = makePair(rng, k2, difficulty);
        if (p2.quad.eq(pairs[0]!.quad)) return null;
        pairs.push(p2);
      }
      const nInts = twoPairs ? rng.int(0, 1) : difficulty === 'easy' ? rng.int(0, 1) : difficulty === 'medium' ? rng.int(1, 2) : 2;
      const ints: number[] = [];
      for (let i = 0; i < nInts; i++) {
        const r = rng.int(-5, 5);
        if (ints.includes(r)) return null;
        ints.push(r);
      }
      const f = pairs.reduce((p, q) => p.mul(q.quad), Poly.fromRoots(ints));
      if (!bounded(f, 400)) return null;
      return { pairs, ints, f };
    });
    const { pairs, ints, f } = built;
    const show = boolOpt(ctx, 'showConjugates');
    const items = [...ints.map((r) => ({ tex: String(r), e: 1 })), ...pairs.flatMap((p) => (show ? p.tex : [p.tex[rng.int(0, 1)]!]).map((tex) => ({ tex, e: 1 })))];
    const question = zerosText(items);
    const steps = [
      ...pairs.map((p) => `By the Conjugate Root Theorem, $${p.tex[0]}$ and $${p.tex[1]}$ are both zeros: $(x - (${p.tex[0]}))(x - (${p.tex[1]})) = ${p.quad.toTex('x')}$`),
      `$f(x) = ${factoredTex({ k: 1, mono: 0, factors: [...ints.map((r) => ({ p: Poly.linear(1, -r), e: 1 })), ...pairs.map((p) => ({ p: p.quad, e: 1 }))] }, 'x')}$`,
      `Multiply out: $f(x) = ${f.toTex('x')}$`,
    ];
    const answer = m(`f(x) = ${f.toTex('x')}`);
    const swapMid = (q: Poly) => new Poly(q.c.map((c, i) => (i === 1 ? c.neg() : c)));
    const otherConst = (q: Poly) => {
      // a² + b²c ↔ a² − b²c
      const a = q.coef(1).value / -2;
      return Poly.of(2 * a * a - q.coef(0).value, q.coef(1), 1);
    };
    const rest = Poly.fromRoots(ints);
    const others = pairs.slice(1).reduce((p, q) => p.mul(q.quad), Poly.of(1));
    const wrongs = [
      rest.mul(swapMid(pairs[0]!.quad)).mul(others),
      rest.mul(otherConst(pairs[0]!.quad)).mul(others),
      ints.length ? Poly.fromRoots(ints.map((r) => -r)).mul(pairs[0]!.quad).mul(others) : f.add(Poly.of(0, 2)),
    ];
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        wrongs.map((w) => m(`f(x) = ${w.toTex('x')}`)),
        (k) => m(`f(x) = ${perturbConst(f, k).toTex('x')}`),
      ),
      check: { kind: 'alg2-polynomials.zeros', condition: 'none' },
    };
  },
});

interface ConjBuilt {
  pair: Pair;
  linear: Frac[];
  second: Pair | null;
  f: Poly;
  given: string;
}

function buildConjugate(rng: Rng, d: Difficulty, kindOpt: string): ConjBuilt {
  return attempt('conjugate-factor', () => {
    const pair = makePair(rng, pairKind(rng, kindOpt), d);
    let second: Pair | null = null;
    const linear: Frac[] = [];
    if (d === 'hard' && rng.bool(0.4)) {
      second = makePair(rng, pairKind(rng, kindOpt), 'medium');
      if (second.quad.eq(pair.quad)) return null;
    } else {
      const n = d === 'hard' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const r = d !== 'easy' && i === 0 && rng.bool(0.35) ? new Frac(rng.signedInt(1, 5, true), rng.int(2, 3)) : new Frac(rng.signedInt(1, 5, true));
        if (linear.some((x) => x.eq(r))) return null;
        linear.push(r);
      }
    }
    const f = linear.reduce((p, r) => p.mul(rootFactor(r)), second ? pair.quad.mul(second.quad) : pair.quad);
    if (!bounded(f, 300)) return null;
    return { pair, linear, second, f, given: pair.tex[rng.int(0, 1)]! };
  });
}

export const conjugateFactoring = defineTopic({
  id: 'alg2.poly.conjugate-factor',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Conjugate Roots: Factoring',
  description: 'Given one irrational or imaginary zero, use its conjugate to factor completely or find all zeros.',
  instruction: (o) =>
    o.task === 'factor' ? 'Factor each polynomial completely over the integers, using the given zero.' : o.task === 'zeros' ? 'Find all zeros of each function, using the given zero.' : 'Use the given zero and its conjugate.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Task',
      default: 'zeros',
      choices: [
        { value: 'zeros', label: 'Find all zeros' },
        { value: 'factor', label: 'Factor completely' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
    KIND_OPTION,
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const taskOpt = strOpt(ctx, 'task');
    const task = taskOpt === 'mixed' ? rng.pick(['zeros', 'factor']) : taskOpt;
    const { pair, linear, second, f, given } = buildConjugate(rng, difficulty, strOpt(ctx, 'kind'));
    const fTex = f.toTex('x');
    const pairs = second ? [pair, second] : [pair];
    const lin = linear.map((r) => ({ p: rootFactor(r), e: 1 }));
    const factored = { k: 1, mono: 0, factors: [...lin, ...pairs.map((p) => ({ p: p.quad, e: 1 }))] };
    const steps = [
      `The conjugate $${pair.tex[0] === given ? pair.tex[1] : pair.tex[0]}$ is also a zero, so $${pair.quad.toTex('x')}$ is a factor.`,
      `Divide: $${fTex} = (${pair.quad.toTex('x')})(${divMod(f, pair.quad).q.toTex('x')})$`,
    ];
    const lead = task === 'factor' ? 'factor $f(x)$ completely over the integers.' : 'find all zeros.';
    const question = `Given that $${given}$ is a zero of $f(x) = ${fTex}$, ${lead}`;
    if (task === 'factor') {
      steps.push(`$f(x) = ${factoredTex(factored, 'x')}$`);
      const swapMid = (q: Poly) => new Poly(q.c.map((c, i) => (i === 1 ? c.neg() : c)));
      const base = factorContent(
        {
          answer: factored,
          steps,
          wrongs: [
            { k: 1, mono: 0, factors: [...linear.map((r) => ({ p: rootFactor(r.neg()), e: 1 })), ...pairs.map((p) => ({ p: p.quad, e: 1 }))] },
            { k: 1, mono: 0, factors: [...lin, { p: swapMid(pair.quad), e: 1 }, ...(second ? [{ p: second.quad, e: 1 }] : [])] },
            { k: 1, mono: 0, factors: [...linear.map((r) => ({ p: rootFactor(r.neg()), e: 1 })), { p: swapMid(pair.quad), e: 1 }, ...(second ? [{ p: second.quad, e: 1 }] : [])] },
          ],
        },
        'x',
      );
      return { ...base, question };
    }
    const rational = [...linear].sort((a, b) => a.cmp(b));
    const zeroTex = [...rational.map((r) => num(r)), ...pairs.flatMap((p) => p.tex)];
    const values: Cx[] = [...rational.map((r) => ({ re: r.value, im: 0 })), ...pairs.flatMap((p) => p.values)];
    steps.push(`Zeros: $${zeroTex.join(', ')}$`);
    const answer = m(`x = ${zeroTex.join(', ')}`);
    const negPair = (p: Pair) => p.tex.map((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`).replace(/ \+ /, ' @ ').replace(/ - /, ' + ').replace(/ @ /, ' - '));
    const wrongs = [
      [...rational.map((r) => r.neg()).sort((a, b) => a.cmp(b)).map((r) => num(r)), ...pairs.flatMap((p) => p.tex)],
      pair.quad.coef(1).isZero() ? null : [...rational.map((r) => num(r)), ...negPair(pair), ...(second ? second.tex : [])],
      [...rational.map((r) => num(r)), given, ...(second ? second.tex : [])],
    ];
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        wrongs.map((w) => (w ? m(`x = ${w.join(', ')}`) : null)),
        (k) => m(`x = ${[...rational.map((r, i) => num(i === 0 ? r.add(offset(k)) : r)), ...pairs.flatMap((p) => p.tex)].join(', ')}`),
      ),
      check: { kind: 'roots', variable: 'x', equation: `${fTex} = 0`, solutions: values },
    };
  },
});
