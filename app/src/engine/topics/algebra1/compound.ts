/** Compound inequalities ("and" / "or") and absolute value inequalities, with number-line graphs. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, num, scaled, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { FLIP, isLess, isStrict, numberLineGraph, STRICT_SWAP, type Interval, type Rel } from './helpers';

/** One linear inequality `lhs rel c` whose solution is `x relSol t`. */
interface Part {
  lhs: string;
  /** Expanded `A x + B` (for the steps). */
  A: number;
  B: number;
  distributed: boolean;
  rel: Rel;
  c: number;
  t: Frac;
  relSol: Rel;
}

function makePart(rng: Rng, d: Difficulty, v: string, t: Frac, relSol: Rel, fractions: boolean): Part | null {
  const distributed = d === 'hard' && rng.bool(0.5);
  let A: number;
  let B: number;
  let lhs: string;
  if (distributed) {
    const mult = rng.signedInt(2, 5, true);
    const q = rng.signedInt(1, 6, true);
    A = mult;
    B = mult * q;
    lhs = scaled(mult, linear(1, q, v));
  } else {
    A = d === 'easy' ? rng.pick([1, 1, 2, 3, 4, 5]) : rng.signedInt(1, d === 'medium' ? 6 : 8, true);
    B = rng.signedInt(1, d === 'easy' ? 10 : 15, true);
    if (d !== 'easy' && rng.bool(0.25)) B = 0;
    lhs = linear(A, B, v);
  }
  if (!fractions && !t.isInt()) return null;
  const c = t.mul(A).add(B);
  if (!c.isInt() || Math.abs(c.value) > 60) return null;
  if (A === 1 && B === 0) return null;
  return { lhs, A, B, distributed, rel: A > 0 ? relSol : FLIP[relSol], c: c.value, t, relSol };
}

function partSteps(p: Part, v: string): string[] {
  const steps: string[] = [];
  const pre = `$${p.lhs} ${p.rel} ${p.c}$`;
  const s: string[] = [];
  if (p.distributed) s.push(`$${linear(p.A, p.B, v)} ${p.rel} ${p.c}$`);
  if (p.B !== 0) s.push(`$${sum([{ coef: p.A, sym: v }])} ${p.rel} ${p.c - p.B}$`);
  if (p.A !== 1) s.push(`$${v} ${p.relSol} ${num(p.t)}$${p.A < 0 ? ' (dividing by a negative reverses the sign)' : ''}`);
  steps.push(`${pre}: ${s.join(', ')}`);
  return steps;
}

const relTex = (v: string, r: Rel, t: Frac) => `${v} ${r} ${num(t)}`;
/** `lo r1 x r2 hi` with r1, r2 ∈ {<, ≤}. */
const between = (v: string, lo: Frac, r1: Rel, r2: Rel, hi: Frac) => `${num(lo)} ${r1} ${v} ${r2} ${num(hi)}`;

function pickBounds(rng: Rng, d: Difficulty, fractions: boolean): [Frac, Frac] {
  const R = d === 'easy' ? 6 : 8;
  return attempt('bounds', () => {
    const pick = () => (fractions && rng.bool(0.4) ? new Frac(rng.int(-R * 2, R * 2), 2) : new Frac(rng.int(-R, R)));
    const lo = pick();
    const hi = pick();
    if (hi.cmp(lo) <= 0 || hi.sub(lo).value < 1 || hi.sub(lo).value > 10) return null;
    return [lo, hi];
  });
}

function graphOf(points: Frac[], set: Interval[]) {
  return numberLineGraph(
    points.map((p) => p.value),
    set,
  );
}

const ALL = 'All real numbers';
const NONE = 'No solution';

export const compoundInequalities = defineTopic({
  id: 'alg1.compound-inequalities',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Compound Inequalities',
  description: 'Solve “and” and “or” compound inequalities and graph their solution sets.',
  instruction: (o) => (o.graph ? 'Solve each compound inequality and graph its solution.' : 'Solve each compound inequality.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Type',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'and', label: '“And” inequalities' },
        { value: 'or', label: '“Or” inequalities' },
      ],
    },
    opt.fractionAnswers(false),
    opt.variedVariables(false),
    { type: 'boolean', id: 'special', label: 'Include “All real numbers” / “No solution” (hard)', default: true },
    { type: 'boolean', id: 'graph', label: 'Graph on a number line', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const graph = boolOpt(ctx, 'graph');
    const formOpt = ctx.options.form as string;
    const isOr = formOpt === 'or' || (formOpt === 'mixed' && rng.bool(0.5));
    const special = boolOpt(ctx, 'special') && d === 'hard' && rng.bool(0.25);
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let set: Interval[];
    let wrong: Array<string | null>;
    let points: Frac[];

    if (!isOr && !special && (d === 'easy' || rng.bool(0.5))) {
      // chain: c1 r1 A x + B r2 c2
      const r = attempt('chain', () => {
        const [lo, hi] = pickBounds(rng, d, fractions);
        const r1 = rng.pick<Rel>(['<', '\\le']);
        const r2 = rng.pick<Rel>(['<', '\\le']);
        const A = d === 'easy' ? rng.pick([1, 2, 3, 4]) : rng.signedInt(1, 7, true);
        const B = rng.signedInt(1, 12, true);
        const cl = lo.mul(A).add(B);
        const ch = hi.mul(A).add(B);
        if (!cl.isInt() || !ch.isInt() || A === 1 && B === 0) return null;
        return { lo, hi, r1, r2, A, B, cl: cl.value, ch: ch.value };
      });
      const { lo, hi, r1, r2, A, B, cl, ch } = r;
      // A > 0: cl r1 Ax+B r2 ch ; A < 0: ch r2' … written in increasing order
      const [left, ra, rb, right] = A > 0 ? [cl, r1, r2, ch] : [ch, r2, r1, cl];
      question = m(`${left} ${ra} ${linear(A, B, v)} ${rb} ${right}`);
      if (B !== 0) steps.push(`${B > 0 ? 'Subtract' : 'Add'} $${Math.abs(B)}$ in all three parts: $${left - B} ${ra} ${sum([{ coef: A, sym: v }])} ${rb} ${right - B}$`);
      if (A < 0) {
        steps.push(`Divide all three parts by $${A}$ and reverse the signs: $${num(hi)} ${FLIP[r2]} ${v} ${FLIP[r1]} ${num(lo)}$`);
        steps.push(`Rewrite in increasing order: $${between(v, lo, r1, r2, hi)}$`);
      } else if (A !== 1) steps.push(`Divide all three parts by $${A}$: $${between(v, lo, r1, r2, hi)}$`);
      answer = m(between(v, lo, r1, r2, hi));
      set = [{ lo: lo.value, hi: hi.value, loOpen: isStrict(r1), hiOpen: isStrict(r2) }];
      points = [lo, hi];
      wrong = [
        m(between(v, lo, STRICT_SWAP[r1], STRICT_SWAP[r2], hi)),
        m(`${relTex(v, r1 === '<' ? '<' : '\\le', lo)} \\text{ or } ${relTex(v, r2 === '<' ? '>' : '\\ge', hi)}`),
        m(between(v, hi.neg(), r2, r1, lo.neg())),
      ];
    } else {
      // two separate inequalities joined by "and" / "or"
      const r = attempt('two-part', () => {
        let [lo, hi] = pickBounds(rng, d, fractions);
        let p1: Part | null;
        let p2: Part | null;
        if (isOr) {
          if (special) [lo, hi] = [hi, lo]; // overlapping rays: all real numbers
          p1 = makePart(rng, d, v, lo, rng.pick<Rel>(['<', '\\le']), fractions);
          p2 = makePart(rng, d, v, hi, rng.pick<Rel>(['>', '\\ge']), fractions);
        } else {
          if (special) [lo, hi] = [hi, lo]; // disjoint: no solution
          p1 = makePart(rng, d, v, lo, rng.pick<Rel>(['>', '\\ge']), fractions);
          p2 = makePart(rng, d, v, hi, rng.pick<Rel>(['<', '\\le']), fractions);
        }
        if (!p1 || !p2) return null;
        return { lo, hi, p1, p2 };
      });
      const { lo, hi } = r;
      let { p1, p2 } = r;
      const joiner = isOr ? '\\text{ or }' : '\\text{ and }';
      if (rng.bool(0.4)) [p1, p2] = [p2, p1];
      question = m(`${p1.lhs} ${p1.rel} ${p1.c} ${joiner} ${p2.lhs} ${p2.rel} ${p2.c}`);
      steps.push(...partSteps(p1, v), ...partSteps(p2, v));
      const low = p1.t.eq(lo) ? p1 : p2; // the part with the lower solution bound in the generated order
      const high = low === p1 ? p2 : p1;
      if (isOr) {
        const lowRel = low.relSol;
        const highRel = high.relSol;
        if (special) {
          steps.push('Together the two rays cover the whole number line.');
          answer = ALL;
          set = [{ lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true }];
        } else {
          answer = m(`${relTex(v, lowRel, lo)} \\text{ or } ${relTex(v, highRel, hi)}`);
          set = [
            { lo: -Infinity, hi: lo.value, loOpen: true, hiOpen: isStrict(lowRel) },
            { lo: hi.value, hi: Infinity, loOpen: isStrict(highRel), hiOpen: true },
          ];
        }
        wrong = [
          special ? NONE : m(between(v, lo, isStrict(lowRel) ? '<' : '\\le', isStrict(highRel) ? '<' : '\\le', hi)),
          special ? m(`${relTex(v, lowRel, hi)} \\text{ or } ${relTex(v, highRel, lo)}`) : m(`${relTex(v, FLIP[lowRel], lo)} \\text{ or } ${relTex(v, FLIP[highRel], hi)}`),
          special ? m(between(v, hi, isLess(lowRel) && isStrict(lowRel) ? '<' : '\\le', '\\le', lo)) : m(`${relTex(v, STRICT_SWAP[lowRel], lo)} \\text{ or } ${relTex(v, STRICT_SWAP[highRel], hi)}`),
          special ? null : ALL,
        ];
      } else {
        const r1 = isStrict(low.relSol) ? '<' : '\\le';
        const r2 = isStrict(high.relSol) ? '<' : '\\le';
        if (special) {
          steps.push('No number satisfies both inequalities.');
          answer = NONE;
          set = [];
          wrong = [ALL, m(`${relTex(v, low.relSol, lo)} \\text{ or } ${relTex(v, high.relSol, hi)}`), m(between(v, hi, r2, r1, lo))];
        } else {
          answer = m(between(v, lo, r1 as Rel, r2 as Rel, hi));
          set = [{ lo: lo.value, hi: hi.value, loOpen: isStrict(low.relSol), hiOpen: isStrict(high.relSol) }];
          wrong = [
            m(`${relTex(v, FLIP[low.relSol], lo)} \\text{ or } ${relTex(v, FLIP[high.relSol], hi)}`),
            m(between(v, lo, STRICT_SWAP[r1 as Rel], STRICT_SWAP[r2 as Rel], hi)),
            NONE,
          ];
        }
      }
      points = [lo, hi];
    }
    const g = graphOf(points, set);
    const distractors = distinctDistractors(answer, wrong, (k) => m(between(v, points[0]!.sub(k), '<', '<', points[1]!.add(k))));
    return {
      question,
      answer,
      steps,
      distractors,
      diagram: graph ? g.blank : undefined,
      answerDiagram: graph ? g.solved : undefined,
      check: { kind: 'solset', variable: v, probes: points.map((p) => p.value) },
    };
  },
});

// ================================================================ absolute value inequalities

export const absoluteValueInequalities = defineTopic({
  id: 'alg1.abs-inequalities',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Absolute Value Inequalities',
  description: 'Isolate the absolute value, then write and solve the equivalent “and” or “or” inequality.',
  instruction: (o) => (o.graph ? 'Solve each inequality and graph its solution.' : 'Solve each inequality.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    opt.fractionAnswers(false),
    opt.variedVariables(false),
    { type: 'boolean', id: 'special', label: 'Include “All real numbers” / “No solution” (hard)', default: true },
    { type: 'boolean', id: 'graph', label: 'Graph on a number line', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const graph = boolOpt(ctx, 'graph');
    const special = boolOpt(ctx, 'special') && d === 'hard' && rng.bool(0.2);
    const relIso = rng.pick<Rel>(['<', '\\le', '>', '\\ge']);
    const p = attempt('abs-inequality', () => {
      const a = d === 'easy' ? rng.pick([1, 1, 2, 3]) : rng.signedInt(1, d === 'medium' ? 5 : 7, true);
      let C: number;
      let b: number;
      let lo = new Frac(0);
      let hi = new Frac(0);
      if (special) {
        C = -rng.int(1, 9);
        b = rng.signedInt(1, 10, true);
      } else if (fractions && Math.abs(a) > 1 && rng.bool(0.7)) {
        C = rng.int(1, 12);
        b = rng.signedInt(0, 12, true);
        const r1 = new Frac(C - b, a);
        const r2 = new Frac(-C - b, a);
        if (r1.isInt() && r2.isInt()) return null;
        [lo, hi] = r1.cmp(r2) < 0 ? [r1, r2] : [r2, r1];
      } else {
        const L = rng.int(-9, 6);
        const H = L + rng.int(1, 9);
        if ((Math.abs(a) * (H - L)) % 2 !== 0) return null;
        C = (Math.abs(a) * (H - L)) / 2;
        b = (-a * (H + L)) / 2;
        lo = new Frac(L);
        hi = new Frac(H);
      }
      if (Math.abs(b) > 20 || C > 30 || (a === 1 && b === 0)) return null;
      const outer = d === 'easy' ? 1 : d === 'medium' ? rng.pick([1, 1, 2, 3, 4]) : rng.signedInt(2, 6, true);
      const k = d === 'easy' ? 0 : d === 'medium' ? (outer === 1 ? rng.signedInt(1, 10, true) : 0) : rng.signedInt(0, 12, true);
      const c = outer * C + k;
      if (Math.abs(c) > 99) return null;
      return { a, b, C, lo, hi, outer, k, c };
    });
    const { a, b, C, lo, hi, outer, k, c } = p;
    const inner = linear(a, b, v);
    const abs = `\\left|${inner}\\right|`;
    const qRel = outer > 0 ? relIso : FLIP[relIso];
    const question = m(`${sum([{ coef: outer, sym: abs }, { coef: k }])} ${qRel} ${c}`);
    const steps: string[] = [];
    if (k !== 0) steps.push(`${k > 0 ? 'Subtract' : 'Add'} $${Math.abs(k)}$ ${k > 0 ? 'from' : 'to'} both sides: $${sum([{ coef: outer, sym: abs }])} ${qRel} ${c - k}$`);
    if (outer !== 1) steps.push(`Divide both sides by $${outer}$${outer < 0 ? ' and reverse the sign' : ''}: $${abs} ${relIso} ${C}$`);
    const less = isLess(relIso);
    const strict = isStrict(relIso);
    const r1: Rel = strict ? '<' : '\\le';
    let answer: string;
    let set: Interval[];
    let wrong: Array<string | null>;
    const orForm = (L: Frac, H: Frac) => m(`${v} ${strict ? '<' : '\\le'} ${num(L)} \\text{ or } ${v} ${strict ? '>' : '\\ge'} ${num(H)}`);
    const andForm = (L: Frac, H: Frac) => m(between(v, L, r1, r1, H));
    if (C < 0) {
      steps.push(less ? 'An absolute value is never negative, so there is no solution.' : 'An absolute value is always greater than a negative number.');
      answer = less ? NONE : ALL;
      set = less ? [] : [{ lo: -Infinity, hi: Infinity, loOpen: true, hiOpen: true }];
      const f1 = new Frac(-C - b, a);
      const f2 = new Frac(C - b, a);
      const [L, H] = f1.cmp(f2) < 0 ? [f1, f2] : [f2, f1];
      wrong = [less ? ALL : NONE, andForm(L, H), orForm(L, H)];
    } else {
      steps.push(
        less
          ? `Write as an “and” inequality: $${-C} ${r1} ${inner} ${r1} ${C}$`
          : `Write as an “or” inequality: $${inner} ${strict ? '<' : '\\le'} ${-C} \\text{ or } ${inner} ${strict ? '>' : '\\ge'} ${C}$`,
      );
      answer = less ? andForm(lo, hi) : orForm(lo, hi);
      steps.push(`Solve for $${v}$${a < 0 ? " (dividing by a negative reverses the signs)" : ""}: ${answer}`);
      set = less
        ? [{ lo: lo.value, hi: hi.value, loOpen: strict, hiOpen: strict }]
        : [
            { lo: -Infinity, hi: lo.value, loOpen: true, hiOpen: strict },
            { lo: hi.value, hi: Infinity, loOpen: strict, hiOpen: true },
          ];
      const naiveHi = new Frac(C - b, a);
      wrong = [
        less ? orForm(lo, hi) : andForm(lo, hi),
        less ? m(between(v, lo, strict ? '\\le' : '<', strict ? '\\le' : '<', hi)) : orForm(hi.neg(), lo.neg()),
        m(`${v} ${a > 0 ? relIso : FLIP[relIso]} ${num(naiveHi)}`),
        less ? andForm(hi.neg(), lo.neg()) : null,
      ];
    }
    const pts = C < 0 ? [new Frac(-C - b, a), new Frac(C - b, a)] : [lo, hi];
    const g = graphOf(pts, set);
    const distractors = distinctDistractors(answer, wrong, (j) => andForm(pts[0]!.sub(j), pts[1]!.add(j)));
    return {
      question,
      answer,
      steps,
      distractors,
      diagram: graph ? g.blank : undefined,
      answerDiagram: graph ? g.solved : undefined,
      check: { kind: 'solset', variable: v, probes: pts.map((x) => x.value) },
    };
  },
});
