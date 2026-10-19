/**
 * Solving multi-step linear equations, e.g. `-18 - 6k = 6(1 + 3k)`.
 *
 * Construction: pick the shape and every coefficient except one constant,
 * pick the solution, then solve for that constant so the equation balances.
 * Rejection sampling enforces the option constraints (signs, sizes,
 * integer vs fractional solution).
 */
import { Frac, gcd } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar } from '../../generator';
import type { Rng } from '../../rng';
import { m, num, sum, type Term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Chunk =
  | { kind: 'var'; c: number }
  | { kind: 'const'; c: number }
  | { kind: 'group'; m: number; p: number; q: number; constFirst: boolean };

type Side = Chunk[];

/** Shapes per difficulty; V = variable term, C = constant, G = distributed group. */
const SHAPES: Record<Difficulty, Array<[string, string]>> = {
  easy: [
    ['VCV', 'C'],
    ['G', 'C'],
    ['CV', 'C'],
    ['VVC', 'C'],
  ],
  medium: [
    ['VC', 'VC'],
    ['G', 'VC'],
    ['GV', 'C'],
    ['CG', 'C'],
    ['CV', 'G'],
  ],
  hard: [
    ['GV', 'G'],
    ['VG', 'GC'],
    ['GC', 'VG'],
    ['CVG', 'VC'],
    ['G', 'GV'],
  ],
};

interface Ranges {
  coef: number;
  mult: number;
  constant: number;
  solution: number;
  freeConstant: number;
}

const RANGES: Record<Difficulty, Ranges> = {
  easy: { coef: 6, mult: 5, constant: 12, solution: 8, freeConstant: 40 },
  medium: { coef: 8, mult: 6, constant: 15, solution: 9, freeConstant: 60 },
  hard: { coef: 9, mult: 8, constant: 20, solution: 10, freeConstant: 90 },
};

interface Linear {
  a: Frac;
  b: Frac;
}

function evalSide(side: Side): Linear {
  let a = 0;
  let b = 0;
  for (const ch of side) {
    if (ch.kind === 'var') a += ch.c;
    else if (ch.kind === 'const') b += ch.c;
    else {
      a += ch.m * ch.p;
      b += ch.m * ch.q;
    }
  }
  return { a: new Frac(a), b: new Frac(b) };
}

/** The classic slip: distributing to the first inner term only. */
function evalSideMisDistributed(side: Side): Linear {
  let a = 0;
  let b = 0;
  for (const ch of side) {
    if (ch.kind === 'var') a += ch.c;
    else if (ch.kind === 'const') b += ch.c;
    else {
      a += ch.m * ch.p;
      b += ch.q;
    }
  }
  return { a: new Frac(a), b: new Frac(b) };
}

function renderSide(side: Side, v: string): string {
  let out = '';
  side.forEach((ch, i) => {
    let neg: boolean;
    let body: string;
    if (ch.kind === 'var') {
      neg = ch.c < 0;
      body = Math.abs(ch.c) === 1 ? v : `${Math.abs(ch.c)}${v}`;
    } else if (ch.kind === 'const') {
      neg = ch.c < 0;
      body = String(Math.abs(ch.c));
    } else {
      neg = ch.m < 0;
      const inner: Term[] = ch.constFirst
        ? [{ coef: ch.q }, { coef: ch.p, sym: v }]
        : [{ coef: ch.p, sym: v }, { coef: ch.q }];
      body = `${Math.abs(ch.m) === 1 ? '' : Math.abs(ch.m)}(${sum(inner)})`;
    }
    if (i === 0) out = neg ? `-${body}` : body;
    else out += neg ? ` - ${body}` : ` + ${body}`;
  });
  return out;
}

function expandedTerms(side: Side, v: string): Term[] {
  const out: Term[] = [];
  for (const ch of side) {
    if (ch.kind === 'var') out.push({ coef: ch.c, sym: v });
    else if (ch.kind === 'const') out.push({ coef: ch.c });
    else if (ch.constFirst) out.push({ coef: ch.m * ch.q }, { coef: ch.m * ch.p, sym: v });
    else out.push({ coef: ch.m * ch.p, sym: v }, { coef: ch.m * ch.q });
  }
  return out;
}

function needsCombining(side: Side): boolean {
  const terms = expandedTerms(side, 'x');
  const vars = terms.filter((t) => t.sym).length;
  return vars > 1 || terms.length - vars > 1;
}

function hasGroup(side: Side): boolean {
  return side.some((ch) => ch.kind === 'group');
}

function linTex(l: Linear, v: string): string {
  return sum([
    { coef: l.a, sym: v },
    { coef: l.b },
  ]);
}

function moveVerb(amount: Frac, what: string): string {
  return amount.sign > 0 ? `Subtract $${what}$ from both sides` : `Add $${what}$ to both sides`;
}

function buildSide(rng: Rng, shape: string, r: Ranges, negatives: boolean): Side {
  const coef = () => rng.signedInt(1, r.coef, negatives);
  return [...shape].map<Chunk>((k) => {
    if (k === 'V') return { kind: 'var', c: coef() };
    if (k === 'C') return { kind: 'const', c: rng.signedInt(1, r.constant, negatives) };
    return {
      kind: 'group',
      m: rng.signedInt(2, r.mult, negatives),
      p: coef(),
      q: rng.signedInt(1, r.constant, negatives),
      constFirst: rng.bool(0.3),
    };
  });
}

type Solution = { kind: 'one'; x: Frac } | { kind: 'none' } | { kind: 'all' };

interface Built {
  left: Side;
  right: Side;
  solution: Solution;
}

function build(rng: Rng, difficulty: Difficulty, negatives: boolean, fractions: boolean, special: boolean): Built {
  const r = RANGES[difficulty];
  const wantSpecial = special && difficulty !== 'easy' && rng.bool(0.25);
  return attempt('linear-multistep', () => {
    let [ls, rs] = rng.pick(SHAPES[difficulty]);
    if (wantSpecial && !rs.includes('V') && !rs.includes('G')) return null;
    if (rng.bool()) [ls, rs] = [rs, ls];
    const left = buildSide(rng, ls, r, negatives);
    const right = buildSide(rng, rs, r, negatives);

    // The constant we solve for: prefer a plain constant, else a group's inner constant.
    const slots: Array<{ side: Side; idx: number; sign: 1 | -1 }> = [];
    left.forEach((ch, idx) => ch.kind !== 'var' && slots.push({ side: left, idx, sign: 1 }));
    right.forEach((ch, idx) => ch.kind !== 'var' && slots.push({ side: right, idx, sign: -1 }));
    const plain = slots.filter((s) => s.side[s.idx]!.kind === 'const');
    const slot = rng.pick(plain.length ? plain : slots);
    const chunk = slot.side[slot.idx]!;
    if (chunk.kind === 'var') return null;
    // Zero out the free constant, then compute what it must contribute.
    if (chunk.kind === 'const') chunk.c = 0;
    else chunk.q = 0;

    let L = evalSide(left);
    let R = evalSide(right);
    let A = L.a.sub(R.a);

    if (wantSpecial) {
      // Make the variable cancel by adjusting a variable term on the right.
      const vIdx = right.findIndex((ch) => ch.kind === 'var');
      if (vIdx < 0) return null;
      const v = right[vIdx] as { kind: 'var'; c: number };
      v.c += A.value;
      if (v.c === 0 || (!negatives && v.c < 0) || Math.abs(v.c) > r.coef + 4) return null;
      L = evalSide(left);
      R = evalSide(right);
      A = L.a.sub(R.a);
      if (!A.isZero()) return null;
    } else if (A.isZero()) return null;

    let solution: Solution;
    // Contribution needed from the free constant: L(x0) + s·K = R(x0)  ⇒  s·K = R(x0) - L(x0)
    let needed: Frac;
    if (wantSpecial) {
      const identity = rng.bool();
      const delta = identity ? 0 : rng.signedInt(1, 8, true);
      needed = R.b.sub(L.b).add(delta);
      solution = identity ? { kind: 'all' } : { kind: 'none' };
    } else {
      let x0: Frac;
      if (fractions) {
        const divisors = [2, 3, 4, 5, 6, 7, 8, 9].filter((d) => A.n % d === 0);
        if (!divisors.length) return null;
        const d = rng.pick(divisors);
        const n = rng.signedInt(1, r.solution * d, negatives);
        x0 = new Frac(n, d);
        if (x0.isInt() || Math.abs(x0.value) > r.solution) return null;
      } else {
        x0 = new Frac(rng.signedInt(0, r.solution, negatives));
        if (x0.isZero() && rng.bool(0.7)) return null;
      }
      needed = R.a.mul(x0).add(R.b).sub(L.a.mul(x0).add(L.b));
      solution = { kind: 'one', x: x0 };
    }
    let K = needed.mul(slot.sign);
    if (chunk.kind === 'group') K = K.div(chunk.m);
    if (!K.isInt() || K.isZero() || Math.abs(K.value) > r.freeConstant) return null;
    if (!negatives && K.sign < 0) return null;
    if (chunk.kind === 'const') {
      chunk.c = K.value;
    } else {
      if (Math.abs(K.value) > r.constant + 10) return null;
      chunk.q = K.value;
    }
    return { left, right, solution };
  });
}

function solveSteps(left: Side, right: Side, v: string): { steps: string[]; sol: Solution } {
  const steps: string[] = [];
  if (hasGroup(left) || hasGroup(right)) {
    steps.push(`Distribute: $${sum(expandedTerms(left, v))} = ${sum(expandedTerms(right, v))}$`);
  }
  const L = evalSide(left);
  const R = evalSide(right);
  if (needsCombining(left) || needsCombining(right)) {
    steps.push(`Combine like terms: $${linTex(L, v)} = ${linTex(R, v)}$`);
  }
  const A = L.a.sub(R.a);
  if (A.isZero()) {
    if (!R.a.isZero()) steps.push(`${moveVerb(R.a, sum([{ coef: R.a.abs(), sym: v }]))}: $${num(L.b)} = ${num(R.b)}$`);
    const all = L.b.eq(R.b);
    steps.push(all ? 'The statement is always true.' : 'The statement is never true.');
    return { steps, sol: all ? { kind: 'all' } : { kind: 'none' } };
  }
  // Collect the variable on the side where its coefficient ends up positive.
  const varLeft = A.sign > 0 || R.a.isZero();
  const coef = varLeft ? A : A.neg();
  const varConst = varLeft ? L.b : R.b;
  const otherConst = varLeft ? R.b : L.b;
  const moved = varLeft ? R.a : L.a;
  const eqn = (lhs: string, rhs: string) => (varLeft ? `${lhs} = ${rhs}` : `${rhs} = ${lhs}`);
  if (!moved.isZero()) {
    steps.push(
      `${moveVerb(moved, sum([{ coef: moved.abs(), sym: v }]))}: $${eqn(linTex({ a: coef, b: varConst }, v), num(otherConst))}$`,
    );
  }
  const rhs = otherConst.sub(varConst);
  if (!varConst.isZero()) {
    steps.push(`${moveVerb(varConst, num(varConst.abs()))}: $${eqn(sum([{ coef, sym: v }]), num(rhs))}$`);
  }
  const x = rhs.div(coef);
  if (!coef.eq(1)) {
    const absN = Math.abs(rhs.n);
    const absD = Math.abs(coef.n);
    const shown =
      !x.isInt() && gcd(absN, absD) > 1 ? `${x.sign < 0 ? '-' : ''}\\frac{${absN}}{${absD}} = ${num(x)}` : num(x);
    steps.push(`Divide both sides by $${num(coef)}$: $${v} = ${shown}$`);
  } else if (!varLeft) {
    steps.push(`$${v} = ${num(x)}$`);
  }
  return { steps, sol: { kind: 'one', x } };
}

function answerText(sol: Solution, v: string): string {
  if (sol.kind === 'none') return 'No solution';
  if (sol.kind === 'all') return 'All real numbers';
  return m(`${v} = ${num(sol.x)}`);
}

export const linearMultiStep = defineTopic({
  id: 'alg1.linear.multistep',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Multi-Step Equations',
  description: 'Distribute, combine like terms and solve, with variables on one or both sides.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    opt.negatives(true),
    opt.fractionAnswers(false),
    opt.variedVariables(true),
    {
      type: 'boolean',
      id: 'special',
      label: 'Include “no solution” / “all real numbers”',
      default: false,
      help: 'Medium and hard only: about one problem in four has no solution or infinitely many.',
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const { left, right } = build(rng, difficulty, negatives, boolOpt(ctx, 'fractions'), boolOpt(ctx, 'special'));
    const { steps, sol } = solveSteps(left, right, v);
    const answer = answerText(sol, v);

    let distractors: string[];
    if (sol.kind === 'one') {
      const x0 = sol.x;
      const wrong = (l: Linear, r: Linear): Frac | null => {
        const a = l.a.sub(r.a);
        return a.isZero() ? null : r.b.sub(l.b).div(a);
      };
      const L = evalSide(left);
      const R = evalSide(right);
      const candidates = [
        x0.neg(),
        wrong(evalSideMisDistributed(left), evalSideMisDistributed(right)),
        wrong({ a: L.a, b: L.b.neg() }, R),
        x0.isZero() ? null : x0.inv(),
      ];
      const unitStep = new Frac(1, x0.d);
      distractors = distinctDistractors(
        answer,
        candidates.map((c) => (c ? answerText({ kind: 'one', x: c }, v) : null)),
        (k) => answerText({ kind: 'one', x: x0.add(unitStep.mul(offset(k))) }, v),
      );
    } else {
      distractors = distinctDistractors(
        answer,
        [answerText({ kind: sol.kind === 'none' ? 'all' : 'none' }, v), m(`${v} = 0`), m(`${v} = 1`)],
        (k) => m(`${v} = ${k + 1}`),
      );
    }

    return {
      question: m(`${renderSide(left, v)} = ${renderSide(right, v)}`),
      answer,
      steps,
      distractors,
      check: { kind: 'linear', variable: v, solution: sol.kind === 'one' ? sol.x.value : sol.kind },
    };
  },
});

