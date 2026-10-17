/** Helpers for writing topic generators. */
import { Frac, type FracLike } from './fraction';
import type { Rng } from './rng';
import type {
  BooleanOptionDef,
  Difficulty,
  GeneratorContext,
  OptionDef,
  OptionValues,
  RichText,
  SelectOptionDef,
  TopicGenerator,
} from './types';

export function defineTopic(t: TopicGenerator): TopicGenerator {
  const ids = new Set<string>();
  for (const o of t.options) {
    if (ids.has(o.id)) throw new Error(`${t.id}: duplicate option ${o.id}`);
    ids.add(o.id);
  }
  return t;
}

export function boolOpt(ctx: GeneratorContext, id: string): boolean {
  return ctx.options[id] === true;
}

export function strOpt(ctx: GeneratorContext, id: string): string {
  const v = ctx.options[id];
  return typeof v === 'string' ? v : '';
}

/** Fill in defaults and drop unknown or ill-typed values. */
export function resolveOptions(defs: readonly OptionDef[], given: OptionValues | undefined): OptionValues {
  const out: OptionValues = {};
  for (const d of defs) {
    const v = given?.[d.id];
    if (d.type === 'boolean') out[d.id] = typeof v === 'boolean' ? v : d.default;
    else out[d.id] = typeof v === 'string' && d.choices.some((c) => c.value === v) ? v : d.default;
  }
  return out;
}

export function instructionFor(topic: TopicGenerator, options: OptionValues): string {
  return typeof topic.instruction === 'function' ? topic.instruction(options) : topic.instruction;
}

/** Pick by difficulty. */
export function byDifficulty<T>(d: Difficulty, values: { easy: T; medium: T; hard: T }): T {
  return values[d];
}

/** Retry a randomized construction until it satisfies its own constraints. */
export function attempt<T>(label: string, build: (n: number) => T | null, tries = 2000): T {
  for (let i = 0; i < tries; i++) {
    const r = build(i);
    if (r !== null) return r;
  }
  throw new Error(`${label}: no valid problem after ${tries} tries`);
}

/** Variable letters that cannot be confused with constants or coefficient names (no a–e, i, l, o). */
export const VARIABLES = ['x', 'x', 'n', 'k', 'm', 'p', 'r', 'v', 'w', 'x'] as const;

export function pickVar(rng: Rng, varied: boolean): string {
  return varied ? rng.pick(VARIABLES) : 'x';
}

/**
 * Deduplicate distractors against the answer and each other, then top up
 * with `fallback(k)` (k = 1, 2, …) until there are `count`.
 */
export function distinctDistractors(
  answer: RichText,
  candidates: ReadonlyArray<RichText | null | undefined>,
  fallback: (k: number) => RichText | null,
  count = 3,
): RichText[] {
  const seen = new Set<string>([normalize(answer)]);
  const out: RichText[] = [];
  const push = (c: RichText | null | undefined) => {
    if (!c || out.length >= count) return;
    const key = normalize(c);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };
  candidates.forEach(push);
  for (let k = 1; out.length < count && k < 200; k++) push(fallback(k));
  return out;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, '');
}

/** Numeric fallback offsets: +1, -1, +2, -2, … */
export function offset(k: number): number {
  return k % 2 === 1 ? (k + 1) / 2 : -k / 2;
}

/** Common option definitions. */
export const opt = {
  negatives(def = true): BooleanOptionDef {
    return { type: 'boolean', id: 'negatives', label: 'Allow negative numbers', default: def };
  },
  fractionAnswers(def = false): BooleanOptionDef {
    return {
      type: 'boolean',
      id: 'fractions',
      label: 'Allow fractional answers',
      default: def,
      help: 'Off: every answer is an integer.',
    };
  },
  variedVariables(def = true): BooleanOptionDef {
    return { type: 'boolean', id: 'variedVars', label: 'Vary the variable letter', default: def };
  },
  rounding(def: 'round' | 'exact' = 'round'): SelectOptionDef {
    return {
      type: 'select',
      id: 'answerForm',
      label: 'Answer form',
      default: def,
      choices: [
        { value: 'round', label: 'Round to nearest tenth' },
        { value: 'exact', label: 'Exact (radicals / π)' },
      ],
    };
  },
  units(def = true): BooleanOptionDef {
    return { type: 'boolean', id: 'units', label: 'Show units', default: def };
  },
};

/** Smallest positive integer whose product with `x` is an integer. */
export function denominatorOf(x: FracLike): number {
  return Frac.of(x).d;
}

export const UNITS = ['cm', 'm', 'in', 'ft', 'yd', 'mm', 'km', 'mi'] as const;
