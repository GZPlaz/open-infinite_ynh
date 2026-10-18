/** Shared helpers for the Algebra 2 radical topics: monomial roots and sums of square roots. */
import { Frac, gcdAll } from '../../../fraction';
import { rootTex, simplifyRoot } from '../../../radical';

export type Exps = Record<string, number>;

/** `x^{3}y` from exponents (only positive ones are shown). */
export function varsTex(e: Exps): string {
  return Object.keys(e)
    .sort()
    .filter((v) => e[v]! > 0)
    .map((v) => (e[v] === 1 ? v : `${v}^{${e[v]}}`))
    .join('');
}

export function radTex(index: number, body: string): string {
  return index === 2 ? `\\sqrt{${body}}` : `\\sqrt[${index}]{${body}}`;
}

/** Radicand `72x^{5}` (coefficient 1 is dropped when variables follow). */
export function radicandTex(c: number, vars: Exps): string {
  const vt = varsTex(vars);
  if (!vt) return String(c);
  if (c === 1) return vt;
  if (c === -1) return `-${vt}`;
  return `${c}${vt}`;
}

/** coef · outVars · ⁿ√(inC · inVars) */
export interface RootTerm {
  coef: number;
  out: Exps;
  index: number;
  inC: number;
  inV: Exps;
}

/** Simplify k·outside·ⁿ√(c·vars); c may be negative only for odd n. */
export function simplifyRootMono(c: number, vars: Exps, index: number, k = 1, outside: Exps = {}): RootTerm {
  if (c < 0 && index % 2 === 0) throw new Error('even root of a negative number');
  const sign = c < 0 ? -1 : 1;
  const { out, inside } = simplifyRoot(Math.abs(c), index);
  const o: Exps = { ...outside };
  const iv: Exps = {};
  for (const [v, e] of Object.entries(vars)) {
    o[v] = (o[v] ?? 0) + Math.floor(e / index);
    if (e % index) iv[v] = e % index;
  }
  return { coef: k * sign * out, out: o, index, inC: inside, inV: iv };
}

export function hasRadical(t: RootTerm): boolean {
  return t.inC !== 1 || Object.values(t.inV).some((e) => e > 0);
}

/** LaTeX of a root term, sign included: `-6x^{2}\sqrt{2x}`. */
export function rootTermTex(t: RootTerm): string {
  const rad = hasRadical(t);
  const vt = varsTex(t.out);
  const mag = Math.abs(t.coef);
  const outside = mag === 1 && (vt || rad) ? vt : `${mag}${vt}`;
  const body = rad ? radTex(t.index, radicandTex(t.inC, t.inV)) : '';
  return `${t.coef < 0 ? '-' : ''}${outside}${body}`;
}

/** Join signed terms: `a`, `-b` → `a - b`. */
export function joinTerms(ts: readonly string[]): string {
  let out = '';
  for (const t of ts) {
    if (!out) out = t;
    else out += t.startsWith('-') ? ` - ${t.slice(1)}` : ` + ${t}`;
  }
  return out || '0';
}

/** Coefficient prefix for a term: '' for 1, '-' for -1. */
export function coefPrefix(c: number | Frac): string {
  const f = Frac.of(c);
  if (f.eq(1)) return '';
  if (f.eq(-1)) return '-';
  return f.toTex();
}

/** Integer combination of square roots: Σ coef·√inside (inside square-free). */
export class RadSum {
  readonly terms: ReadonlyMap<number, number>;

  constructor(entries: Iterable<readonly [number, number]>) {
    const m = new Map<number, number>();
    for (const [n, c] of entries) {
      const { out, inside } = simplifyRoot(n, 2);
      m.set(inside, (m.get(inside) ?? 0) + c * out);
    }
    for (const [k, v] of [...m]) if (v === 0) m.delete(k);
    this.terms = m;
  }

  static of(...entries: Array<readonly [number, number]>): RadSum {
    return new RadSum(entries);
  }

  add(o: RadSum): RadSum {
    return new RadSum([...this.terms, ...o.terms]);
  }

  scale(k: number): RadSum {
    return new RadSum([...this.terms].map(([n, c]) => [n, c * k] as const));
  }

  mul(o: RadSum): RadSum {
    const out: Array<readonly [number, number]> = [];
    for (const [n1, c1] of this.terms) for (const [n2, c2] of o.terms) out.push([n1 * n2, c1 * c2]);
    return new RadSum(out);
  }

  isZero(): boolean {
    return this.terms.size === 0;
  }

  /** The rational part (coefficient of √1). */
  get constant(): number {
    return this.terms.get(1) ?? 0;
  }

  get size(): number {
    return this.terms.size;
  }

  contentGcd(): number {
    return gcdAll([...this.terms.values()]);
  }

  divInt(k: number): RadSum {
    return new RadSum([...this.terms].map(([n, c]) => [n, c / k] as const));
  }

  /** Constant first, then by radicand; a positive term is moved to the front when the first is negative. */
  tex(): string {
    const list = [...this.terms].sort((a, b) => a[0] - b[0]);
    if (list.length > 1 && list[0]![1] < 0) {
      const i = list.findIndex(([, c]) => c > 0);
      if (i > 0) list.unshift(...list.splice(i, 1));
    }
    return joinTerms(list.map(([n, c]) => rootTex(c, n)));
  }

  value(): number {
    let s = 0;
    for (const [n, c] of this.terms) s += c * Math.sqrt(n);
    return s;
  }
}

/** `\frac{M}{d}` for a RadSum over a positive integer, sign pulled out for a single term. */
export function radFracTex(M: RadSum, d: number): string {
  if (d === 1) return M.tex();
  if (M.size === 1) {
    const [[n, c]] = [...M.terms] as [[number, number]];
    const mag = rootTex(Math.abs(c), n);
    return `${c < 0 ? '-' : ''}\\frac{${mag}}{${d}}`;
  }
  return `\\frac{${M.tex()}}{${d}}`;
}

/** Reduce M/d (d ≠ 0) to lowest terms with a positive denominator. */
export function reduceRadFrac(M: RadSum, d: number): { M: RadSum; d: number } {
  let g = gcdAll([...M.terms.values(), d]) || 1;
  if (d < 0) g = -g;
  return { M: M.divInt(g), d: d / g };
}

export const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];
/** Cube-free / fourth-power-free / fifth-power-free radicands (excluding 1). */
export const FREE: Record<number, number[]> = {
  2: SQUAREFREE,
  3: [2, 3, 4, 5, 6, 7, 9, 10, 12],
  4: [2, 3, 5, 6, 8, 10],
  5: [2, 3, 4, 5],
};

/** Monomial with rational exponents and a rational coefficient. */
export interface QMono {
  coef: Frac;
  exps: Record<string, Frac>;
}

export function expTex(e: Frac): string {
  return e.toTex();
}

/** `x^{\frac{2}{3}}`; exponent 1 → `x`; 0 → ''. */
export function qpow(v: string, e: Frac): string {
  if (e.isZero()) return '';
  if (e.eq(1)) return v;
  return `${v}^{${e.toTex()}}`;
}
