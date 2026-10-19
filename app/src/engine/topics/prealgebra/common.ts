/** Shared helpers for the Pre-Algebra generators: categories, names, exact decimals, money. */
import type { Rng } from '../../rng';

export const CAT = {
  integers: 'Integers and Order of Operations',
  numberTheory: 'Number Theory',
  fractions: 'Fractions, Decimals and Percents',
  ratios: 'Ratios, Rates and Percents',
  exponents: 'Exponents and Roots',
  equations: 'Equations and Inequalities',
  statistics: 'Statistics',
  graphing: 'Graphing',
} as const;

/** Gender-neutral first names for word problems. */
export const NAMES = [
  'Ava', 'Kai', 'Noah', 'Priya', 'Mateo', 'Lena', 'Omar', 'Yuki', 'Sam', 'Zoe', 'Ravi', 'Ines',
  'Jordan', 'Alex', 'Taylor', 'Riley', 'Morgan', 'Chen', 'Amara', 'Diego', 'Hana', 'Luca', 'Nia', 'Felix',
] as const;

export function pickName(rng: Rng): string {
  return rng.pick(NAMES);
}

/** Two different names. */
export function pickNames(rng: Rng, k: number): string[] {
  return rng.sample(NAMES, k);
}

/** Integer with thousands separators for LaTeX: `12{,}500`. */
export function groupDigits(intPart: string): string {
  const neg = intPart.startsWith('-');
  const s = neg ? intPart.slice(1) : intPart;
  if (s.length <= 4) return intPart; // 1500 stays 1500 (Kuta style), 12500 → 12{,}500
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += '{,}';
    out += s[i];
  }
  return (neg ? '-' : '') + out;
}

/**
 * Exact decimal `n / 10^s` (s ≥ 0). Used for decimal arithmetic without
 * floating-point drift.
 */
export class Dec {
  readonly n: number;
  readonly s: number;
  constructor(n: number, s = 0) {
    if (!Number.isSafeInteger(n)) throw new Error(`Dec: unsafe ${n}`);
    // normalise trailing zeros
    while (s > 0 && n % 10 === 0) {
      n /= 10;
      s--;
    }
    this.n = n + 0;
    this.s = s;
  }
  static of(n: number, s = 0): Dec {
    return new Dec(n, s);
  }
  private scaled(s: number): number {
    return this.n * 10 ** (s - this.s);
  }
  add(o: Dec): Dec {
    const s = Math.max(this.s, o.s);
    return new Dec(this.scaled(s) + o.scaled(s), s);
  }
  sub(o: Dec): Dec {
    return this.add(o.neg());
  }
  mul(o: Dec): Dec {
    return new Dec(this.n * o.n, this.s + o.s);
  }
  /** Exact quotient, or null when it does not terminate within `maxScale` places. */
  div(o: Dec, maxScale = 6): Dec | null {
    if (o.n === 0) return null;
    for (let s = 0; s <= maxScale; s++) {
      // this / o = (this.n / o.n) * 10^(o.s - this.s)
      const shift = s + o.s - this.s;
      const numer = shift >= 0 ? this.n * 10 ** shift : this.n;
      const denom = shift >= 0 ? o.n : o.n * 10 ** -shift;
      if (numer % denom === 0) return new Dec(numer / denom, s);
    }
    return null;
  }
  neg(): Dec {
    return new Dec(-this.n, this.s);
  }
  times10(k: number): Dec {
    return k >= 0 ? new Dec(this.n * 10 ** k, this.s) : new Dec(this.n, this.s - k);
  }
  get value(): number {
    return this.n / 10 ** this.s;
  }
  get sign(): number {
    return Math.sign(this.n);
  }
  isZero(): boolean {
    return this.n === 0;
  }
  eq(o: Dec): boolean {
    return this.n === o.n && this.s === o.s;
  }
  /** Plain digits: `-3.25`, `0.007`, `12`. */
  toString(minScale = 0): string {
    const neg = this.n < 0;
    let digits = String(Math.abs(this.n));
    let s = this.s;
    while (s < minScale) {
      digits += '0';
      s++;
    }
    if (s === 0) return (neg ? '-' : '') + digits;
    digits = digits.padStart(s + 1, '0');
    return `${neg ? '-' : ''}${digits.slice(0, -s)}.${digits.slice(-s)}`;
  }
  /** LaTeX with grouped thousands. */
  toTex(minScale = 0): string {
    const str = this.toString(minScale);
    const [i, f] = str.split('.');
    return f === undefined ? groupDigits(i!) : `${groupDigits(i!)}.${f}`;
  }
}

/** Round a number to `places` decimals as an exact Dec (half away from zero). */
export function roundDec(v: number, places: number): Dec {
  const f = 10 ** places;
  const r = Math.sign(v) * Math.round(Math.abs(v) * f + 1e-7);
  return new Dec(r, places);
}

/** Money amount without the dollar sign, as LaTeX: `1{,}234.50`. */
export function moneyNum(cents: number): string {
  return new Dec(cents, 2).toTex(2);
}

/**
 * Money as rich text: `\$$1{,}234.50$`. The dollar sign stays outside math,
 * because a `\$` inside `$…$` would end the math segment.
 */
export function money(cents: number): string {
  return cents < 0 ? `$-$\\$$${moneyNum(-cents)}$` : `\\$$${moneyNum(cents)}$`;
}

/** Like `money`, but whole-dollar amounts print without cents: `\$$45$`. */
export function moneyShort(cents: number): string {
  return cents % 100 === 0 ? `\\$$${groupDigits(String(cents / 100))}$` : money(cents);
}

/** Round to the nearest cent. */
export function cents(dollars: number): number {
  return Math.round(dollars * 100 + 1e-7 * Math.sign(dollars));
}

/** Capitalise the first letter of a sentence (skipping a leading math segment). */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
