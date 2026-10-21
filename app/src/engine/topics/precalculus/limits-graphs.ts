/** Limits from graphs and tables: one-sided limits, two-sided limits and function values. */
import { graphPlane, plot } from '../../diagram';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { decimal, m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { buildPieces, pieceAt } from './piecewise';

type Ask = 'left' | 'right' | 'both' | 'value';
const DNE = 'Does not exist';
const UNDEF = 'Undefined';

const limTex = (a: number, side: '' | '-' | '+') => `\\lim_{x \\to ${side ? `${a}^{${side}}` : a}} f(x)`;
const askTex = (ask: Ask, a: number) => (ask === 'value' ? `f(${a})` : limTex(a, ask === 'left' ? '-' : ask === 'right' ? '+' : ''));
const result = (ask: Ask, a: number, v: number | null) => (v === null ? (ask === 'value' ? UNDEF : DNE) : m(`${askTex(ask, a)} = ${v}`));

interface Hole {
  x: number;
  y: number;
  /** value of f at the hole, or null when undefined there */
  fill: number | null;
}

function graphProblem(rng: Rng, d: Difficulty, askOpt: string): ProblemContent {
  const { pieces, hole } = attempt('limit-graph', () => {
    const pieces = buildPieces(rng, d, d === 'easy' ? 2 : 3, 6);
    let hole: Hole | null = null;
    if (rng.bool(d === 'easy' ? 0.3 : 0.5)) {
      const linear = pieces.filter((pc) => pc.p.degree <= 1);
      if (!linear.length) return null;
      const pc = rng.pick(linear);
      const lo = pc.lo ?? -7;
      const hi = pc.hi ?? 7;
      const cands = [];
      for (let x = lo + 1; x <= hi - 1; x++) if (pc.p.eval(x).isInt() && Math.abs(pc.p.evalNum(x)) <= 6) cands.push(x);
      if (!cands.length) return null;
      const x = rng.pick(cands);
      const y = pc.p.evalNum(x);
      const fill = rng.bool(0.6) ? rng.intExcept(-6, 6, [y]) : null;
      hole = { x, y, fill };
    }
    return { pieces, hole };
  });
  const breaks = pieces.slice(1).map((pc) => pc.lo!);
  const points = hole ? [...breaks, hole.x] : breaks;
  const a = rng.pick(points);
  const ask: Ask = askOpt === 'any' ? rng.pick(['left', 'right', 'both', 'value']) : (askOpt as Ask);

  const leftPc = pieces.find((pc) => (pc.lo === null || pc.lo < a) && (pc.hi === null || pc.hi >= a))!;
  const rightPc = pieces.find((pc) => (pc.lo === null || pc.lo <= a) && (pc.hi === null || pc.hi > a))!;
  const L = leftPc.p.evalNum(a);
  const R = rightPc.p.evalNum(a);
  const atHole = hole !== null && hole.x === a;
  const fa = atHole ? hole!.fill : pieceAt(pieces, a).p.evalNum(a);
  const value = ask === 'left' ? L : ask === 'right' ? R : ask === 'both' ? (L === R ? L : null) : fa;
  const answer = result(ask, a, value);
  const cands = [result(ask, a, ask === 'left' ? R : L), result(ask, a, fa), result(ask, a, null), result(ask, a, (value ?? L) + 1), result(ask, a, (value ?? R) - 1)];

  const { b, w } = graphPlane(8, 2);
  for (const pc of pieces) plot(b, (x) => pc.p.evalNum(x), { ...w, x0: pc.lo ?? w.x0, x1: pc.hi ?? w.x1 }, {}, 120);
  const dots: Array<[number, number, boolean]> = [];
  for (const pc of pieces) {
    for (const [e, closed] of [
      [pc.lo, pc.loC],
      [pc.hi, pc.hiC],
    ] as Array<[number | null, boolean]>) {
      if (e === null) continue;
      const y = pc.p.evalNum(e);
      const same = dots.find((dd) => dd[0] === e && dd[1] === y);
      if (same) same[2] = same[2] && !closed;
      else dots.push([e, y, !closed]);
    }
  }
  if (hole) {
    dots.push([hole.x, hole.y, true]);
    if (hole.fill !== null) dots.push([hole.x, hole.fill, false]);
  }
  for (const [x, y, open] of dots) b.dot([x, y], open, 'accent');

  const steps: string[] = [];
  if (ask === 'left' || ask === 'both') steps.push(`From the left, the graph approaches ${m(`y = ${L}`)}.`);
  if (ask === 'right' || ask === 'both') steps.push(`From the right, the graph approaches ${m(`y = ${R}`)}.`);
  if (ask === 'both') steps.push(L === R ? 'The one-sided limits agree.' : 'The one-sided limits differ, so the limit does not exist.');
  if (ask === 'value') steps.push(fa === null ? `There is no closed dot on the graph at ${m(`x = ${a}`)}.` : `The closed dot at ${m(`x = ${a}`)} has ${m(`y = ${fa}`)}.`);
  steps.push(answer);
  return {
    question: `Use the graph to find ${m(askTex(ask, a))}.`,
    answer,
    steps,
    distractors: distinctDistractors(answer, cands, (k) => result(ask, a, (value ?? 0) + k + 1)),
    diagram: b.build('Graph of a piecewise function with open and closed dots'),
    check: { kind: 'precalculus.limitGraph' },
  };
}

function tableProblem(rng: Rng, d: Difficulty, askOpt: string): ProblemContent {
  const a = rng.int(-5, 5);
  const jump = d !== 'easy' && rng.bool(0.35);
  const L1 = rng.int(-8, 8);
  const L2 = jump ? rng.intExcept(-8, 8, [L1]) : L1;
  const c1 = rng.signedInt(1, 5, true);
  const c2 = jump ? rng.signedInt(1, 5, true) : c1;
  const q = d === 'hard' ? rng.signedInt(1, 3, true) : 0;
  const f = (x: number) => (x < a ? L1 + c1 * (x - a) + q * (x - a) ** 2 : L2 + c2 * (x - a) + q * (x - a) ** 2);
  const hs = [0.1, 0.01, 0.001];
  const xs = [...hs.map((h) => a - h), ...hs.slice().reverse().map((h) => a + h)];
  const fmt4 = (v: number) => decimal(v, 4);
  const table = `\\begin{array}{c|cccccc} x & ${xs.map((x) => fmt4(x)).join(' & ')} \\\\ \\hline f(x) & ${xs.map((x) => fmt4(f(x))).join(' & ')} \\end{array}`;
  const ask: Ask = askOpt === 'any' ? rng.pick<Ask>(jump ? ['left', 'right', 'both'] : ['left', 'right', 'both', 'both']) : askOpt === 'value' ? 'both' : (askOpt as Ask);
  const value = ask === 'left' ? L1 : ask === 'right' ? L2 : L1 === L2 ? L1 : null;
  const answer = result(ask, a, value);
  const cands = [result(ask, a, ask === 'left' ? L2 : L1), result(ask, a, null), result(ask, a, (value ?? L1) + 1), result(ask, a, (value ?? L2) - 1), result(ask, a, a)];
  const steps = [];
  if (ask !== 'right') steps.push(`As ${m(`x \\to ${a}^{-}`)}, ${m('f(x)')} approaches ${m(String(L1))}.`);
  if (ask !== 'left') steps.push(`As ${m(`x \\to ${a}^{+}`)}, ${m('f(x)')} approaches ${m(String(L2))}.`);
  steps.push(answer);
  return {
    question: `Use the table to estimate ${m(askTex(ask, a))}. ${m(table)}`,
    answer,
    steps,
    distractors: distinctDistractors(answer, cands, (k) => result(ask, a, (value ?? 0) + k + 2)),
    check: { kind: 'precalculus.limitTable' },
  };
}

export const limitsGraphsTables = defineTopic({
  id: 'precalc.limits.graphs-tables',
  subject: 'precalculus',
  category: 'Limits',
  title: 'Limits from Graphs and Tables',
  description: 'Read one-sided and two-sided limits and function values from a graph or a table of values.',
  instruction: 'Use the graph or table to find each value.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'source',
      label: 'Given',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Graphs and tables' },
        { value: 'graph', label: 'Graphs only' },
        { value: 'table', label: 'Tables only' },
      ],
    },
    {
      type: 'select',
      id: 'ask',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'left', label: 'Left-hand limits' },
        { value: 'right', label: 'Right-hand limits' },
        { value: 'both', label: 'Two-sided limits' },
        { value: 'value', label: 'Function values (graphs)' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const src = strOpt(ctx, 'source');
    const useGraph = src === 'graph' || (src === 'mixed' && rng.bool(0.65));
    return useGraph ? graphProblem(rng, difficulty, strOpt(ctx, 'ask')) : tableProblem(rng, difficulty, strOpt(ctx, 'ask'));
  },
});
