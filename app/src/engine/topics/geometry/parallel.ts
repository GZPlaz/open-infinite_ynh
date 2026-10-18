/** Parallel and perpendicular lines: transversal angle pairs, slopes, equations. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { m, num, paren, parenNeg, sum, tuple } from '../../tex';
import type { ProblemContent } from '../../types';
import { add, dirDeg, line, linDeg, linFor, linTex, linVal, mul, numChoices, parallelMarks, sub, type Lin } from './kit';

// ---------------------------------------------------------------- transversals

type Pos = 'TL' | 'TR' | 'BL' | 'BR';
interface Slot {
  /** 0 = first (upper) parallel line, 1 = second */
  at: 0 | 1;
  pos: Pos;
}
const POSITIONS: Pos[] = ['TL', 'TR', 'BL', 'BR'];
const SLOTS: Slot[] = [0, 1].flatMap((at) => POSITIONS.map((pos) => ({ at: at as 0 | 1, pos })));

type Relation = 'Corresponding angles' | 'Alternate interior angles' | 'Alternate exterior angles' | 'Same-side interior angles' | 'Same-side exterior angles' | 'Vertical angles' | 'Linear pair';
const RELATIONS: Relation[] = ['Corresponding angles', 'Alternate interior angles', 'Alternate exterior angles', 'Same-side interior angles', 'Same-side exterior angles', 'Vertical angles', 'Linear pair'];

const top = (p: Pos) => p[0] === 'T';
const right = (p: Pos) => p[1] === 'R';

function relationOf(a: Slot, b: Slot): Relation {
  if (a.at === b.at) return top(a.pos) !== top(b.pos) && right(a.pos) !== right(b.pos) ? 'Vertical angles' : 'Linear pair';
  const [u, l] = a.at === 0 ? [a, b] : [b, a];
  const interior = (s: Slot) => (s.at === 0 ? !top(s.pos) : top(s.pos));
  if (top(u.pos) === top(l.pos) && right(u.pos) === right(l.pos)) return 'Corresponding angles';
  const sameSide = right(u.pos) === right(l.pos);
  if (interior(u) && interior(l)) return sameSide ? 'Same-side interior angles' : 'Alternate interior angles';
  if (!interior(u) && !interior(l)) return sameSide ? 'Same-side exterior angles' : 'Alternate exterior angles';
  return 'Corresponding angles'; // unreachable for distinct slots of different lines with mixed sides
}

/** Measure at a slot when the angle from the parallel (rightward) to the transversal (upward) is θ. */
const measureAt = (s: Slot, theta: number) => (s.pos === 'TR' || s.pos === 'BL' ? theta : 180 - theta);

interface TransversalFigure {
  b: DiagramBuilder;
  I: [Pt, Pt];
  u: Pt;
  t: Pt;
  /** Rays bounding the angle at a slot, as [point on ray 1, vertex, point on ray 2]. */
  ray(s: Slot): [Pt, Pt, Pt];
}

function transversalFigure(phi: number, theta: number, gap: number): TransversalFigure {
  const u = dirDeg(phi);
  const t = dirDeg(phi + theta);
  const nrm = dirDeg(phi + 90);
  const I0: Pt = [0, 0];
  // second intersection: along the transversal, a distance gap/sin θ below
  const along = gap / Math.sin((theta * Math.PI) / 180);
  const I1 = add(I0, mul(t, -along));
  const b = new DiagramBuilder(60);
  const L = 1.5;
  for (const I of [I0, I1]) line(b, add(I, mul(u, -L)), add(I, mul(u, L)), 0.05);
  line(b, add(I0, mul(t, 0.9)), add(I1, mul(t, -0.9)), 0.05);
  parallelMarks(b, add(I0, mul(u, -L)), add(I0, mul(u, -L * 0.2)), 1, 0.45);
  parallelMarks(b, add(I1, mul(u, -L)), add(I1, mul(u, -L * 0.2)), 1, 0.45);
  void nrm;
  const ray = (s: Slot): [Pt, Pt, Pt] => {
    const I = s.at === 0 ? I0 : I1;
    const r1 = right(s.pos) ? u : mul(u, -1);
    const r2 = top(s.pos) ? t : mul(t, -1);
    return [add(I, r1), I, add(I, r2)];
  };
  return { b, I: [I0, I1], u, t, ray };
}

function placeNumber(f: TransversalFigure, s: Slot, text: string, theta: number): void {
  const [a, v, c] = f.ray(s);
  const bis = DiagramBuilder.bisector(v, a, c);
  const ang = measureAt(s, theta);
  const d = Math.max(13, 9 / Math.sin((ang * Math.PI) / 360));
  f.b.label(add(v, mul(bis, f.b.px(d))), text, 'c', { small: false });
}

export const parallelTransversal = defineTopic({
  id: 'geo.parallel-transversal',
  subject: 'geometry',
  category: 'Parallel and Perpendicular Lines',
  title: 'Parallel Lines and Transversals',
  description: 'Name angle pairs formed by a transversal and use them to find angle measures and solve for x.',
  instruction: (o) =>
    o.task === 'identify' ? 'Identify each pair of angles as corresponding, alternate interior, alternate exterior, same-side interior, same-side exterior, vertical, or a linear pair.' : 'The two lines marked with arrows are parallel. Find the indicated value.',
  multipleChoice: true,
  defaultCount: 9,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'By difficulty' },
        { value: 'identify', label: 'Name the angle pair' },
        { value: 'measure', label: 'Find an angle measure' },
        { value: 'solve', label: 'Solve for x' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen !== 'any' ? chosen : difficulty === 'easy' ? rng.pick(['identify', 'measure']) : difficulty === 'medium' ? rng.pick(['identify', 'measure', 'solve']) : 'solve';
    const theta = rng.pick([rng.int(35, 78), rng.int(102, 145)]);
    const phi = rng.int(-12, 12);
    const fig = transversalFigure(phi, theta, 1.1);
    const numbers = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const label = (s: Slot) => numbers[SLOTS.findIndex((q) => q.at === s.at && q.pos === s.pos)]!;
    const [a, b] = attempt('pair', () => {
      const [x, y] = rng.sample(SLOTS, 2) as [Slot, Slot];
      const r = relationOf(x, y);
      if (task !== 'identify' && r === 'Linear pair' && rng.bool(0.6)) return null;
      if (task === 'identify' && r === 'Linear pair' && rng.bool(0.5)) return null;
      if (task === 'solve' && x.at === y.at && rng.bool(0.6)) return null;
      return [x, y];
    });
    const rel = relationOf(a, b);
    const la = label(a);
    const lb = label(b);
    SLOTS.forEach((s) => placeNumber(fig, s, String(label(s)), theta));
    const alt = 'Two parallel lines cut by a transversal; angles numbered 1 to 8';
    if (task === 'identify') {
      const answer = rel;
      return {
        question: `$\\angle ${la}$ and $\\angle ${lb}$`,
        answer,
        steps: [`$\\angle ${la}$ and $\\angle ${lb}$ are ${rel === 'Linear pair' ? 'a linear pair' : rel.toLowerCase()}.`],
        distractors: rng.shuffle(RELATIONS.filter((r) => r !== rel)).slice(0, 4),
        diagram: fig.b.build(alt),
        check: { kind: 'geometry.transversal', I: fig.I, u: fig.u, t: fig.t, pair: [la, lb] },
      };
    }
    const ma = measureAt(a, theta);
    const mb = measureAt(b, theta);
    const equal = ma === mb;
    const reason = `${rel === 'Linear pair' ? 'A linear pair' : rel} ${equal ? 'are congruent' : rel === 'Linear pair' ? 'is supplementary' : 'are supplementary'}`;
    const angles: Array<[Pt, Pt, Pt, string]> = [];
    if (task === 'measure') {
      const fmt = (v: number) => m(`m\\angle ${lb} = ${v}^\\circ`);
      angles.push([...fig.ray(a), String(ma)], [...fig.ray(b), 'L']);
      return {
        question: `$m\\angle ${la} = ${ma}^\\circ$. Find $m\\angle ${lb}$.`,
        answer: fmt(mb),
        steps: [`${reason}.`, m(equal ? `m\\angle ${lb} = m\\angle ${la} = ${mb}^\\circ` : `m\\angle ${lb} = 180^\\circ - ${ma}^\\circ = ${mb}^\\circ`)],
        distractors: numChoices(fmt, mb, [180 - mb, 90 - mb, Math.abs(90 - ma) + 90]),
        diagram: fig.b.build(alt),
        check: { kind: 'geometry.solve', names: { [`m\\angle ${lb}`]: 'L' }, eqs: [equal ? `L = ${ma}` : `L + ${ma} = 180`], angles, given: [`${ma}^\\circ`] },
      };
    }
    // solve for x
    const { x, ea, eb } = attempt('trans-solve', () => {
      const x = rng.int(3, difficulty === 'hard' ? 20 : 14);
      const ea = linFor(rng, ma, x, { aMin: 1, aMax: difficulty === 'hard' ? 9 : 5, bMax: 60 });
      const eb = rng.bool(difficulty === 'medium' ? 0.5 : 0.9) ? linFor(rng, mb, x, { aMin: 1, aMax: 9, bMax: 60, avoidA: equal && ea ? [ea.a] : [] }) : null;
      if (!ea) return null;
      return { x, ea, eb };
    });
    const tb = eb ? linDeg(eb) : `${mb}^\\circ`;
    const target = difficulty === 'hard' && rng.bool(0.6);
    const fmt = (w: number) => (target ? `${m(`x = ${w}`)}, ${m(`m\\angle ${la} = ${linVal(ea, w)}^\\circ`)}` : m(`x = ${w}`));
    const lhs = `(${linTex(ea)})`;
    const rhs = eb ? `(${linTex(eb)})` : String(mb);
    const eqTex = equal ? `${lhs} = ${rhs}` : `${lhs} + ${rhs} = 180`;
    const A = ea.a + (equal ? -(eb?.a ?? 0) : eb?.a ?? 0);
    const B = equal ? (eb?.b ?? mb) - ea.b : 180 - ea.b - (eb?.b ?? mb);
    const steps = [`${reason}:`, m(eqTex), m(`${sum([{ coef: A, sym: 'x' }])} = ${B}`), m(`x = ${x}`)];
    if (target) steps.push(m(`m\\angle ${la} = ${linVal(ea, x)}^\\circ`));
    const wrong: number[] = [];
    // using the wrong relationship
    const A2 = ea.a + (equal ? eb?.a ?? 0 : -(eb?.a ?? 0));
    const B2 = equal ? 180 - ea.b - (eb?.b ?? mb) : (eb?.b ?? mb) - ea.b;
    if (A2 !== 0) wrong.push(B2 / A2);
    if (A !== 0) wrong.push((B + 2 * ea.b) / A, (90 - ea.b) / ea.a);
    angles.push([...fig.ray(a), linTex(ea)], [...fig.ray(b), eb ? linTex(eb) : String(mb)]);
    const names: Record<string, string> = {};
    const eqs = [equal ? `${lhs} = ${rhs}` : `${lhs} + ${rhs} = 180`];
    if (target) {
      names[`m\\angle ${la}`] = 'L';
      eqs.push(`L = ${linTex(ea)}`);
    }
    return {
      question: `$m\\angle ${la} = ${linDeg(ea)}$ and $m\\angle ${lb} = ${tb}$. Find ${target ? `$x$ and $m\\angle ${la}$` : '$x$'}.`,
      answer: fmt(x),
      steps,
      distractors: numChoices(fmt, x, wrong.filter((w) => w > 0 && linVal(ea, w) > 0 && linVal(ea, w) < 180)),
      diagram: fig.b.build(alt),
      check: { kind: 'geometry.solve', eqs, names, angles, given: [linDeg(ea), tb] },
    };
  },
});

// ---------------------------------------------------------------- slopes

/** Slope-intercept LaTeX `y = mx + b`. */
function slopeIntercept(mm: Frac, b: Frac): string {
  return `y = ${sum([{ coef: mm, sym: 'x' }, { coef: b }])}`;
}

/** Standard form `Ax + By = C` with integer coefficients, A > 0 (or A = 0, B > 0). */
function standardForm(mm: Frac, b: Frac): string {
  // y = (p/q)x + b  →  -p x + q y = q b, scaled to integers
  const p = mm.n;
  const q = mm.d;
  const qb = b.mul(q);
  const k = qb.d;
  let A = -p * k;
  let B = q * k;
  let C = qb.mul(k).n;
  if (A < 0 || (A === 0 && B < 0)) [A, B, C] = [-A, -B, -C];
  return `${sum([{ coef: A, sym: 'x' }, { coef: B, sym: 'y' }])} = ${C}`;
}

function randomSlope(rng: { int(a: number, b: number): number; bool(p?: number): boolean; pick<T>(xs: readonly T[]): T }, hard: boolean): Frac {
  for (;;) {
    const n = rng.int(-6, 6);
    const d = hard || rng.bool(0.5) ? rng.int(1, 5) : 1;
    if (n === 0) continue;
    const f = new Frac(n, d);
    if (f.abs().eq(1) && rng.bool(0.7)) continue;
    return f;
  }
}

export const parallelPerpendicular = defineTopic({
  id: 'geo.parallel-perpendicular',
  subject: 'geometry',
  category: 'Parallel and Perpendicular Lines',
  title: 'Slopes of Parallel and Perpendicular Lines',
  description: 'Slopes of parallel and perpendicular lines, classifying pairs of lines, and writing equations through a point.',
  instruction: (o) =>
    o.task === 'slope'
      ? 'Find the slope of a line parallel or perpendicular to each given line.'
      : o.task === 'classify'
        ? 'Determine whether the lines are parallel, perpendicular, the same line, or neither.'
        : o.task === 'equation'
          ? 'Write the slope-intercept form of the equation of the line described.'
          : 'Answer each question about parallel and perpendicular lines.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'slope', label: 'Parallel / perpendicular slope' },
        { value: 'classify', label: 'Parallel, perpendicular or neither' },
        { value: 'equation', label: 'Equation through a point' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task = chosen !== 'any' ? chosen : rng.pick(['slope', 'classify', 'equation']);
    const hard = difficulty === 'hard';
    const mm = randomSlope(rng, hard);
    const b0 = new Frac(rng.int(-9, 9));
    const useStandard = difficulty === 'hard' || (difficulty === 'medium' && rng.bool(0.4));
    const given = useStandard ? standardForm(mm, b0) : slopeIntercept(mm, b0);
    const perp = rng.bool();
    const want = perp ? mm.inv().neg() : mm;
    const word = perp ? 'perpendicular' : 'parallel';
    const toSlope = useStandard ? [m(given.replace(/ = .*$/, '') + ` = ${given.split(' = ')[1]}`), m(slopeIntercept(mm, b0))] : [];

    if (task === 'slope') {
      const fmt = (f: Frac) => m(`m = ${num(f)}`);
      return {
        question: `Find the slope of a line ${word} to $${given}$.`,
        answer: fmt(want),
        steps: [...toSlope.slice(1), m(`m = ${num(mm)}`), perp ? `Perpendicular slopes are opposite reciprocals: $m = ${num(want)}$.` : `Parallel lines have equal slopes: $m = ${num(want)}$.`],
        distractors: distinctDistractors(fmt(want), [mm, mm.neg(), mm.inv(), mm.inv().neg()].map(fmt), (k) => fmt(want.add(offset(k)))),
        check: { kind: 'geometry.lines', task },
      };
    }

    if (task === 'classify') {
      const kind = rng.pick(['parallel', 'perpendicular', 'neither', hard ? 'same' : 'parallel'] as const);
      let m2: Frac;
      let b2: Frac;
      if (kind === 'parallel') {
        m2 = mm;
        b2 = b0.add(rng.pick([-6, -4, -3, -2, 2, 3, 5, 7]));
      } else if (kind === 'perpendicular') {
        m2 = mm.inv().neg();
        b2 = new Frac(rng.int(-9, 9));
      } else if (kind === 'same') {
        m2 = mm;
        b2 = b0;
      } else {
        m2 = rng.pick([mm.inv(), mm.neg(), mm.add(1), mm.mul(2)].filter((f) => !f.eq(mm) && !f.eq(mm.inv().neg())));
        b2 = new Frac(rng.int(-9, 9));
      }
      const eq2 = useStandard ? (kind === 'same' ? standardForm(m2, b2).replace(/(-?\d*)([xy])/g, (s) => s) : standardForm(m2, b2)) : slopeIntercept(m2, b2);
      // write the same line differently: scale the standard form by 2 or show slope-intercept
      const second = kind === 'same' && useStandard ? slopeIntercept(m2, b2) : eq2;
      const first = given;
      const answer = kind === 'parallel' ? 'Parallel' : kind === 'perpendicular' ? 'Perpendicular' : kind === 'same' ? 'Same line' : 'Neither';
      const others = ['Parallel', 'Perpendicular', 'Neither', 'Same line'].filter((s) => s !== answer);
      const verdict =
        kind === 'parallel'
          ? 'The slopes are equal and the y-intercepts differ, so the lines are parallel.'
          : kind === 'perpendicular'
            ? `The product of the slopes is $${num(mm)} \\cdot ${parenNeg(m2)} = -1$, so the lines are perpendicular.`
            : kind === 'same'
              ? 'The equations have the same slope and the same y-intercept, so they describe the same line.'
              : 'The slopes are neither equal nor opposite reciprocals.';
      return {
        question: `$${first}$ and $${second}$`,
        answer,
        steps: [`Slopes: $${num(mm)}$ and $${num(m2)}$.`, verdict],
        distractors: rng.shuffle(others),
        check: { kind: 'geometry.lines', task },
      };
    }

    // equation through a point
    const P: [number, number] = attempt('through', () => {
      const px = rng.int(-6, 6) * (want.d <= 3 ? want.d : 1);
      const py = rng.int(-9, 9);
      if (Math.abs(px) > 12) return null;
      const bb = new Frac(py).sub(want.mul(px));
      if (!hard && !bb.isInt()) return null;
      if (bb.eq(b0) && !perp) return null;
      return [px, py];
    });
    const bb = new Frac(P[1]).sub(want.mul(P[0]));
    const fmt = (s: Frac, i: Frac) => m(slopeIntercept(s, i));
    const answer = fmt(want, bb);
    const wrongs = [fmt(mm.inv().neg().eq(want) ? mm : mm.inv().neg(), new Frac(P[1]).sub((mm.inv().neg().eq(want) ? mm : mm.inv().neg()).mul(P[0]))), fmt(want, new Frac(P[1]).add(want.mul(P[0]))), fmt(want, b0), fmt(want.neg(), bb)];
    return {
      question: `Through $${tuple(P)}$, ${word} to $${given}$`,
      answer,
      steps: [
        ...toSlope.slice(1),
        perp ? `Perpendicular slope: $m = ${num(want)}$` : `Parallel slope: $m = ${num(want)}$`,
        m(`${P[1]} = ${num(want)}${paren(P[0])} + b`),
        m(`b = ${num(bb)}`),
        answer,
      ],
      distractors: distinctDistractors(answer, wrongs, (k) => fmt(want, bb.add(offset(k)))),
      check: { kind: 'geometry.lines', task },
    };
  },
});

export { sub };
