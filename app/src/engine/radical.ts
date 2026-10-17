/** Simplified radical forms (√72 → 6√2). */

export interface SimplifiedRoot {
  /** Factor pulled out of the radical. */
  out: number;
  /** What is left under the radical (1 when the root is exact). */
  inside: number;
}

/** Write the `index`-th root of a non-negative integer as out·ⁱ√inside with `inside` free of perfect powers. */
export function simplifyRoot(n: number, index = 2): SimplifiedRoot {
  if (!Number.isInteger(n) || n < 0) throw new Error(`simplifyRoot: bad radicand ${n}`);
  if (n === 0) return { out: 0, inside: 1 };
  let out = 1;
  let inside = n;
  for (let f = 2; f ** index <= inside; f++) {
    const p = f ** index;
    while (inside % p === 0) {
      inside /= p;
      out *= f;
    }
  }
  return { out, inside };
}

export const simplifySqrt = (n: number): SimplifiedRoot => simplifyRoot(n, 2);

export function isPerfectSquare(n: number): boolean {
  if (n < 0) return false;
  const r = Math.round(Math.sqrt(n));
  return r * r === n;
}

/** LaTeX for k·√m (or k·ⁱ√m): `5`, `\sqrt{7}`, `-3\sqrt{2}`. */
export function rootTex(out: number, inside: number, index = 2): string {
  const radical = index === 2 ? `\\sqrt{${inside}}` : `\\sqrt[${index}]{${inside}}`;
  if (inside === 1) return String(out);
  if (out === 1) return radical;
  if (out === -1) return `-${radical}`;
  return `${out}${radical}`;
}

/** LaTeX for √n in simplest form. */
export function sqrtTex(n: number): string {
  const { out, inside } = simplifySqrt(n);
  return rootTex(out, inside);
}
