/** Fractions, decimals and percents: simplifying, decimal arithmetic, converting between forms. */
import { Frac, gcd } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT, Dec } from './common';

const fracTex = (n: number, d: number) => `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`;

// ---------------------------------------------------------------- simplifying fractions

export const simplifyingFractions = defineTopic({
  id: 'prealg.simplify-fractions',
  subject: 'prealgebra',
  category: CAT.fractions,
  title: 'Simplifying Fractions',
  description: 'Reduce fractions to lowest terms by dividing out the greatest common factor.',
  instruction: (o) => (o.mixed ? 'Simplify each. Write improper fractions as mixed numbers.' : 'Simplify each fraction.'),
  multipleChoice: true,
  defaultCount: 16,
  options: [{ type: 'boolean', id: 'mixed', label: 'Write improper fractions as mixed numbers', default: false }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const mixed = boolOpt(ctx, 'mixed');
    const p = attempt('simplify-fractions', () => {
      const g = rng.int(2, difficulty === 'easy' ? 6 : difficulty === 'medium' ? 12 : 25);
      const den = rng.int(2, difficulty === 'easy' ? 9 : difficulty === 'medium' ? 12 : 15);
      const improper = difficulty === 'hard' ? rng.bool(0.5) : difficulty === 'medium' ? rng.bool(0.2) : false;
      const nu = improper ? rng.int(den + 1, den * 4) : rng.int(1, den - 1);
      if (gcd(nu, den) !== 1 || nu % den === 0) return null;
      if (nu * g > 300 || den * g > 300) return null;
      return { nu, den, g };
    });
    const { nu, den, g } = p;
    const N = nu * g;
    const D = den * g;
    const v = new Frac(nu, den);
    const show = (f: Frac) => (mixed ? f.toMixedTex() : f.toTex());
    const answer = m(show(v));
    // partly reduced (a common factor that is not the GCF), reciprocal, and a "cancel digits" slip
    const partFactor = [2, 3, 5, 7].find((q) => g % q === 0 && q !== g);
    const partly = partFactor ? fracTex(N / partFactor, D / partFactor) : null;
    const distractors = distinctDistractors(
      answer,
      [partly ? m(partly) : null, m(show(new Frac(den, nu))), m(show(new Frac(nu + 1, den))), m(show(new Frac(nu, den + 1)))],
      (k) => m(show(new Frac(nu + Math.abs(offset(k)) + 1, den))),
    );
    const steps = [`GCF of $${N}$ and $${D}$ is $${g}$.`, m(`\\frac{${N} \\div ${g}}{${D} \\div ${g}} = ${fracTex(nu, den)}`)];
    if (mixed && nu > den) steps.push(m(`= ${v.toMixedTex()}`));
    return { question: m(fracTex(N, D)), answer, steps, distractors, check: { kind: 'prealgebra.lowest', mixed } };
  },
});

// ---------------------------------------------------------------- decimal operations

type DOp = '+' | '-' | '\\times' | '\\div';

function randDec(rng: Rng, maxInt: number, places: number, negatives: boolean): Dec {
  const s = rng.int(1, places);
  let n = rng.int(1, maxInt * 10 ** s);
  if (n % 10 === 0) n += rng.int(1, 9);
  if (negatives && rng.bool(0.35)) n = -n;
  return new Dec(n, s);
}

const dTex = (x: Dec, first: boolean) => (x.sign < 0 && !first ? `(${x.toTex()})` : x.toTex());

export const decimalOperations = defineTopic({
  id: 'prealg.decimals',
  subject: 'prealgebra',
  category: CAT.fractions,
  title: 'Operations with Decimals',
  description: 'Add, subtract, multiply and divide decimals.',
  instruction: 'Evaluate each expression.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operations',
      default: 'any',
      choices: [
        { value: 'any', label: 'All four' },
        { value: 'addsub', label: 'Add and subtract' },
        { value: 'mul', label: 'Multiply' },
        { value: 'div', label: 'Divide' },
      ],
    },
    { type: 'boolean', id: 'negatives', label: 'Allow negative numbers', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const set = strOpt(ctx, 'operation');
    const ops: DOp[] = set === 'addsub' ? ['+', '-'] : set === 'mul' ? ['\\times'] : set === 'div' ? ['\\div'] : ['+', '-', '\\times', '\\div'];
    const op = rng.pick(ops);
    const p = attempt('decimals', () => {
      let a: Dec;
      let b: Dec;
      let v: Dec;
      if (op === '+' || op === '-') {
        const maxInt = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 60 : 200;
        const places = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
        a = randDec(rng, maxInt, places, negatives);
        b = randDec(rng, maxInt, places, negatives);
        if (difficulty !== 'easy' && a.s === b.s) return null;
        v = op === '+' ? a.add(b) : a.sub(b);
      } else if (op === '\\times') {
        if (difficulty === 'easy') {
          a = randDec(rng, 10, 1, negatives);
          b = new Dec(rng.int(2, 9) * (negatives && rng.bool(0.35) ? -1 : 1));
        } else {
          a = randDec(rng, difficulty === 'medium' ? 12 : 30, difficulty === 'medium' ? 1 : 2, negatives);
          b = randDec(rng, difficulty === 'medium' ? 9 : 12, difficulty === 'medium' ? 1 : 2, negatives);
        }
        v = a.mul(b);
      } else {
        // build from the quotient so it terminates
        const q = difficulty === 'easy' ? randDec(rng, 12, 1, negatives) : randDec(rng, 30, difficulty === 'medium' ? 1 : 2, negatives);
        b = difficulty === 'easy' ? new Dec(rng.int(2, 9)) : randDec(rng, difficulty === 'medium' ? 9 : 4, 1, negatives);
        if (difficulty === 'hard' && b.s === 0) return null;
        a = q.mul(b);
        v = q;
        if (a.s > 4) return null;
      }
      if (!negatives && v.sign < 0) return null;
      if (v.isZero() || Math.abs(b.value) === 1 || v.s > 5) return null;
      return { a, b, v };
    });
    const { a, b, v } = p;
    const question = `${dTex(a, true)} ${op} ${dTex(b, false)}`;
    const answer = m(v.toTex());
    const steps: string[] = [];
    if (op === '+' || op === '-') {
      const s = Math.max(a.s, b.s);
      const bt = b.toTex(s);
      steps.push(`Line up the decimal points: $${a.toTex(s)} ${op} ${b.sign < 0 ? `(${bt})` : bt}$`);
    } else if (op === '\\times') {
      steps.push(`Multiply without decimals: $${Math.abs(a.n)} \\times ${Math.abs(b.n)} = ${Math.abs(a.n * b.n)}$`);
      steps.push(`Count the decimal places: $${a.s} + ${b.s} = ${a.s + b.s}$`);
    } else if (b.s > 0) {
      const k = 10 ** b.s;
      steps.push(`Multiply both numbers by $${k}$: $${a.times10(b.s).toTex()} \\div ${dTex(b.times10(b.s), false)}$`);
    }
    steps.push(m(`= ${v.toTex()}`));
    const slips: Dec[] = [v.times10(1), v.times10(-1), v.neg()];
    if (op === '+' || op === '-') {
      // right-aligned digits instead of aligned decimal points
      const s = Math.max(a.s, b.s);
      slips.unshift(new Dec(op === '+' ? a.n + b.n : a.n - b.n, s));
    }
    const distractors = distinctDistractors(
      answer,
      slips.map((x) => (negatives || x.sign > 0 ? m(x.toTex()) : null)),
      (k) => m(v.add(new Dec(offset(k), Math.max(1, v.s))).toTex()),
    );
    return { question: m(question), answer, steps, distractors, check: { kind: 'value', value: v.value } };
  },
});

// ---------------------------------------------------------------- converting forms

type Form = 'fraction' | 'decimal' | 'percent';

/** Decimal expansion of n/d (n ≥ 0) with a repeating block marked by \overline. */
export function decimalTex(n: number, d: number): string {
  const whole = Math.floor(n / d);
  let r = n % d;
  if (r === 0) return String(whole);
  const digits: number[] = [];
  const seen = new Map<number, number>();
  while (r !== 0 && !seen.has(r)) {
    seen.set(r, digits.length);
    r *= 10;
    digits.push(Math.floor(r / d));
    r %= d;
  }
  if (r === 0) return `${whole}.${digits.join('')}`;
  const start = seen.get(r)!;
  return `${whole}.${digits.slice(0, start).join('')}\\overline{${digits.slice(start).join('')}}`;
}

function percentTex(v: Frac): string {
  return `${decimalTex(v.n * 100, v.d)}\\%`;
}

function fractionAnswer(v: Frac): string {
  return v.isInt() ? String(v.n) : v.toMixedTex();
}

function render(v: Frac, form: Form): string {
  return form === 'decimal' ? decimalTex(v.n, v.d) : form === 'percent' ? percentTex(v) : fractionAnswer(v);
}

const NAMES: Record<Form, string> = { fraction: 'a fraction in simplest form', decimal: 'a decimal', percent: 'a percent' };

function pickValue(rng: Rng, d: Difficulty, from: Form, to: Form): Frac {
  return attempt('fdp-value', () => {
    let den: number;
    let allowRepeat = false;
    if (d === 'easy') den = rng.pick([2, 4, 5, 10, 20, 25, 50, 100]);
    else if (d === 'medium') den = rng.pick([4, 8, 20, 25, 40, 50, 200, 1000]);
    else {
      allowRepeat = from === 'fraction' || to === 'fraction';
      den = rng.pick(allowRepeat ? [3, 6, 9, 11, 12, 15, 8, 16, 40] : [8, 16, 40, 200, 400, 1000]);
    }
    const whole = d === 'easy' ? 0 : rng.bool(d === 'hard' ? 0.35 : 0.2) ? rng.int(1, 3) : 0;
    const nu = rng.int(1, den - 1);
    if (gcd(nu, den) !== 1 && rng.bool(0.7)) return null;
    const v = new Frac(whole * den + nu, den);
    // decimals/percents with at most 4 digits after the point (or a short repeat)
    const tex = decimalTex(v.n, v.d);
    if (!allowRepeat && tex.includes('overline')) return null;
    if (tex.replace(/\\overline\{(\d+)\}/, '$1').split('.')[1]!.length > 4) return null;
    return v;
  });
}

const PAIRS: Record<string, [Form, Form]> = {
  f2d: ['fraction', 'decimal'],
  d2f: ['decimal', 'fraction'],
  f2p: ['fraction', 'percent'],
  p2f: ['percent', 'fraction'],
  d2p: ['decimal', 'percent'],
  p2d: ['percent', 'decimal'],
};

export const convertingFdp = defineTopic({
  id: 'prealg.fdp-convert',
  subject: 'prealgebra',
  category: CAT.fractions,
  title: 'Fractions, Decimals and Percents',
  description: 'Convert between fractions, decimals and percents, including repeating decimals.',
  instruction: 'Write each as indicated.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'conversion',
      label: 'Conversion',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'f2d', label: 'Fraction → decimal' },
        { value: 'd2f', label: 'Decimal → fraction' },
        { value: 'f2p', label: 'Fraction → percent' },
        { value: 'p2f', label: 'Percent → fraction' },
        { value: 'd2p', label: 'Decimal → percent' },
        { value: 'p2d', label: 'Percent → decimal' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const c = strOpt(ctx, 'conversion');
    const [from, to] = PAIRS[c === 'any' ? rng.pick(Object.keys(PAIRS)) : c]!;
    const v = pickValue(rng, difficulty, from, to);
    const given = from === 'fraction' ? (v.isInt() ? String(v.n) : v.toMixedTex()) : render(v, from);
    const answer = m(render(v, to));
    const steps: string[] = [];
    if (to === 'decimal' && from === 'fraction') steps.push(`Divide: $${v.n} \\div ${v.d} = ${render(v, 'decimal')}$`);
    if (to === 'percent') steps.push(from === 'decimal' ? 'Move the decimal point two places to the right.' : `Multiply by $100\\%$: $${render(v, 'decimal')} = ${render(v, 'percent')}$`);
    if (from === 'percent' && to === 'decimal') steps.push('Move the decimal point two places to the left.');
    if (to === 'fraction') {
      const dec = render(v, 'decimal');
      if (dec.includes('overline')) steps.push(`A repeating decimal: $${dec} = ${v.toTex()}$`);
      else {
        const places = (dec.split('.')[1] ?? '').length;
        const scale = from === 'percent' ? Math.max(100, 10 ** places) : 10 ** places;
        const top = Math.round(v.value * scale);
        steps.push(m(`${given} = \\frac{${top}}{${scale}}`));
      }
      steps.push(`Simplify: $${fractionAnswer(v)}$`);
    } else steps.push(m(`= ${render(v, to)}`));
    // slips: decimal point moved the wrong amount, unreduced fraction, digits copied from the fraction
    const cands: string[] = [];
    if (to === 'fraction') {
      cands.push(render(v.mul(new Frac(1, 10)), 'fraction'), render(v.mul(10), 'fraction'), render(v.inv(), 'fraction'));
      const dec = render(v, 'decimal');
      if (!dec.includes('overline') && !v.isInt()) {
        const places = (dec.split('.')[1] ?? '').length;
        cands.unshift(`\\frac{${Math.round(v.value * 10 ** places)}}{${10 ** places}}`);
      }
    } else {
      cands.push(render(v.mul(10), to), render(v.mul(new Frac(1, 10)), to), render(v.mul(100), to));
      if (from === 'fraction' && v.isInt() === false) cands.unshift(to === 'decimal' ? `${Math.floor(v.value)}.${v.n % v.d}${v.d}` : `${v.n % v.d}${v.d}\\%`);
    }
    const distractors = distinctDistractors(
      answer,
      cands.map((t) => m(t)),
      (k) => m(render(v.add(new Frac(Math.abs(offset(k)), 100)), to)),
    );
    return {
      question: `$${given}$ as ${NAMES[to]}`,
      answer,
      steps,
      distractors,
      check: { kind: 'prealgebra.convert', to },
    };
  },
});
