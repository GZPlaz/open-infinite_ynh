/** Shared helpers for the exponential / logarithm topics. */
import { Frac, type FracLike } from '../../../fraction';
import { roundTo } from '../../../tex';

export const CATEGORY = 'Exponential and Logarithmic Functions';

/** A logarithm / exponential base: a positive rational ≠ 1, or Euler's number. */
export type Base = Frac | 'e';

export const fr = (n: number, d = 1): Frac => new Frac(n, d);

export function baseValue(b: Base): number {
  return b === 'e' ? Math.E : b.value;
}

/** LaTeX of the base itself: `3`, `\frac{1}{2}`, `e`. */
export function baseTex(b: Base): string {
  return b === 'e' ? 'e' : b.toTex();
}

/** `\log_{2}`, `\log` (base 10), `\ln` (base e), `\log_{\frac{1}{2}}`. */
export function logOp(b: Base): string {
  if (b === 'e') return '\\ln';
  if (b.eq(10)) return '\\log';
  return `\\log_{${b.toTex()}}`;
}

/** An argument that needs no parentheses after `\log`: a number, a letter, a power, a fraction or a root. */
export function isAtomic(arg: string): boolean {
  const s = arg.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return true;
  if (/^[a-zA-Z](\^\{[^{}]*\})?$/.test(s)) return true;
  if (/^\d+\^\{[^{}]*\}$/.test(s)) return true;
  if (/^\\(frac|sqrt)/.test(s) && closesAtEnd(s)) return true;
  return false;
}

/** True when the leading `\frac{..}{..}` / `\sqrt[..]{..}` spans the whole string. */
function closesAtEnd(s: string): boolean {
  let i = s.startsWith('\\frac') ? 5 : 5;
  let groups = s.startsWith('\\frac') ? 2 : 1;
  if (s[i] === '[') {
    while (s[i] !== ']') i++;
    i++;
  }
  while (groups > 0) {
    if (s[i] !== '{') return false;
    let depth = 0;
    do {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') depth--;
      i++;
    } while (depth > 0 && i < s.length);
    groups--;
  }
  return i === s.length;
}

/** `\log_{b} arg` with parentheses when the argument is compound. */
export function logOf(b: Base, arg: string, wrap = !isAtomic(arg)): string {
  return `${logOp(b)} ${wrap ? `(${arg})` : arg}`;
}

/** Wrap a base in parentheses when it is not a plain number or letter. */
export function powBase(tex: string): string {
  return /^([0-9]+|[a-zA-Z])$/.test(tex) ? tex : `\\left(${tex}\\right)`;
}

/** `b^{e}` for a base (fractions parenthesised). */
export function powTex(b: Base | string, exp: string): string {
  const t = typeof b === 'string' ? b : baseTex(b);
  return `${powBase(t)}^{${exp}}`;
}

/** Number with thousands separators for math (`12{,}345.60`) or text (`12,345.60`). */
export function grouped(v: number, places: number, fixed = false, math = true): string {
  const r = roundTo(v, places);
  const neg = r < 0;
  let s = fixed ? Math.abs(r).toFixed(places) : String(Math.abs(r));
  const [int, dec] = s.split('.');
  const sep = math ? '{,}' : ',';
  const intG = int!.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  s = dec !== undefined ? `${intG}.${dec}` : intG;
  return (neg ? '-' : '') + s;
}

/** Integer power of a rational, guarded against overflow. */
export function fpow(b: FracLike, k: number): Frac {
  return Frac.of(b).pow(k);
}

/** log_b(x) rational with small denominator? (then the problem would not need logs). */
export function isRationalLog(x: number, b: number, maxDen = 6): boolean {
  const L = Math.log(x) / Math.log(b);
  for (let d = 1; d <= maxDen; d++) if (Math.abs(L * d - Math.round(L * d)) < 1e-9) return true;
  return false;
}

export const NAMES = [
  'Avery', 'Jordan', 'Priya', 'Mateo', 'Keiko', 'Samir', 'Lena', 'Diego', 'Amara', 'Tomás',
  'Noor', 'Elif', 'Kwame', 'Sofia', 'Ravi', 'Hana', 'Owen', 'Zara', 'Luca', 'Imani',
];
