/**
 * Deterministic, seedable pseudo-random numbers.
 *
 * Every problem stores the 32-bit seed it was generated from, so a worksheet
 * can be reproduced exactly (and a single problem regenerated) without a server.
 */

/** Hash any mix of strings and numbers into an unsigned 32-bit seed (cyrb53, folded). */
export function hashSeed(...parts: Array<string | number>): number {
  const str = parts.join('␟');
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/** A fresh, non-deterministic seed (used for "regenerate" actions). */
export function randomSeed(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    return c.getRandomValues(new Uint32Array(1))[0]!;
  }
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

export class Rng {
  private state: number;

  constructor(seed: number) {
    // murmur3 finaliser, so neighbouring seeds start far apart
    let z = ((seed >>> 0) + 0x9e3779b9) >>> 0;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    this.state = (z ^ (z >>> 16)) >>> 0;
  }

  /** Uniform float in [0, 1) — mulberry32. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: empty range [${min}, ${max}]`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniform integer in [min, max] that is not in `exclude`. */
  intExcept(min: number, max: number, exclude: readonly number[]): number {
    const allowed: number[] = [];
    for (let v = min; v <= max; v++) if (!exclude.includes(v)) allowed.push(v);
    if (allowed.length === 0) throw new Error(`Rng.intExcept: nothing left in [${min}, ${max}]`);
    return this.pick(allowed);
  }

  /** Non-zero integer with absolute value in [lo, hi]; negative only when `allowNegative`. */
  signedInt(lo: number, hi: number, allowNegative: boolean): number {
    const v = this.int(lo, hi);
    return allowNegative && this.bool() ? -v : v;
  }

  bool(pTrue = 0.5): boolean {
    return this.next() < pTrue;
  }

  sign(): 1 | -1 {
    return this.bool() ? 1 : -1;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Pick using relative weights. */
  weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [item, w] of entries) {
      r -= w;
      if (r < 0) return item;
    }
    return entries[entries.length - 1]![0];
  }

  /** A shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  /** `k` distinct items. */
  sample<T>(items: readonly T[], k: number): T[] {
    return this.shuffle(items).slice(0, k);
  }

  /** An independent child stream, so optional extra draws never disturb the parent sequence. */
  fork(label: string | number): Rng {
    return new Rng(hashSeed(this.state, label));
  }
}
