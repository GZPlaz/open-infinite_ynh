/** Pre-Algebra verifiers: recompute every answer from the rendered question text. */
import { expect } from 'vitest';
import type { Verifier } from '../verify';
import { close, evalReal, mathSegments, onlyMath } from '../evaluator';

/** Strip money signs, digit-group commas, percent signs and \text{…}. */
function clean(tex: string): string {
  return tex
    .replace(/\\\$/g, '')
    .replace(/\{,\}/g, '')
    .replace(/\\%/g, '')
    .replace(/\\text\{[^}]*\}/g, '')
    .trim();
}

/** Numeric value of a rendered quantity: `\$1{,}200.50`, `12.5\%` (→ 12.5), `0.1\overline{6}`. */
function qty(tex: string, opts: { mixed?: boolean } = {}): number {
  let t = clean(tex);
  t = repeating(t);
  return evalReal(t, opts);
}

/** Replace a repeating decimal `a.b\overline{c}` by an exact fraction expression. */
function repeating(t: string): string {
  return t.replace(/(\d*)\.(\d*)\\overline\{(\d+)\}/g, (_, i: string, nr: string, r: string) => {
    // x = i.nr(r)(r)… = (i nr r − i nr) / (10^|nr| (10^|r| − 1))
    const whole = BigInt(`${i || '0'}${nr}${r}`) - BigInt(`${i || '0'}${nr}`);
    const den = 10 ** nr.length * (10 ** r.length - 1);
    return `(${whole.toString()}/${den})`;
  });
}


function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function isPrime(n: number): boolean {
  if (n < 2 || !Number.isInteger(n)) return false;
  for (let f = 2; f * f <= n; f++) if (n % f === 0) return false;
  return true;
}

/** Text with every math segment replaced by @0, @1, … (and the segments). */
function skeleton(rich: string): { text: string; segs: string[] } {
  const segs = mathSegments(rich);
  let i = 0;
  const text = rich.replace(/(?<!\\)\$([^$]+)\$/g, () => `@${i++}`);
  return { text, segs };
}

function near(a: number, b: number, tol: number, what: string): void {
  expect(Math.abs(a - b) <= tol + 1e-9 * Math.max(1, Math.abs(b)), `${what}: got ${a}, want ${b}`).toBe(true);
}

export const VERIFIERS: Record<string, Verifier> = {
  /** `$expr$; use $x = 4$ and $y = -2$` */
  'prealgebra.evaluate'(p) {
    const segs = mathSegments(p.question);
    const vars: Record<string, number> = {};
    for (const s of segs.slice(1)) {
      const [v, val] = s.split('=').map((x) => x.trim());
      vars[v!] = evalReal(val!);
    }
    const want = evalReal(segs[0]!, { vars });
    expect(close(evalReal(onlyMath(p.answer)), want), `${p.question} → ${p.answer}`).toBe(true);
  },

  /** Product of primes equal to the question's number, in the requested form. */
  'prealgebra.primeFactors'(p) {
    const n = qty(onlyMath(p.question));
    const items = onlyMath(p.answer).split('\\cdot').map((t) => t.trim());
    let prod = 1;
    const bases: number[] = [];
    for (const it of items) {
      const mm = /^(\d+)(?:\^\{(\d+)\})?$/.exec(it);
      expect(mm, `factor ${it}`).not.toBeNull();
      const b = Number(mm![1]);
      const k = mm![2] ? Number(mm![2]) : 1;
      expect(isPrime(b), `${b} is prime in ${p.answer}`).toBe(true);
      if (p.check!.form === 'expanded') expect(mm![2], 'no exponents in expanded form').toBeUndefined();
      else expect(bases.includes(b), `${b} repeated in exponent form`).toBe(false);
      bases.push(b);
      prod *= b ** k;
    }
    expect(prod, `${p.question} → ${p.answer}`).toBe(n);
  },

  /** Exactly the numbers among 2, 3, 4, 5, 6, 9, 10 that divide n. */
  'prealgebra.divisibility'(p) {
    const n = qty(onlyMath(p.question));
    const want = [2, 3, 4, 5, 6, 9, 10].filter((k) => n % k === 0);
    const got = /none/i.test(p.answer) ? [] : onlyMath(p.answer).split(',').map((t) => Number(t.trim()));
    expect(got, `${n} → ${p.answer}`).toEqual(want);
  },

  /** GCF / LCM of integers or monomials. */
  'prealgebra.gcfLcm'(p) {
    const task = /LCM/.test(p.question) ? 'lcm' : /GCF/.test(p.question) ? 'gcf' : (p.check!.task as string);
    const parse = (t: string) => {
      const mm = /^(\d*)((?:[a-z](?:\^\{\d+\})?)*)$/.exec(t.trim());
      expect(mm, `monomial ${t}`).not.toBeNull();
      const e: Record<string, number> = {};
      for (const v of mm![2]!.matchAll(/([a-z])(?:\^\{(\d+)\})?/g)) e[v[1]!] = (e[v[1]!] ?? 0) + (v[2] ? Number(v[2]) : 1);
      return { c: mm![1] ? Number(mm![1]) : 1, e };
    };
    const ms = onlyMath(p.question).split(',').map(parse);
    const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
    const c = ms.map((x) => x.c).reduce(task === 'gcf' ? gcd : lcm);
    const vars = [...new Set(ms.flatMap((x) => Object.keys(x.e)))];
    const want: Record<string, number> = {};
    for (const v of vars) {
      const es = ms.map((x) => x.e[v] ?? 0);
      const k = task === 'gcf' ? Math.min(...es) : Math.max(...es);
      if (k > 0) want[v] = k;
    }
    const got = parse(onlyMath(p.answer));
    expect(got.c, `${p.question} → ${p.answer}`).toBe(c);
    expect(got.e, `${p.question} → ${p.answer}`).toEqual(want);
  },

  /** Same value as the question, written as a fraction in lowest terms (mixed when asked). */
  'prealgebra.lowest'(p) {
    const mixed = p.check!.mixed === true;
    const q = qty(onlyMath(p.question));
    const a = onlyMath(p.answer);
    expect(close(qty(a, { mixed: true }), q), `${p.question} → ${p.answer}`).toBe(true);
    expectSimplest(a, mixed);
  },

  /** Conversions between fractions, decimals and percents. */
  'prealgebra.convert'(p) {
    const to = p.check!.to as string;
    const q = pctValue(mathSegments(p.question)[0]!);
    const a = onlyMath(p.answer);
    expect(close(pctValue(a), q), `${p.question} → ${p.answer}`).toBe(true);
    if (to === 'percent') expect(a.endsWith('\\%'), a).toBe(true);
    else expect(a.includes('\\%'), a).toBe(false);
    if (to === 'decimal') expect(/^\d+(\.\d*(\\overline\{\d+\})?)?$/.test(a), `decimal form: ${a}`).toBe(true);
    if (to === 'fraction') expectSimplest(a, true);
  },

  /** "… $12$ red marbles and $18$ blue marbles. Write the ratio of X to Y in simplest form." */
  'prealgebra.ratio'(p) {
    const { text, segs } = skeleton(p.question);
    const mm = /@(\d+) ([a-z ]+?) and @(\d+) ([a-z ]+?)\./.exec(text)!;
    const count: Record<string, number> = { [mm[2]!]: qty(segs[Number(mm[1])]!), [mm[4]!]: qty(segs[Number(mm[3])]!) };
    const r = /ratio of (.+?) to (.+?) in simplest form/.exec(text)!;
    const val = (name: string) => (name.startsWith('the total number of') ? Object.values(count).reduce((a, b) => a + b, 0) : count[name]!);
    const [x, y] = [val(r[1]!), val(r[2]!)];
    expect(x !== undefined && y !== undefined, text).toBe(true);
    const [a, b] = onlyMath(p.answer).split(':').map((t) => Number(t.trim()));
    expect(a! * y, `${p.question} → ${p.answer}`).toBe(b! * x);
    expect(gcd(a!, b!), `simplest form ${p.answer}`).toBe(1);
  },

  /** Unit rate = (money, or the first quantity) ÷ (the other quantity). */
  'prealgebra.unitRate'(p) {
    const segs = mathSegments(p.question);
    expect(segs.length).toBe(2);
    const { text } = skeleton(p.question);
    const moneyIdx = text.includes('\\$@1') ? 1 : 0;
    const [top, bottom] = moneyIdx === 1 ? [segs[1]!, segs[0]!] : [segs[0]!, segs[1]!];
    const want = qty(top) / qty(bottom);
    near(qty(mathSegments(p.answer)[0]!), want, 1e-9, p.question);
  },

  /** a ↔ b, so c ↔ b·c / a. */
  'prealgebra.proportionWord'(p) {
    const [a, b, c] = mathSegments(p.question).map((t) => qty(t));
    near(qty(mathSegments(p.answer)[0]!), (b! * c!) / a!, 1e-9, p.question);
  },

  /** Percent of a number / what percent / percent of what, from the sentence pattern. */
  'prealgebra.percent'(p) {
    const { text, segs } = skeleton(p.question);
    const v = segs.map((t) => qty(t));
    const isPct = segs.map((t) => t.includes('\\%'));
    const patterns: Array<[RegExp, (a: number, b: number) => number, boolean]> = [
      [/^What is @0 of @1\?$/, (a, b) => (a * b) / 100, false],
      [/^Find @0 of @1\.$/, (a, b) => (a * b) / 100, false],
      [/^@0 is what percent of @1\?$/, (a, b) => (a / b) * 100, true],
      [/^What percent of @0 is @1\?$/, (a, b) => (b / a) * 100, true],
      [/^@0 is @1 of what number\?$/, (a, b) => (a * 100) / b, false],
      [/^@0 of what number is @1\?$/, (a, b) => (b * 100) / a, false],
    ];
    const hit = patterns.find(([re]) => re.test(text));
    expect(hit, `pattern for ${text}`).toBeDefined();
    const [, f, percentAnswer] = hit!;
    // the percent operand really is a percent
    expect(isPct.filter(Boolean).length, text).toBe(percentAnswer ? 0 : 1);
    const a = onlyMath(p.answer);
    expect(a.includes('\\%'), p.answer).toBe(percentAnswer);
    near(qty(a), f(v[0]!, v[1]!), 1e-9, `${p.question} → ${p.answer}`);
  },

  /** Markup, discount, tax, tip: amount or new total, to the cent. */
  'prealgebra.percentApplied'(p) {
    const { text, segs } = skeleton(p.question);
    const priceIdx = Number(/\\\$@(\d+)/.exec(text)![1]);
    const price = qty(segs[priceIdx]!);
    const rate = qty(segs.find((t) => t.includes('\\%'))!) / 100;
    let want: number;
    if (/Find the amount of the (markup|discount|tax|tip)\./.test(text)) want = price * rate;
    else if (/Find the sale price\./.test(text)) {
      expect(text).toMatch(/off\./);
      want = price * (1 - rate);
    } else {
      expect(text).toMatch(/Find the (selling price|total cost|total amount paid)\./);
      want = price * (1 + rate);
    }
    expect(p.answer.startsWith('\\$$'), p.answer).toBe(true);
    near(qty(onlyMath(p.answer)), want, 0.005, p.question);
  },

  /** Percent of change, rounded to a tenth of a percent, with its direction. */
  'prealgebra.percentChange'(p) {
    const segs = mathSegments(p.question).map((t) => qty(t));
    const [from, to] = segs as [number, number];
    const change = ((to - from) / from) * 100;
    const got = qty(mathSegments(p.answer)[0]!);
    near(got, Math.round(Math.abs(change) * 10) / 10, 1e-9, `${p.question} → ${p.answer}`);
    expect(p.answer.endsWith(change > 0 ? 'increase' : 'decrease'), p.answer).toBe(true);
  },

  /** I = Prt in all its forms. */
  'prealgebra.interest'(p) {
    const { text, segs } = skeleton(p.question);
    const moneyVals = [...text.matchAll(/\\\$@(\d+)/g)].map((mm) => qty(segs[Number(mm[1])]!));
    const rateSeg = segs.findIndex((t) => t.includes('\\%'));
    const r = rateSeg >= 0 ? qty(segs[rateSeg]!) / 100 : NaN;
    const tm = /@(\d+) (years?|months)/.exec(text);
    const t = tm ? qty(segs[Number(tm[1])]!) / (tm[2] === 'months' ? 12 : 1) : NaN;
    const ans = qty(mathSegments(p.answer)[0]!);
    if (/How much interest is earned/.test(text)) near(ans, moneyVals[0]! * r * t, 0.005, text);
    else if (/What is the balance/.test(text)) near(ans, moneyVals[0]! * (1 + r * t), 0.005, text);
    else if (/annual interest rate/.test(text)) {
      expect(p.answer).toContain('\\%');
      near(ans / 100, moneyVals[1]! / (moneyVals[0]! * t), 1e-9, text);
    } else if (/how many years/.test(text)) near(ans, moneyVals[1]! / (moneyVals[0]! * r), 1e-9, text);
    else {
      expect(text).toMatch(/How much was deposited/);
      near(ans, moneyVals[0]! / (r * t), 0.005, text);
    }
  },

  /** Scientific notation: same value as the question, in the requested form. */
  'prealgebra.sci'(p) {
    const q = qty(mathSegments(p.question)[0]!);
    const a = onlyMath(p.answer);
    expect(close(qty(a), q, 1e-9), `${p.question} → ${p.answer}`).toBe(true);
    if (p.check!.form === 'sci') expect(/^-?[1-9](\.\d*[1-9])? \\times 10\^\{-?\d+\}$/.test(a), `scientific form: ${a}`).toBe(true);
    else expect(/^-?[\d{},]+(\.\d+)?$/.test(a), `standard form: ${a}`).toBe(true);
  },

  /** Square roots: exact value, consecutive-integer bounds, or rounded to a tenth. */
  'prealgebra.sqrt'(p) {
    const q = qty(mathSegments(p.question)[0]!);
    const segs = mathSegments(p.answer).map((t) => qty(t));
    if (p.check!.task === 'perfect') expect(close(segs[0]!, q), `${p.question} → ${p.answer}`).toBe(true);
    else if (p.check!.task === 'estimate') {
      const [lo, hi] = segs as [number, number];
      expect(hi - lo, p.answer).toBe(1);
      expect(lo < q && q < hi, `${p.question} → ${p.answer}`).toBe(true);
    } else {
      near(segs[0]!, Math.round(q * 10) / 10, 1e-9, `${p.question} → ${p.answer}`);
    }
  },
};

/** Percent-aware value: `12.5\%` → 0.125; mixed numbers allowed. */
function pctValue(tex: string): number {
  const v = qty(tex, { mixed: true });
  return tex.includes('\\%') ? v / 100 : v;
}

/** Integer, proper fraction in lowest terms, or mixed number with a proper reduced fraction part. */
function expectSimplest(a: string, mixed: boolean): void {
  if (/^-?\d+$/.test(a)) return;
  const mm = /^-?(\d+)?\\frac\{(\d+)\}\{(\d+)\}$/.exec(a);
  expect(mm, `fraction form: ${a}`).not.toBeNull();
  const n = Number(mm![2]);
  const d = Number(mm![3]);
  expect(gcd(n, d), `lowest terms: ${a}`).toBe(1);
  expect(d, a).toBeGreaterThan(1);
  if (mm![1] !== undefined || mixed) expect(n < d, `proper fraction part (mixed number): ${a}`).toBe(true);
}
