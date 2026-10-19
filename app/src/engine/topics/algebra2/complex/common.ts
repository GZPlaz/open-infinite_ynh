/** Exact complex numbers a + bi with rational parts, and their TeX. */
import { DiagramBuilder, type Pt } from '../../../diagram';
import { Frac, gcdAll, type FracLike } from '../../../fraction';
import type { Rng } from '../../../rng';
import { sum } from '../../../tex';

export interface Cx {
  re: Frac;
  im: Frac;
}

export const cx = (re: FracLike, im: FracLike = 0): Cx => ({ re: Frac.of(re), im: Frac.of(im) });
export const cadd = (a: Cx, b: Cx): Cx => ({ re: a.re.add(b.re), im: a.im.add(b.im) });
export const csub = (a: Cx, b: Cx): Cx => ({ re: a.re.sub(b.re), im: a.im.sub(b.im) });
export const cmul = (a: Cx, b: Cx): Cx => ({ re: a.re.mul(b.re).sub(a.im.mul(b.im)), im: a.re.mul(b.im).add(a.im.mul(b.re)) });
export const conj = (a: Cx): Cx => ({ re: a.re, im: a.im.neg() });
export const cneg = (a: Cx): Cx => ({ re: a.re.neg(), im: a.im.neg() });
export const norm2 = (a: Cx): Frac => a.re.mul(a.re).add(a.im.mul(a.im));
export function cdiv(a: Cx, b: Cx): Cx {
  const n = cmul(a, conj(b));
  const d = norm2(b);
  return { re: n.re.div(d), im: n.im.div(d) };
}
export const ceq = (a: Cx, b: Cx): boolean => a.re.eq(b.re) && a.im.eq(b.im);
export function cpowI(n: number): Cx {
  return [cx(1), cx(0, 1), cx(-1), cx(0, -1)][((n % 4) + 4) % 4]!;
}

/** Standard form `3 - 2i`, `-i`, `\frac{1}{2} + \frac{5}{2}i`, `0`. */
export function cTex(z: Cx): string {
  return sum([{ coef: z.re }, { coef: z.im, sym: 'i' }]);
}

/** Parenthesised for products and sums in questions. */
export const cParen = (z: Cx): string => `(${cTex(z)})`;

/** One fraction over a common denominator: `\frac{7 + 4i}{5}` (or `7 + 4i` when the denominator is 1). */
export function cFracTex(z: Cx): string {
  const D = Math.abs(z.re.d * z.im.d) / gcdAll([z.re.d, z.im.d]);
  const P = z.re.mul(D).value;
  const Q = z.im.mul(D).value;
  const g = gcdAll([P, Q, D]) || 1;
  const top = sum([{ coef: P / g }, { coef: Q / g, sym: 'i' }]);
  const den = D / g;
  return den === 1 ? top : `\\frac{${top}}{${den}}`;
}

/** Gaussian integer with parts in [-R, R], both non-zero unless allowed. */
export function randCx(rng: Rng, R: number, allowZeroPart = false): Cx {
  const part = () => (allowZeroPart && rng.bool(0.15) ? 0 : rng.signedInt(1, R, true));
  const re = part();
  const im = re === 0 ? rng.signedInt(1, R, true) : part();
  return cx(re, im);
}

/** Complex plane: grid with real (horizontal) and imaginary (vertical) axes. */
export function complexPlane(range: number, scale = 12): DiagramBuilder {
  const b = new DiagramBuilder(scale);
  for (let i = -range; i <= range; i++) {
    if (i === 0) continue;
    b.segment([i, -range], [i, range], { ink: 'grid', weight: 0.5 });
    b.segment([-range, i], [range, i], { ink: 'grid', weight: 0.5 });
  }
  b.arrow([-range - 0.6, 0], [range + 0.6, 0], { both: true, ink: 'axis', weight: 1 });
  b.arrow([0, -range - 0.6], [0, range + 0.6], { both: true, ink: 'axis', weight: 1 });
  b.label([range + 0.6, 0], '\\text{Real}', 'e', { ink: 'axis', small: true });
  b.label([0, range + 0.6], '\\text{Imaginary}', 'n', { ink: 'axis', small: true });
  for (let v = 2; v <= range; v += 2) {
    for (const s of [v, -v]) {
      b.label([s, 0], String(s), 's', { ink: 'muted', small: true });
      b.label([0, s] as Pt, `${s}i`, 'w', { ink: 'muted', small: true });
    }
  }
  return b;
}
