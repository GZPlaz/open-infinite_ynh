/** Shared helpers for geometry generators: units, π expressions, rounding. */
import { Frac, type FracLike } from '../../fraction';
import { UNITS } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, num, roundTo, withUnit } from '../../tex';

export function pickUnit(rng: Rng, enabled: boolean): string | undefined {
  return enabled ? rng.pick(UNITS) : undefined;
}

function halves(x: FracLike): Frac {
  if (x instanceof Frac || Number.isInteger(x)) return Frac.of(x);
  const twice = Math.round(x * 2);
  if (Math.abs(twice / 2 - x) > 1e-9) throw new Error(`PiExpr: ${x} is not a multiple of 1/2`);
  return new Frac(twice, 2);
}

/** Exact value of the form `rational + rational·π`. */
export class PiExpr {
  constructor(
    readonly rat: Frac,
    readonly pi: Frac,
  ) {}

  /** Accepts integers, Fracs, or numbers that are exact halves (areas like ½bh). */
  static of(rat: FracLike, pi: FracLike = 0): PiExpr {
    return new PiExpr(halves(rat), halves(pi));
  }

  add(o: PiExpr): PiExpr {
    return new PiExpr(this.rat.add(o.rat), this.pi.add(o.pi));
  }

  get value(): number {
    return this.rat.value + this.pi.value * Math.PI;
  }

  /** `48`, `16\pi`, `\frac{32}{3}\pi`, `48 + 8\pi`. */
  toTex(): string {
    const piTerm = this.pi.isZero()
      ? ''
      : this.pi.eq(1)
        ? '\\pi'
        : this.pi.eq(-1)
          ? '-\\pi'
          : `${num(this.pi)}\\pi`;
    if (this.rat.isZero()) return piTerm || '0';
    if (!piTerm) return num(this.rat);
    return piTerm.startsWith('-') ? `${num(this.rat)} - ${piTerm.slice(1)}` : `${num(this.rat)} + ${piTerm}`;
  }
}

export interface FormattedMeasure {
  /** LaTeX of the value with unit, e.g. `50.3\text{ in}^{2}`. */
  tex: string;
  /** True when rounded (use ≈ rather than =). */
  approx: boolean;
}

/** Format a measurement exactly (when it has an exact form and `form` is exact) or rounded to a tenth. */
export function formatMeasure(
  value: number,
  form: string,
  unit: string | undefined,
  power = 1,
  exactTex?: string,
): FormattedMeasure {
  if (form === 'exact' && exactTex !== undefined) return { tex: withUnit(exactTex, unit, power), approx: false };
  const rounded = roundTo(value, 1);
  const approx = Math.abs(rounded - value) > 1e-9;
  return { tex: withUnit(decimal(value, 1), unit, power), approx };
}

/** `x = 13` or `x \approx 9.7`. */
export function equalsTex(lhs: string, m: FormattedMeasure): string {
  return `${lhs} ${m.approx ? '\\approx' : '='} ${m.tex}`;
}

/** Primitive Pythagorean triples and small multiples with hypotenuse ≤ `maxC`. */
export function triples(maxC: number): Array<[number, number, number]> {
  const base: Array<[number, number, number]> = [
    [3, 4, 5],
    [5, 12, 13],
    [8, 15, 17],
    [7, 24, 25],
    [20, 21, 29],
    [12, 35, 37],
    [9, 40, 41],
  ];
  const out: Array<[number, number, number]> = [];
  for (const [a, b, c] of base) for (let k = 1; k * c <= maxC; k++) out.push([a * k, b * k, c * k]);
  return out;
}
