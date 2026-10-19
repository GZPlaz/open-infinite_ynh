/** Sums of power terms c·x^p with rational p, rendered the way textbooks write them. */
import { Frac, type FracLike } from '../../fraction';

export interface PowerTerm {
  c: Frac;
  p: Frac;
}

export const pt = (c: FracLike, p: FracLike): PowerTerm => ({ c: Frac.of(c), p: Frac.of(p) });

/** Magnitude of one term (sign handled by the caller): `3x^{2}`, `\frac{4}{x^{3}}`, `\frac{5}{2\sqrt{x}}`. */
function magnitude(t: PowerTerm, v: string): string {
  const c = t.c.abs();
  const p = t.p;
  const coef = (k: Frac) => (k.eq(1) ? '' : k.toTex());
  if (p.isZero()) return c.toTex();
  if (p.sign > 0) {
    if (p.eq(1)) return `${coef(c)}${v}`;
    if (p.isInt()) return `${coef(c)}${v}^{${p.n}}`;
    if (p.eq(new Frac(1, 2))) return `${coef(c)}\\sqrt{${v}}`;
    return `${coef(c)}${v}^{${p.toTex()}}`;
  }
  // negative exponent → fraction
  const q = p.neg();
  const den = q.eq(1) ? v : q.isInt() ? `${v}^{${q.n}}` : q.eq(new Frac(1, 2)) ? `\\sqrt{${v}}` : `${v}^{${q.toTex()}}`;
  return `\\frac{${c.n}}{${c.d === 1 ? '' : c.d}${den}}`;
}

/** Combine like powers and drop zero terms, highest power first. */
export function normalize(terms: readonly PowerTerm[]): PowerTerm[] {
  const map = new Map<string, PowerTerm>();
  for (const t of terms) {
    const k = t.p.toString();
    const prev = map.get(k);
    map.set(k, prev ? { c: prev.c.add(t.c), p: t.p } : t);
  }
  return [...map.values()].filter((t) => !t.c.isZero()).sort((a, b) => b.p.cmp(a.p));
}

export function powerSumTex(terms: readonly PowerTerm[], v = 'x', keepOrder = false): string {
  const list = keepOrder ? terms.filter((t) => !t.c.isZero()) : normalize(terms);
  if (!list.length) return '0';
  return list
    .map((t, i) => {
      const body = magnitude(t, v);
      if (i === 0) return t.c.sign < 0 ? `-${body}` : body;
      return t.c.sign < 0 ? ` - ${body}` : ` + ${body}`;
    })
    .join('');
}

export function derive(terms: readonly PowerTerm[]): PowerTerm[] {
  return normalize(terms.filter((t) => !t.p.isZero()).map((t) => ({ c: t.c.mul(t.p), p: t.p.sub(1) })));
}

/** Antiderivative of terms with p ≠ −1. */
export function integrate(terms: readonly PowerTerm[]): PowerTerm[] {
  return normalize(
    terms.map((t) => {
      if (t.p.eq(-1)) throw new Error('integrate: x^-1 needs a logarithm');
      return { c: t.c.div(t.p.add(1)), p: t.p.add(1) };
    }),
  );
}
