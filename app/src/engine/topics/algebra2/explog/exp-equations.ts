/** Exponential equations: common bases (no logs needed) and equations solved with logarithms. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { decimal, linear, m, num, term } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { CATEGORY, fr, isRationalLog, logOf, logOp, powTex, type Base } from './common';

// ------------------------------------------------------------ common bases

/** Largest power of each root used as a displayed base or constant. */
const MAXPOW: Record<number, number> = { 2: 7, 3: 5, 5: 4, 6: 3, 7: 3, 10: 4 };

/** c^(m·(p·x + q)); p = 0 means the constant c^m. */
interface Factor {
  m: number;
  p: number;
  q: number;
}

function factorTex(c: number, f: Factor, v: string): string {
  const big = c ** Math.abs(f.m);
  const baseT = f.m > 0 ? String(big) : `\\frac{1}{${big}}`;
  if (f.p === 0) return baseT;
  return powTex(baseT, linear(f.p, f.q, v));
}

function sideTex(c: number, fs: Factor[], v: string): string {
  return fs.map((f) => factorTex(c, f, v)).join(' \\cdot ');
}

/** Exponent of c contributed by a side: Σ m(px + q) as [coef of x, constant]. */
function sideExp(fs: Factor[]): [number, number] {
  return fs.reduce<[number, number]>(([a, b], f) => (f.p === 0 ? [a, b + f.m] : [a + f.m * f.p, b + f.m * f.q]), [0, 0]);
}

export const expEqCommonBase = defineTopic({
  id: 'alg2.explog.exp-eq-common-base',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Exponential Equations Not Requiring Logarithms',
  description: 'Solve exponential equations by rewriting both sides with a common base, e.g. 4^(2x) = 8^(x+1).',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    opt.fractionAnswers(false),
    { type: 'boolean', id: 'fracBases', label: 'Include fractional bases such as 1/4', default: true },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const fractions = boolOpt(ctx, 'fractions');
    const fracBases = boolOpt(ctx, 'fracBases');
    const p = attempt('exp-common', () => {
      const c = rng.pick(d === 'easy' ? [2, 3, 5, 2, 3, 6, 7, 10] : [2, 3, 5, 2, 3]);
      const maxPow = MAXPOW[c]!;
      const power = (allowNeg: boolean, lo = 1) => {
        const k = rng.int(lo, d === 'easy' ? Math.min(3, maxPow) : maxPow);
        return allowNeg && fracBases && rng.bool(0.3) ? -k : k;
      };
      const lin = (pMax: number) => ({ p: rng.signedInt(1, pMax, d !== 'easy'), q: rng.int(-5, 5) });
      let L: Factor[];
      let R: Factor[];
      const form = rng.pick(d === 'easy' ? ['const', 'const', 'same'] : d === 'medium' ? ['const', 'two', 'two'] : ['two', 'product', 'two']);
      if (form === 'const') {
        const m1 = d === 'easy' ? 1 : power(true);
        L = [{ m: m1, ...lin(d === 'easy' ? 3 : 4) }];
        R = [{ m: power(d !== 'easy', d === 'easy' ? 2 : 1), p: 0, q: 1 }];
      } else if (form === 'same') {
        L = [{ m: 1, ...lin(3) }];
        R = [{ m: 1, ...lin(3) }];
      } else if (form === 'two') {
        const m1 = power(true);
        let m2 = power(true);
        if (m2 === m1) m2 = -m2;
        L = [{ m: m1, ...lin(3) }];
        R = [{ m: m2, ...lin(3) }];
      } else {
        L = [
          { m: power(false), ...lin(3) },
          { m: power(true), ...lin(2) },
        ];
        R = rng.bool() ? [{ m: power(true), p: 0, q: 1 }] : [{ m: power(true), ...lin(3) }];
      }
      // displayed bases must stay readable
      if ([...L, ...R].some((f) => Math.abs(f.m) > maxPow || f.m === 0)) return null;
      if (L.length === 2 && L[0]!.m === L[1]!.m) return null;
      const [la, lb] = sideExp(L);
      const [ra, rb] = sideExp(R);
      const A = la - ra;
      const B = rb - lb;
      if (A === 0) return null;
      const x = new Frac(B, A);
      if (!fractions && !x.isInt()) return null;
      if (fractions && x.isInt() && rng.bool(0.6)) return null;
      if (Math.abs(x.value) > 15) return null;
      return { c, L, R, la, lb, ra, rb, x };
    });
    const { c, L, R, la, lb, ra, rb, x } = p;
    const eq = `${sideTex(c, L, v)} = ${sideTex(c, R, v)}`;
    const asC = (fs: Factor[]) =>
      fs.map((f) => (f.p === 0 ? (f.m === 1 ? String(c) : `${c}^{${f.m}}`) : `${c}^{${f.m === 1 ? linear(f.p, f.q, v) : `${f.m === -1 ? '-' : f.m}(${linear(f.p, f.q, v)})`}}`)).join(' \\cdot ');
    const steps = [
      `Write both sides as powers of ${m(String(c))}: ${m(`${asC(L)} = ${asC(R)}`)}`,
      `Simplify the exponents: ${m(`${c}^{${linear(la, lb, v)}} = ${c}^{${linear(ra, rb, v)}}`.replace(`${c}^{1}`, String(c)))}`,
      `Set the exponents equal: ${m(`${linear(la, lb, v)} = ${linear(ra, rb, v)}`)}`,
      `${m(`${term(la - ra, v)} = ${rb - lb}`)}, so ${m(`${v} = ${num(x)}`)}`,
    ];
    const answer = m(`${v} = ${num(x)}`);
    // mistake: equate the shown exponents without converting the bases
    const naive = (() => {
      const e1 = L[0]!;
      const e2 = R[0]!;
      const a = e1.p - e2.p;
      const b = (e2.p === 0 ? new Frac(c).pow(e2.m) : new Frac(e2.q)).sub(e1.q);
      return a === 0 ? null : b.div(a);
    })();
    const wrong = (f: Frac | null) => (f && (fractions || f.isInt()) ? m(`${v} = ${num(f)}`) : null);
    const distractors = distinctDistractors(
      answer,
      [wrong(naive), wrong(x.neg()), wrong(new Frac(rb + lb, la - ra)), wrong(new Frac(rb - lb, la + ra || 1))],
      (k) => wrong(x.add(offset(k))),
    );
    return { question: m(eq), answer, steps, distractors, check: { kind: 'roots', variable: v, solutions: [x.value] } };
  },
});

// ------------------------------------------------------------ requiring logarithms

type Form = 'round' | 'exact' | 'both';

/** One candidate solution x = (log_b R − q)/p, or the two-base x = q·ln b2 / (ln b1 − ln b2). */
type Sol =
  | { kind: 'one'; b: Base; R: Frac; p: number; q: number }
  | { kind: 'two'; b1: number; b2: number; num: number; numBase: number | null };

function solValue(s: Sol): number {
  if (s.kind === 'two') return (s.num * (s.numBase === null ? 1 : Math.log(s.numBase))) / (Math.log(s.b1) - Math.log(s.b2));
  const lb = s.b === 'e' ? 1 : Math.log(s.b.value);
  return (Math.log(s.R.value) / lb - s.q) / s.p;
}

function solExact(s: Sol): string {
  if (s.kind === 'two') return `\\frac{${s.numBase === null ? s.num : term(s.num, `\\ln ${s.numBase}`)}}{\\ln ${s.b1} - \\ln ${s.b2}}`;
  const L = logOf(s.b, s.R.toTex());
  const { p, q } = s;
  let numer: string;
  if (p > 0) numer = q === 0 ? L : `${L} ${q > 0 ? '-' : '+'} ${Math.abs(q)}`;
  else numer = q === 0 ? `-${L}` : `${q} - ${L}`;
  const den = Math.abs(p);
  if (den === 1) return numer;
  if (p < 0 && q === 0) return `-\\frac{${L}}{${den}}`;
  return `\\frac{${numer}}{${den}}`;
}

function render(s: Sol, v: string, form: Form): string {
  const x = solValue(s);
  if (form === 'exact') return m(`${v} = ${solExact(s)}`);
  if (form === 'round') return m(`${v} \\approx ${decimal(x, 3)}`);
  return m(`${v} = ${solExact(s)} \\approx ${decimal(x, 3)}`);
}

function coefTimes(a: number, core: string): string {
  if (a === 1) return core;
  if (a === -1) return `-${core}`;
  return `${a} \\cdot ${core}`;
}

export const expEqLogs = defineTopic({
  id: 'alg2.explog.exp-eq-logs',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Exponential Equations Requiring Logarithms',
  description: 'Isolate the power and take a logarithm of both sides, e.g. 3·5^x − 2 = 40.',
  instruction: (o) =>
    o.answerForm === 'exact'
      ? 'Solve each equation. Give exact answers.'
      : o.answerForm === 'both'
        ? 'Solve each equation. Give the exact answer and round to the nearest thousandth.'
        : 'Solve each equation. Round your answers to the nearest thousandth.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'answerForm',
      label: 'Answer form',
      default: 'round',
      choices: [
        { value: 'round', label: 'Rounded to the nearest thousandth' },
        { value: 'exact', label: 'Exact (in terms of logarithms)' },
        { value: 'both', label: 'Exact and rounded' },
      ],
    },
    { type: 'boolean', id: 'natural', label: 'Include base e (natural logarithms)', default: true },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const form = (strOpt(ctx, 'answerForm') || 'round') as Form;
    const natural = boolOpt(ctx, 'natural');
    const kind = d === 'hard' && rng.bool(0.35) ? 'two' : 'one';
    if (kind === 'two') return twoBase(rng, v, form);
    const p = attempt('exp-log', () => {
      const bases: Base[] = [fr(2), fr(3), fr(4), fr(5), fr(6), fr(7), fr(8)];
      if (d !== 'easy') bases.push(fr(10));
      if (natural && d !== 'easy') bases.push('e', 'e');
      const b = rng.pick(bases);
      let a = 1;
      let c = 0;
      let pc = 1;
      let q = 0;
      if (d === 'easy') {
        if (rng.bool()) q = rng.signedInt(1, 4, true);
        if (rng.bool(0.3)) a = rng.int(2, 5);
      } else {
        a = rng.pick([1, 2, 3, 4, 5, -2, -3]);
        c = rng.signedInt(1, 20, true);
        pc = d === 'medium' ? rng.pick([1, 1, 2, 3]) : rng.pick([2, 3, 4, -1, -2]);
        q = rng.int(-4, 4);
      }
      // a·b^(px+q) + c = rhs, with R = (rhs − c)/a
      const R = d === 'hard' && rng.bool(0.4) ? new Frac(rng.int(2, 40), rng.int(2, 9)) : new Frac(rng.int(2, d === 'easy' ? 60 : 90));
      const rhs = R.mul(a).add(c);
      if (!rhs.isInt() || rhs.isZero()) return null;
      if (isRationalLog(R.value, b === 'e' ? Math.E : b.value)) return null;
      if (b === 'e' && R.value < 1.5) return null;
      return { b, a, c, pc, q, R, rhs: rhs.value };
    });
    const { b, a, c, pc, q, R, rhs } = p;
    const power = powTex(b, linear(pc, q, v));
    const lhs = c === 0 ? coefTimes(a, power) : `${coefTimes(a, power)} ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
    const question = m(`${lhs} = ${rhs}`);
    const sol: Sol = { kind: 'one', b, R, p: pc, q };
    const x = solValue(sol);
    const steps: string[] = [];
    if (c !== 0) steps.push(m(`${coefTimes(a, power)} = ${rhs - c}`));
    if (a !== 1) steps.push(`Divide by ${m(String(a))}: ${m(`${power} = ${R.toTex()}`)}`);
    steps.push(`Take ${b === 'e' ? 'the natural log' : m(logOp(b))} of both sides: ${m(`${linear(pc, q, v)} = ${logOf(b, R.toTex())}`)}`);
    steps.push(`${m(`${v} = ${solExact(sol)}`)}${b !== 'e' && !(b as Frac).eq(10) ? ` (change of base: ${m(`${logOf(b, R.toTex())} = \\frac{\\ln ${R.toTex()}}{\\ln ${(b as Frac).toTex()}}`)})` : ''}`);
    steps.push(m(`${v} \\approx ${decimal(x, 3)}`));
    const answer = render(sol, v, form);
    // mistakes: ignore a and c; subtract after dividing wrongly; forget the change of base
    const variants: Sol[] = [];
    const rhsF = new Frac(rhs);
    if (rhs > 0 && (a !== 1 || c !== 0)) variants.push({ ...sol, R: rhsF });
    const r2 = rhsF.div(a).sub(c);
    if (r2.sign > 0 && c !== 0) variants.push({ ...sol, R: r2 });
    if (q !== 0) variants.push({ ...sol, q: -q });
    if (pc !== 1) variants.push({ ...sol, p: 1, q: q });
    variants.push({ ...sol, b: b === 'e' ? fr(10) : 'e' });
    const distractors = distinctDistractors(
      answer,
      variants.map((s) => (Math.abs(solValue(s) - x) > 0.002 ? render(s, v, form) : null)),
      (k) => render({ ...sol, R: R.add(k) }, v, form),
    );
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-explog.solve', variable: v, solutions: [x], places: 3 },
    };
  },
});

function twoBase(rng: Rng, v: string, form: Form): ProblemContent {
  const pairs: Array<[number, number]> = [
    [2, 3], [3, 2], [2, 5], [5, 2], [3, 5], [5, 3], [3, 7], [7, 3], [2, 7], [7, 2], [5, 7], [7, 5], [6, 5], [5, 6],
  ];
  const [b1, b2] = rng.pick(pairs);
  const q = rng.signedInt(1, 4, true);
  // b1^x = b2^(x + q)
  const sol: Sol = { kind: 'two', b1, b2, num: q, numBase: b2 };
  const x = solValue(sol);
  const question = m(`${b1}^{${v}} = ${b2}^{${linear(1, q, v)}}`);
  const steps = [
    `Take ${m('\\ln')} of both sides: ${m(`${v}\\ln ${b1} = (${linear(1, q, v)})\\ln ${b2}`)}`,
    m(`${v}\\ln ${b1} - ${v}\\ln ${b2} = ${term(q, `\\ln ${b2}`)}`),
    m(`${v}(\\ln ${b1} - \\ln ${b2}) = ${term(q, `\\ln ${b2}`)}`),
    m(`${v} = ${solExact(sol)} \\approx ${decimal(x, 3)}`),
  ];
  const answer = render(sol, v, form);
  const variants: Sol[] = [
    { kind: 'two', b1, b2, num: q, numBase: b1 },
    { kind: 'two', b1, b2, num: -q, numBase: b2 },
    { kind: 'two', b1, b2, num: q, numBase: null },
  ];
  const distractors = distinctDistractors(
    answer,
    variants.map((s) => render(s, v, form)),
    (k) => render({ ...sol, num: q + offset(k) || q + 7 }, v, form),
  );
  return { question, answer, steps, distractors, check: { kind: 'alg2-explog.solve', variable: v, solutions: [x], places: 3 } };
}
