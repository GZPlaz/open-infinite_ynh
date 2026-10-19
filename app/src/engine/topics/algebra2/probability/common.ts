/**
 * Shared pieces of the probability topics: a tiny language describing a
 * random experiment (stored in `check` so the test-suite can enumerate it
 * independently), exact probabilities by enumeration, and answer formatting.
 */
import { Frac } from '../../../fraction';
import { distinctDistractors, offset } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { GeneratorContext, SelectOptionDef } from '../../../types';

export type AttrValue = string | number;
export type Attrs = Record<string, AttrValue>;

export interface PoolSpec {
  /** A fair die with this many faces, attribute `value`. */
  die?: number;
  /** A standard 52-card deck, attributes `rank` (A, 2–10, J, Q, K) and `suit`. */
  deck?: boolean;
  /** A fair coin, attribute `side` (H / T). */
  coin?: boolean;
  /** Explicit items. */
  items?: Array<{ count: number; attrs: Attrs }>;
}

export type Ev =
  | { at: number; attr: string; in: AttrValue[] }
  | { and: Ev[] }
  | { or: Ev[] }
  | { not: Ev }
  | { count: { attr: string; in: AttrValue[] }; n: number; op?: '=' | '>=' }
  | { sum: string; op: '=' | '>' | '<'; value: number }
  | { same: string };

export interface Experiment {
  pools: Record<string, PoolSpec>;
  /** Pool drawn from at each stage. */
  draws: string[];
  /** Whether drawn items go back into their pool. */
  replace: boolean;
  event: Ev;
}

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export const FACE = ['J', 'Q', 'K'];
export const RED = ['hearts', 'diamonds'];

function expand(p: PoolSpec): Array<{ count: number; attrs: Attrs }> {
  if (p.die) return Array.from({ length: p.die }, (_, i) => ({ count: 1, attrs: { value: i + 1 } }));
  if (p.coin) return [{ count: 1, attrs: { side: 'H' } }, { count: 1, attrs: { side: 'T' } }];
  if (p.deck) return RANKS.flatMap((rank) => SUITS.map((suit) => ({ count: 1, attrs: { rank, suit } })));
  return p.items ?? [];
}

function holds(e: Ev, out: Attrs[]): boolean {
  if ('at' in e) return e.in.includes(out[e.at]![e.attr]!);
  if ('and' in e) return e.and.every((x) => holds(x, out));
  if ('or' in e) return e.or.some((x) => holds(x, out));
  if ('not' in e) return !holds(e.not, out);
  if ('count' in e) {
    const k = out.filter((o) => e.count.in.includes(o[e.count.attr]!)).length;
    return e.op === '>=' ? k >= e.n : k === e.n;
  }
  if ('sum' in e) {
    const s = out.reduce((acc, o) => acc + Number(o[e.sum]), 0);
    return e.op === '=' ? s === e.value : e.op === '>' ? s > e.value : s < e.value;
  }
  return out.every((o) => o[e.same] === out[0]![e.same]);
}

/** Exact probability of the event, by enumerating every sequence of draws. */
export function probability(x: Experiment): Frac {
  const pools: Record<string, Array<{ count: number; attrs: Attrs }>> = {};
  for (const [k, p] of Object.entries(x.pools)) pools[k] = expand(p).map((it) => ({ ...it }));
  const out: Attrs[] = [];
  const rec = (i: number, w: Frac): Frac => {
    if (i === x.draws.length) return holds(x.event, out) ? w : Frac.ZERO;
    const pool = pools[x.draws[i]!]!;
    const total = pool.reduce((s, it) => s + it.count, 0);
    let acc = Frac.ZERO;
    for (const it of pool) {
      if (!it.count) continue;
      const wi = w.mul(new Frac(it.count, total));
      out.push(it.attrs);
      if (!x.replace) it.count--;
      acc = acc.add(rec(i + 1, wi));
      if (!x.replace) it.count++;
      out.pop();
    }
    return acc;
  };
  return rec(0, Frac.ONE);
}

/** Single-pool items helper: `{ red: 4, blue: 6 }` → items with attribute `attr`. */
export function itemsOf(counts: Record<string, number>, attr = 'kind'): PoolSpec {
  return { items: Object.entries(counts).map(([k, count]) => ({ count, attrs: { [attr]: k } })) };
}

// ---------------------------------------------------------------- answers

export const probFormOption: SelectOptionDef = {
  type: 'select',
  id: 'probForm',
  label: 'Answer form',
  default: 'fraction',
  choices: [
    { value: 'fraction', label: 'Reduced fraction' },
    { value: 'decimal', label: 'Decimal (nearest thousandth)' },
    { value: 'percent', label: 'Percent (nearest tenth)' },
  ],
};

export type ProbForm = 'fraction' | 'decimal' | 'percent';

export function probForm(ctx: GeneratorContext): ProbForm {
  const v = ctx.options.probForm;
  return v === 'decimal' || v === 'percent' ? v : 'fraction';
}

/** Decimal places: 3, or enough for two significant figures of a small value. */
function places(v: number, base: number): number {
  if (v <= 0 || v >= 10 ** -(base - 1)) return base;
  return Math.min(12, Math.ceil(-Math.log10(v)) + 1);
}

function fixed(v: number, p: number): string {
  const s = v.toFixed(p);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** LaTeX for a probability: `\frac{5}{36}`, `0.139` or `13.9\%`. */
export function probTex(p: Frac, form: ProbForm): string {
  if (form === 'fraction') return num(p);
  if (form === 'decimal') return fixed(p.value, places(p.value, 3));
  return `${fixed(p.value * 100, places(p.value * 100, 1))}\\%`;
}

/** Answer plus three distinct distractors from candidate wrong probabilities. */
export function probChoices(p: Frac, wrong: Array<Frac | null | undefined>, form: ProbForm): { answer: string; distractors: string[] } {
  const answer = m(probTex(p, form));
  const ok = (w: Frac | null | undefined): w is Frac => !!w && w.sign > 0 && w.cmp(1) <= 0;
  const cands = wrong.filter(ok).map((w) => m(probTex(w, form)));
  const fallback = (k: number) => {
    const n = p.n + offset(k);
    const w = n > 0 && n <= p.d ? new Frac(n, p.d) : new Frac(p.n, p.d + k);
    return m(probTex(w, form));
  };
  return { answer, distractors: distinctDistractors(answer, cands, fallback) };
}

// ---------------------------------------------------------------- words

export const NAMES = ['Ana', 'Ben', 'Carmen', 'Dev', 'Elena', 'Femi', 'Grace', 'Hiro', 'Imani', 'Jamal', 'Kai', 'Lena', 'Mateo', 'Nadia', 'Omar', 'Priya', 'Quinn', 'Rosa', 'Sam', 'Tariq', 'Uma', 'Victor', 'Wen', 'Yusuf', 'Zoe', 'Jordan', 'Morgan', 'Riley', 'Alex', 'Taylor'];

export function names(rng: Rng, k: number): string[] {
  return rng.sample(NAMES, k);
}

export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** `4 red, 6 blue and 2 green` from ordered (count, label) pairs. */
export function listing(parts: Array<[number, string]>): string {
  const ps = parts.map(([c, l]) => `${c} ${l}`);
  return ps.length <= 2 ? ps.join(' and ') : `${ps.slice(0, -1).join(', ')} and ${ps.at(-1)}`;
}

/** Thousands separators for big counts: `17{,}576{,}000`. */
export function bigNum(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}');
}

export const fallingFactorial = (n: number, r: number): number => {
  let p = 1;
  for (let i = 0; i < r; i++) p *= n - i;
  return p;
};

export const choose = (n: number, r: number): number => {
  if (r < 0 || r > n) return 0;
  let c = 1;
  for (let i = 1; i <= r; i++) c = (c * (n - r + i)) / i;
  return Math.round(c);
};

export const permTex = (n: number, r: number) => `{}_{${n}}P_{${r}}`;
export const combTex = (n: number, r: number) => `{}_{${n}}C_{${r}}`;
