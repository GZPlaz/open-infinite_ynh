/** Shared helpers for the Algebra 2 sequences and series topics. */
import { Frac } from '../../../fraction';
import { offset } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, sum, term } from '../../../tex';
import type { Difficulty } from '../../../types';

export type SeqKind = 'arithmetic' | 'geometric';

/** Arithmetic (k = d) or geometric (k = r) sequence. */
export interface AG {
  kind: SeqKind;
  a1: Frac;
  k: Frac;
}

export function agTerm(s: AG, n: number): Frac {
  return s.kind === 'arithmetic' ? s.a1.add(s.k.mul(n - 1)) : s.a1.mul(s.k.pow(n - 1));
}

export function agPartial(s: AG, n: number): Frac {
  let acc = Frac.ZERO;
  for (let i = 1; i <= n; i++) acc = acc.add(agTerm(s, i));
  return acc;
}

/** `(−2)`, `\left(\frac{1}{2}\right)` or `3` — a base that can carry an exponent. */
export function baseTex(k: Frac): string {
  if (k.isInt()) return k.sign < 0 ? `(${num(k)})` : num(k);
  return `\\left(${num(k)}\\right)`;
}

/** Right-hand side of the explicit formula, in the variable `v`. */
export function agExplicit(s: AG, v = 'n'): string {
  if (s.kind === 'arithmetic') return sum([{ coef: s.k, sym: v }, { coef: s.a1.sub(s.k) }]);
  const power = `${baseTex(s.k)}^{${v} - 1}`;
  if (s.a1.eq(1)) return power;
  if (s.a1.eq(-1)) return `-${power}`;
  return s.k.sign < 0 || !s.k.isInt() ? `${num(s.a1)}${power}` : `${num(s.a1)} \\cdot ${power}`;
}

/** Right-hand side of the recursive rule `a_n = …`. */
export function agRecursive(s: AG): string {
  if (s.kind === 'arithmetic') return sum([{ coef: 1, sym: 'a_{n-1}' }, { coef: s.k }]);
  return term(s.k, 'a_{n-1}');
}

/** Rich-text recursive formula: `$a_n = a_{n-1} + 3$, $a_1 = 5$`. */
export function recursiveRich(rhs: string, a1: Frac, a2?: Frac): string {
  return `${m(`a_n = ${rhs}`)}, ${m(`a_1 = ${num(a1)}`)}${a2 ? `, ${m(`a_2 = ${num(a2)}`)}` : ''}`;
}

export function listTex(terms: readonly Frac[]): string {
  return `${terms.map((t) => num(t)).join(', ')}, \\ldots`;
}

/** `3 + 7 - 2`: a sum of explicit terms with tidy signs. */
export function seriesBody(terms: readonly Frac[]): string {
  return terms.map((t, i) => (i === 0 ? num(t) : t.sign < 0 ? `- ${num(t.abs())}` : `+ ${num(t)}`)).join(' ');
}

/** `3 + 7 + 11 + \cdots` or, with a last term, `3 + 7 + 11 + \cdots + 79`. */
export function seriesTex(terms: readonly Frac[], last?: Frac): string {
  const head = `${seriesBody(terms)} + \\cdots`;
  if (!last) return head;
  return `${head} ${last.sign < 0 ? `- ${num(last.abs())}` : `+ ${num(last)}`}`;
}

export const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** Random arithmetic or geometric sequence for the given difficulty. */
export function pickAG(rng: Rng, kind: SeqKind, d: Difficulty, negatives: boolean, fractions: boolean): AG {
  if (kind === 'arithmetic') {
    if (fractions && d !== 'easy' && rng.bool(0.5)) {
      const den = rng.pick([2, 3, 4]);
      const k = new Frac(rng.signedInt(1, 2 * den + 1, negatives), den);
      if (k.isInt()) return { kind, a1: new Frac(rng.signedInt(1, 12, negatives)), k: new Frac(k.n, 1) };
      const a1 = rng.bool(0.5) ? new Frac(rng.signedInt(1, 12, negatives)) : new Frac(rng.signedInt(1, 4 * den, negatives), den);
      return { kind, a1, k };
    }
    const D = d === 'easy' ? 6 : d === 'medium' ? 9 : 15;
    const A = d === 'easy' ? 15 : d === 'medium' ? 20 : 35;
    const neg = negatives && d !== 'easy';
    const a1 = new Frac(neg ? rng.intExcept(-A, A, [0]) : rng.int(1, A));
    const k = new Frac(rng.signedInt(d === 'hard' ? 2 : 1, D, neg));
    return { kind, a1, k };
  }
  const neg = negatives && d !== 'easy';
  if (fractions && d !== 'easy' && rng.bool(0.5)) {
    const den = rng.pick([2, 3]);
    const numer = den === 3 && rng.bool(0.3) ? 2 : 1;
    const k = new Frac(neg && rng.bool() ? -numer : numer, den);
    const a1 = new Frac(rng.signedInt(1, 3, neg) * den ** (d === 'hard' ? 5 : 4));
    return { kind, a1, k };
  }
  const ratios = d === 'easy' ? [2, 3, 4] : d === 'medium' ? [2, 3, 4] : [2, 3, 4, 5];
  const r = rng.pick(ratios) * (neg && rng.bool(0.4) ? -1 : 1);
  const a1 = new Frac(rng.signedInt(1, 8, neg));
  return { kind, a1, k: new Frac(r) };
}

/** Rendered value with a numeric fallback: `$a_{12} = 45$`. */
export function nudge(value: Frac, k: number): Frac {
  return value.add(offset(k));
}

export const ordinal = (n: number): string => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][n % 10]!;
  return `${n}${s}`;
};
