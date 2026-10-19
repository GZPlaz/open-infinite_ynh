/** Piecewise-defined functions: evaluating and graphing (open and closed endpoints). */
import { graphPlane, plot, type Diagram } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, paren, tuple } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

export interface Piece {
  p: Poly;
  lo: number | null;
  hi: number | null;
  loC: boolean;
  hiC: boolean;
}

export function condTex(pc: Piece): string {
  const le = (c: boolean) => (c ? '\\le' : '<');
  if (pc.lo === null) return `x ${le(pc.hiC)} ${pc.hi}`;
  if (pc.hi === null) return `x ${pc.loC ? '\\ge' : '>'} ${pc.lo}`;
  return `${pc.lo} ${le(pc.loC)} x ${le(pc.hiC)} ${pc.hi}`;
}

export function casesTex(pieces: readonly Piece[]): string {
  return `\\begin{cases} ${pieces.map((pc) => `${pc.p.toTex()}, & ${condTex(pc)}`).join(' \\\\ ')} \\end{cases}`;
}

export const contains = (pc: Piece, x: number): boolean =>
  (pc.lo === null || x > pc.lo || (pc.loC && x === pc.lo)) && (pc.hi === null || x < pc.hi || (pc.hiC && x === pc.hi));

export function pieceAt(pieces: readonly Piece[], x: number): Piece {
  return pieces.find((pc) => contains(pc, x))!;
}

function randPiece(rng: Rng, d: Difficulty): Poly {
  const kind = rng.weighted<'const' | 'lin' | 'quad'>(d === 'easy' ? [['const', 1], ['lin', 3]] : d === 'medium' ? [['const', 1], ['lin', 3]] : [['const', 1], ['lin', 2], ['quad', 2]]);
  if (kind === 'const') return Poly.of(rng.int(-6, 6));
  if (kind === 'lin') {
    const slope = d === 'hard' && rng.bool(0.3) ? new Frac(rng.signedInt(1, 3, true), 2) : new Frac(rng.signedInt(1, 3, true));
    return Poly.of(rng.int(-5, 5), slope);
  }
  return Poly.of(rng.int(-5, 5), 0, rng.pick([1, -1, new Frac(1, 2), new Frac(-1, 2)]));
}

/** Pieces on (−∞, b₁), (b₁, b₂), …, endpoints owned by one side, all values on the breakpoints within ±7. */
export function buildPieces(rng: Rng, d: Difficulty, count: number, window = 7): Piece[] {
  return attempt('piecewise', () => {
    const breaks = rng.sample([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5], count - 1).sort((a, b) => a - b);
    if (breaks.some((b, i) => i > 0 && b - breaks[i - 1]! < 2)) return null;
    const owner = breaks.map(() => rng.bool());
    const pieces: Piece[] = [];
    for (let i = 0; i < count; i++) {
      const lo = i === 0 ? null : breaks[i - 1]!;
      const hi = i === count - 1 ? null : breaks[i]!;
      pieces.push({ p: randPiece(rng, d), lo, hi, loC: i > 0 && !owner[i - 1]!, hiC: i < count - 1 && owner[i]! });
    }
    for (const pc of pieces) {
      for (const e of [pc.lo, pc.hi]) {
        if (e === null) continue;
        const v = pc.p.eval(e);
        if (!v.isInt() || Math.abs(v.value) > window) return null;
      }
      if (pc.lo !== null && pc.hi !== null && [pc.lo, (pc.lo + pc.hi) / 2, pc.hi].some((x) => Math.abs(pc.p.evalNum(x)) > window)) return null;
    }
    // neighbouring pieces should not be identical
    if (pieces.some((pc, i) => i > 0 && pc.p.eq(pieces[i - 1]!.p))) return null;
    return pieces;
  });
}

const callTex = (x: Frac) => (x.isInt() ? `f(${num(x)})` : `f\\left(${num(x)}\\right)`);

export const piecewiseEvaluate = defineTopic({
  id: 'precalc.functions.piecewise-evaluate',
  subject: 'precalculus',
  category: 'Functions',
  title: 'Evaluating Piecewise Functions',
  description: 'Evaluate piecewise-defined functions, including at the boundary points.',
  instruction: 'Evaluate each function at the given values.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const count = difficulty === 'easy' ? 2 : 3;
    const pieces = buildPieces(rng, difficulty, count, 9);
    const breaks = pieces.slice(1).map((pc) => pc.lo!);
    const xs: Frac[] = attempt('piecewise-inputs', () => {
      const picks: Frac[] = [];
      const n = difficulty === 'easy' ? 2 : 3;
      if (difficulty !== 'easy') picks.push(new Frac(rng.pick(breaks)));
      while (picks.length < n) {
        const x = difficulty === 'hard' && rng.bool(0.3) ? new Frac(rng.int(-13, 13), 2) : new Frac(rng.int(-7, 7));
        picks.push(x);
      }
      const distinct = new Set(picks.map((x) => x.value)).size === picks.length;
      const covered = new Set(picks.map((x) => pieces.indexOf(pieceAt(pieces, x.value)))).size;
      return distinct && covered >= Math.min(n, count) ? picks.sort((a, b) => a.cmp(b)) : null;
    });
    const value = (x: Frac) => pieceAt(pieces, x.value).p.eval(x);
    const list = (vals: Frac[]) => xs.map((x, i) => m(`${callTex(x)} = ${num(vals[i]!)}`)).join(', ');
    const right = xs.map(value);
    const answer = list(right);
    const steps = xs.map((x) => {
      const pc = pieceAt(pieces, x.value);
      return `${m(`x = ${num(x)}`)} satisfies ${m(condTex(pc))}: ${m(`${callTex(x)} = ${pc.p.toTex().replace(/x/g, x.isInt() ? paren(x) : `\\left(${num(x)}\\right)`)} = ${num(value(x))}`)}`;
    });
    // wrong piece for each input in turn (boundary mistakes first)
    const wrongs: string[] = [];
    const order = xs.map((x, i) => i).sort((i, j) => Number(breaks.includes(xs[j]!.value)) - Number(breaks.includes(xs[i]!.value)));
    for (const i of order) {
      for (const pc of pieces) {
        if (pc === pieceAt(pieces, xs[i]!.value)) continue;
        const vals = right.slice();
        vals[i] = pc.p.eval(xs[i]!);
        wrongs.push(list(vals));
      }
    }
    const distractors = distinctDistractors(answer, wrongs, (k) => list(right.map((v, i) => (i === k % right.length ? v.add(offset(k)) : v))));
    const calls = xs.map((x) => m(callTex(x)));
    const said = calls.length === 2 ? calls.join(' and ') : `${calls.slice(0, -1).join(', ')}, and ${calls.at(-1)}`;
    return {
      question: `${m(`f(x) = ${casesTex(pieces)}`)} Find ${said}.`,
      answer,
      steps,
      distractors,
      check: { kind: 'precalculus.piecewiseEval' },
    };
  },
});

/** Endpoint dots of the pieces: closed where the piece owns the endpoint. */
function endpointDots(pieces: readonly Piece[]): Array<{ x: number; y: number; open: boolean }> {
  const out: Array<{ x: number; y: number; open: boolean }> = [];
  for (const pc of pieces) {
    for (const [e, closed] of [
      [pc.lo, pc.loC],
      [pc.hi, pc.hiC],
    ] as Array<[number | null, boolean]>) {
      if (e === null) continue;
      const y = pc.p.evalNum(e);
      if (out.some((d) => d.x === e && d.y === y)) {
        if (closed) out.find((d) => d.x === e && d.y === y)!.open = false;
        continue;
      }
      out.push({ x: e, y, open: !closed });
    }
  }
  return out.sort((a, b) => a.x - b.x || a.y - b.y);
}

export function drawPieces(pieces: readonly Piece[], range = 8): Diagram {
  const { b, w } = graphPlane(range, 2);
  for (const pc of pieces) plot(b, (x) => pc.p.evalNum(x), { ...w, x0: pc.lo ?? w.x0, x1: pc.hi ?? w.x1 }, {}, 120);
  for (const d of endpointDots(pieces)) b.dot([d.x, d.y], d.open, 'accent');
  return b.build('Graph of the piecewise function with open and closed endpoints');
}

export const piecewiseGraph = defineTopic({
  id: 'precalc.functions.piecewise-graph',
  subject: 'precalculus',
  category: 'Functions',
  title: 'Graphing Piecewise Functions',
  description: 'Graph piecewise-defined functions with open and closed endpoints.',
  instruction: 'Graph each function.',
  multipleChoice: false,
  defaultCount: 4,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const pieces = buildPieces(rng, difficulty, difficulty === 'easy' ? 2 : 3);
    const dots = endpointDots(pieces);
    const pt = (d: { x: number; y: number }) => m(tuple([d.x, d.y]));
    const closed = dots.filter((d) => !d.open).map(pt);
    const open = dots.filter((d) => d.open).map(pt);
    const answer = `Closed dots: ${closed.join(', ') || 'none'}; open dots: ${open.join(', ') || 'none'}`;
    const steps = pieces.map((pc) => `Graph ${m(`y = ${pc.p.toTex()}`)} for ${m(condTex(pc))}.`);
    steps.push('Use a closed dot where an endpoint is included and an open dot where it is not.');
    return {
      question: `Graph ${m(`f(x) = ${casesTex(pieces)}`)}`,
      answer,
      steps,
      diagram: graphPlane(8, 2).b.build('Blank coordinate plane'),
      answerDiagram: drawPieces(pieces),
      check: { kind: 'precalculus.piecewiseGraph' },
    };
  },
});
