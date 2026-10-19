/** Inverses of exponential and logarithmic functions. */
import { Frac } from '../../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { linear, m, sum, term } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, fr, logOf, powTex, type Base } from './common';

export interface InvFn {
  type: 'exp' | 'log';
  b: Base;
  a: Frac;
  h: number;
  k: number;
}

function plus(s: string, k: number): string {
  return k === 0 ? s : k > 0 ? `${s} + ${k}` : `${s} - ${-k}`;
}

/** a·b^(x−h)+k  or  a·log_b(x−h)+k */
export function fnTex(f: InvFn, v = 'x'): string {
  const inner = linear(1, -f.h, v);
  if (f.type === 'log') return plus(term(f.a, logOf(f.b, inner)), f.k);
  const core = powTex(f.b, inner);
  const ac = f.a.eq(1) ? core : f.a.eq(-1) ? `-${core}` : `${f.a.toTex()} \\cdot ${core}`;
  return plus(ac, f.k);
}

/** (x − k)/a in tidy form. */
function solvedFor(a: Frac, k: number): string {
  const inv = a.inv();
  if (inv.isInt()) {
    if (inv.eq(1)) return linear(1, -k);
    if (inv.eq(-1)) return sum([{ coef: k }, { coef: -1, sym: 'x' }]);
    return linear(inv, inv.mul(-k));
  }
  const s = a.sign;
  const top = s > 0 ? linear(1, -k) : k === 0 ? 'x' : sum([{ coef: k }, { coef: -1, sym: 'x' }]);
  const den = a.abs();
  const fracT = den.isInt() ? `\\frac{${top}}{${den.toTex()}}` : `\\frac{${den.d}(${top})}{${den.n}}`;
  return s < 0 && k === 0 ? `-${fracT}` : fracT;
}

/** The inverse's right-hand side, with optionally perturbed parameters (for distractors). */
export function inverseTex(f: InvFn): string {
  const u = solvedFor(f.a, f.k);
  if (f.type === 'exp') return plus(logOf(f.b, u), f.h);
  return plus(powTex(f.b, u), f.h);
}

export function pickInvFn(rng: Rng, d: Difficulty, type: 'exp' | 'log'): InvFn {
  return attempt('inverse-fn', () => {
    const bases: Base[] = [fr(2), fr(3), fr(4), fr(5), fr(6), fr(7)];
    if (d !== 'easy') bases.push(fr(10), 'e');
    if (d === 'hard') bases.push(fr(1, 2), 'e');
    const b = rng.pick(bases);
    const a = d === 'easy' ? fr(1) : d === 'medium' ? rng.pick([fr(1), fr(1), fr(2), fr(3), fr(-1)]) : rng.pick([fr(2), fr(3), fr(-2), fr(1, 2), fr(4), fr(-1), fr(5)]);
    let h = rng.int(-6, 6);
    let k = rng.int(-6, 6);
    if (d === 'easy') {
      if (rng.bool()) h = 0;
      else k = 0;
    } else if (d === 'hard' && (h === 0 || k === 0)) return null;
    if (d === 'medium' && h === 0 && k === 0) return null;
    // base-10 logs in an answer are real-only: keep (x − k)/a positive for x > 0
    if (type === 'exp' && b !== 'e' && b.eq(10) && (a.sign < 0 || k > 0)) return null;
    return { type, b, a, h, k };
  });
}

/** One "find the inverse" problem for the function f. */
export function inverseProblem(f: InvFn): ProblemContent {
  const fx = fnTex(f);
  const g = inverseTex(f);
  const answer = m(`f^{-1}(x) = ${g}`);
  const u = solvedFor(f.a, f.k);
  const steps =
    f.type === 'exp'
      ? [
          `Swap ${m('x')} and ${m('y')}: ${m(`x = ${fnTex(f, 'y')}`)}`,
          `Isolate the power: ${m(`${powTex(f.b, linear(1, -f.h, 'y'))} = ${u}`)}`,
          `Rewrite in logarithmic form: ${m(`${linear(1, -f.h, 'y')} = ${logOf(f.b, u)}`)}`,
          `${m(`f^{-1}(x) = ${g}`)}`,
        ]
      : [
          `Swap ${m('x')} and ${m('y')}: ${m(`x = ${fnTex(f, 'y')}`)}`,
          `Isolate the logarithm: ${m(`${logOf(f.b, linear(1, -f.h, 'y'))} = ${u}`)}`,
          `Rewrite in exponential form: ${m(`${linear(1, -f.h, 'y')} = ${powTex(f.b, u)}`)}`,
          `${m(`f^{-1}(x) = ${g}`)}`,
        ];
  const wrong = (p: Partial<InvFn>) => m(`f^{-1}(x) = ${inverseTex({ ...f, ...p })}`);
  const swapped: InvFn = { ...f, type: f.type === 'exp' ? 'log' : 'exp' };
  const distractors = distinctDistractors(
    answer,
    [
      f.h !== 0 ? wrong({ h: -f.h }) : null,
      f.k !== 0 ? wrong({ k: -f.k }) : null,
      f.h !== f.k ? wrong({ h: f.k, k: f.h }) : null,
      f.a.eq(1) ? null : wrong({ a: f.a.inv() }),
      m(`f^{-1}(x) = ${fnTex(swapped)}`),
    ],
    (j) => wrong({ h: f.h + offset(j) }),
  );
  return {
    question: m(`f(x) = ${fx}`),
    answer,
    steps,
    distractors,
    check: { kind: 'inverse', f: fx, positive: true },
  };
}

export const inversesExpLog = defineTopic({
  id: 'alg2.explog.inverses',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Inverses of Exponential and Logarithmic Functions',
  description: 'Find the inverse of a transformed exponential or logarithmic function.',
  instruction: 'Find the inverse of each function.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Functions',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Exponential and logarithmic' },
        { value: 'exp', label: 'Exponential only' },
        { value: 'log', label: 'Logarithmic only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'type');
    const type = t === 'exp' || t === 'log' ? t : rng.pick(['exp', 'log'] as const);
    return inverseProblem(pickInvFn(rng, difficulty, type));
  },
});
