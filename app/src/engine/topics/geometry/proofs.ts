/**
 * Two-column proofs (Kuta style): algebraic proofs, segment and angle proofs,
 * parallel-line proofs, triangle congruence and similarity proofs. Each topic
 * prints the Given and Prove statements, a figure and an empty two-column
 * table; the answer key is the complete proof. A separate multiple-choice
 * topic shows a proof with missing statements or reasons to fill in.
 */
import { DiagramBuilder, type Diagram, type Pt } from '../../diagram';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { add, centroid, dirDeg, mul, orient, randomLetters, sub, unit } from './kit';

// ---------------------------------------------------------------- statements and reasons

type Row = [string, string];

const seg = (s: string) => `\\overline{${s}}`;
const ang = (s: string | number) => `\\angle ${s}`;
const segC = (a: string, b: string) => `${seg(a)} \\cong ${seg(b)}`;
const angC = (a: string | number, b: string | number) => `${ang(a)} \\cong ${ang(b)}`;
const triC = (a: string, b: string) => `\\triangle ${a} \\cong \\triangle ${b}`;
const triS = (a: string, b: string) => `\\triangle ${a} \\sim \\triangle ${b}`;
const midS = (pt: string, s: string) => `${pt} \\text{ is the midpoint of } ${seg(s)}`;
const bisS = (r: string, a: string) => `\\overrightarrow{${r}} \\text{ bisects } \\angle ${a}`;
const lineRef = (l: string) => (l.length === 1 ? l : seg(l));
const parS = (a: string, b: string) => `${lineRef(a)} \\parallel ${lineRef(b)}`;
const perpS = (a: string, b: string) => `${seg(a)} \\perp ${seg(b)}`;
const suppS = (a: string | number, b: string | number) => `${ang(a)} \\text{ and } ${ang(b)} \\text{ are supplementary}`;
const rightsS = (a: string, b: string) => `${ang(a)} \\text{ and } ${ang(b)} \\text{ are right angles}`;
const rtriS = (a: string, b: string) => `\\triangle ${a} \\text{ and } \\triangle ${b} \\text{ are right triangles}`;
const mA = (a: string | number) => `m\\angle ${a}`;

export const R = {
  given: 'Given',
  dist: 'Distributive Prop.',
  addEq: 'Addition Prop. of Equality',
  subEq: 'Subtraction Prop. of Equality',
  mulEq: 'Multiplication Prop. of Equality',
  divEq: 'Division Prop. of Equality',
  simplify: 'Simplify',
  symEq: 'Symmetric Prop. of Equality',
  reflexive: 'Reflexive Prop.',
  transitive: 'Transitive Prop.',
  substitution: 'Substitution Prop.',
  defMid: 'Def. of midpoint',
  defBis: 'Def. of angle bisector',
  defCongSeg: 'Def. of congruent segments',
  defCongAng: 'Def. of congruent angles',
  segAdd: 'Segment Addition Post.',
  angAdd: 'Angle Addition Post.',
  vertical: 'Vertical Angles Thm.',
  linearPair: 'Linear Pair Post.',
  defSupp: 'Def. of supplementary angles',
  congSupp: 'Congruent Supplements Thm.',
  defPerp: 'Def. of perpendicular lines',
  rightCong: 'Right Angles Congruence Thm.',
  defRightTri: 'Def. of right triangle',
  corr: 'Corresponding Angles Post.',
  altInt: 'Alt. Interior Angles Thm.',
  altExt: 'Alt. Exterior Angles Thm.',
  ssi: 'Same-Side Interior Angles Thm.',
  convCorr: 'Converse of Corresponding Angles Post.',
  convAltInt: 'Converse of Alt. Interior Angles Thm.',
  convAltExt: 'Converse of Alt. Exterior Angles Thm.',
  convSsi: 'Converse of Same-Side Interior Angles Thm.',
  SSS: 'SSS',
  SAS: 'SAS',
  ASA: 'ASA',
  AAS: 'AAS',
  HL: 'HL',
  cpctc: 'CPCTC',
  AA: 'AA Similarity',
  defSim: 'Def. of similar triangles',
} as const;

/** Plausible wrong reasons for each reason (every one of them makes the step invalid). */
const WRONG: Record<string, string[]> = {
  [R.dist]: [R.simplify, R.mulEq, R.symEq],
  [R.addEq]: [R.subEq, R.mulEq, R.divEq],
  [R.subEq]: [R.addEq, R.divEq, R.mulEq],
  [R.mulEq]: [R.divEq, R.addEq, R.dist],
  [R.divEq]: [R.mulEq, R.subEq, R.dist],
  [R.simplify]: [R.dist, R.symEq, R.addEq],
  [R.symEq]: [R.reflexive, R.transitive, R.simplify],
  [R.reflexive]: [R.symEq, R.transitive, R.vertical],
  [R.transitive]: [R.substitution, R.reflexive, R.vertical],
  [R.substitution]: [R.transitive, R.segAdd, R.reflexive],
  [R.defMid]: [R.defBis, R.segAdd, R.reflexive],
  [R.defBis]: [R.defMid, R.vertical, R.angAdd],
  [R.defCongSeg]: [R.defMid, R.reflexive, R.segAdd],
  [R.defCongAng]: [R.defBis, R.vertical, R.reflexive],
  [R.segAdd]: [R.defMid, R.substitution, R.reflexive],
  [R.angAdd]: [R.defBis, R.substitution, R.linearPair],
  [R.vertical]: [R.linearPair, R.corr, R.reflexive],
  [R.linearPair]: [R.vertical, R.defSupp, R.congSupp],
  [R.defSupp]: [R.linearPair, R.congSupp, R.substitution],
  [R.congSupp]: [R.vertical, R.transitive, R.linearPair],
  [R.defPerp]: [R.defBis, R.rightCong, R.linearPair],
  [R.rightCong]: [R.vertical, R.defPerp, R.reflexive],
  [R.defRightTri]: [R.defPerp, R.HL, R.rightCong],
  [R.corr]: [R.altInt, R.altExt, R.vertical],
  [R.altInt]: [R.corr, R.altExt, R.vertical],
  [R.altExt]: [R.altInt, R.corr, R.vertical],
  [R.ssi]: [R.linearPair, R.altInt, R.corr],
  [R.convCorr]: [R.convAltInt, R.convAltExt, R.corr],
  [R.convAltInt]: [R.convCorr, R.convAltExt, R.altInt],
  [R.convAltExt]: [R.convAltInt, R.convCorr, R.altExt],
  [R.convSsi]: [R.convAltInt, R.ssi, R.convCorr],
  [R.SSS]: [R.SAS, R.ASA, R.HL],
  [R.SAS]: [R.ASA, R.SSS, R.AAS],
  [R.ASA]: [R.AAS, R.SAS, R.SSS],
  [R.AAS]: [R.ASA, R.SAS, R.HL],
  [R.HL]: [R.SAS, R.SSS, R.ASA],
  [R.cpctc]: [R.reflexive, R.transitive, R.SAS],
  [R.AA]: [R.SAS, R.ASA, R.AAS],
  [R.defSim]: [R.cpctc, R.substitution, R.transitive],
};

/** A proof with its figure data (point coordinates for the checker). */
interface Proof {
  givens: string[];
  prove: string;
  rows: Row[];
  diagram?: Diagram;
  points?: Record<string, Pt>;
  lines?: Record<string, [Pt, Pt]>;
  numbered?: Record<string, [Pt, Pt, Pt]>;
  /** Wrong alternatives for statements that may be blanked, by row index. */
  stmtAlts?: Record<number, string[]>;
  /** Wrong reasons for particular rows (overrides WRONG). */
  reasonAlts?: Record<number, string[]>;
  alt: string;
}

// ---------------------------------------------------------------- tables

const HEAD = '\\begin{array}{|l|l|}\\hline \\textbf{Statements} & \\textbf{Reasons} \\\\ \\hline';

/** Complete two-column proof. */
export function proofTable(rows: readonly Row[], blanks: ReadonlyMap<string, string> = new Map()): string {
  const cell = (key: string, content: string) => blanks.get(key) ?? content;
  const body = rows.map(([s, r], i) => `${i + 1}.\\ ${cell(`s${i}`, s)} & ${cell(`r${i}`, `\\text{${r}}`)} \\\\ \\hline`).join(' ');
  return `${HEAD} ${body} \\end{array}`;
}

/** Empty table with numbered rows for the student. */
function blankTable(n: number): string {
  const rows = Array.from({ length: n }, (_, i) => `${i + 1}.\\ \\vphantom{\\dfrac{A}{B}} & \\\\ \\hline`).join(' ');
  return `\\begin{array}{|l|l|}\\hline \\textbf{Statements}\\hspace{4em} & \\textbf{Reasons}\\hspace{4em} \\\\ \\hline ${rows} \\end{array}`;
}

const blankMark = (letter: string) => `\\underline{\\quad\\text{(${letter})}\\quad}`;

function header(p: Proof): string {
  return `Given: ${p.givens.map(m).join(', ')}. Prove: ${m(p.prove)}.`;
}

// ---------------------------------------------------------------- figures

interface FigureData {
  points: Record<string, Pt>;
  lines?: Record<string, [Pt, Pt]>;
  numbered?: Record<string, [Pt, Pt, Pt]>;
}

/** Random tilt / mirror applied to every coordinate of the figure data. */
function transformAll(rng: Rng, data: FigureData, maxTurn = 25): FigureData {
  const keys = Object.keys(data.points);
  const all: Pt[] = [...keys.map((k) => data.points[k]!)];
  const lineKeys = Object.keys(data.lines ?? {});
  for (const k of lineKeys) all.push(...data.lines![k]!);
  const numKeys = Object.keys(data.numbered ?? {});
  for (const k of numKeys) all.push(...data.numbered![k]!);
  const out = orient(all, rng.int(-maxTurn, maxTurn), rng.bool());
  let i = 0;
  const points: Record<string, Pt> = {};
  for (const k of keys) points[k] = out[i++]!;
  const lines: Record<string, [Pt, Pt]> = {};
  for (const k of lineKeys) lines[k] = [out[i++]!, out[i++]!];
  const numbered: Record<string, [Pt, Pt, Pt]> = {};
  for (const k of numKeys) numbered[k] = [out[i++]!, out[i++]!, out[i++]!];
  return { points, lines: lineKeys.length ? lines : undefined, numbered: numKeys.length ? numbered : undefined };
}

function builderFor(pts: Pt[], sizePx: number): DiagramBuilder {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return new DiagramBuilder(sizePx / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6));
}

/** Draw segments between named points and label the points away from `center`. */
function drawNamed(data: FigureData, segments: string[], sizePx = 170, center?: Pt): DiagramBuilder {
  const P = data.points;
  const b = builderFor(Object.values(P), sizePx);
  for (const s of segments) b.segment(P[s[0]!]!, P[s[1]!]!, { weight: 1.4 });
  const c = center ?? centroid(Object.values(P));
  for (const [name, p] of Object.entries(P)) {
    const d = sub(p, c);
    const dir: Pt = Math.hypot(...d) < 1e-9 ? [0, 1] : unit(d);
    b.label(add(p, mul(dir, b.px(10))), name, 'c');
  }
  return b;
}

// ---------------------------------------------------------------- algebraic proofs

/** a·x + b as an equation side. */
const L = (a: number, b: number) => linear(a, b, 'x');

function algebraProof(rng: Rng, d: Difficulty): Proof {
  const x = rng.int(-9, 12);
  const rows: Row[] = [];
  const nz = (lo: number, hi: number, avoid: number[] = []) => rng.intExcept(lo, hi, [0, ...avoid]);
  const template = d === 'easy' ? rng.pick(['lin', 'frac']) : d === 'medium' ? rng.pick(['dist', 'both', 'frac']) : rng.pick(['distCombine', 'distBoth', 'rightSide']);
  /** Finish `A·x + B = C` (A ≠ 0): move B, then divide. */
  const finish = (A: number, B: number, C: number) => {
    if (B !== 0) rows.push([`${L(A, 0)} = ${C - B}`, B > 0 ? R.subEq : R.addEq]);
    if (A !== 1) rows.push([`x = ${x}`, R.divEq]);
  };
  if (template === 'lin') {
    const a = nz(2, 9);
    const b = nz(-15, 15);
    rows.push([`${L(a, b)} = ${a * x + b}`, R.given]);
    finish(a, b, a * x + b);
  } else if (template === 'frac') {
    const a = rng.int(2, 6);
    const xx = a * rng.int(-4, 6);
    const b = nz(-12, 12);
    const c = xx / a + b;
    rows.push([`\\frac{x}{${a}} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${c}`, R.given]);
    rows.push([`\\frac{x}{${a}} = ${c - b}`, b > 0 ? R.subEq : R.addEq]);
    rows.push([`x = ${xx}`, R.mulEq]);
    return { givens: [rows[0]![0]], prove: `x = ${xx}`, rows, alt: '' };
  } else if (template === 'dist') {
    const a = nz(2, 7);
    const b = nz(-9, 9);
    const rhs = a * (x + b);
    rows.push([`${a}(${L(1, b)}) = ${rhs}`, R.given]);
    rows.push([`${L(a, a * b)} = ${rhs}`, R.dist]);
    finish(a, a * b, rhs);
  } else if (template === 'both') {
    const [a, c] = attempt('alg-both', () => {
      const a = nz(2, 9);
      const c = nz(-6, 8, [a, a - 1]);
      return a - c === -1 ? null : [a, c];
    });
    const b = nz(-15, 15);
    const dd = a * x + b - c * x;
    rows.push([`${L(a, b)} = ${L(c, dd)}`, R.given]);
    rows.push([`${L(a - c, b)} = ${dd}`, c > 0 ? R.subEq : R.addEq]);
    finish(a - c, b, dd);
  } else if (template === 'distCombine') {
    const [a, c] = attempt('alg-dc', () => {
      const a = nz(2, 6);
      const c = nz(-5, 6, [-a, 1 - a, -1 - a]);
      return [a, c];
    });
    const b = nz(-8, 8);
    const rhs = a * (x + b) + c * x;
    rows.push([`${a}(${L(1, b)}) ${c < 0 ? '-' : '+'} ${Math.abs(c) === 1 ? '' : Math.abs(c)}x = ${rhs}`, R.given]);
    rows.push([`${sum([{ coef: a, sym: 'x' }, { coef: a * b }, { coef: c, sym: 'x' }])} = ${rhs}`, R.dist]);
    rows.push([`${L(a + c, a * b)} = ${rhs}`, R.simplify]);
    finish(a + c, a * b, rhs);
  } else if (template === 'distBoth') {
    const [a, c] = attempt('alg-db', () => {
      const a = nz(2, 7);
      const c = nz(2, 7, [a, a - 1, a + 1]);
      return [a, c];
    });
    const b = nz(-8, 8);
    // choose d so that a(x + b) = c(x + d) holds: c·d = (a − c)x + a·b
    const cd = (a - c) * x + a * b;
    if (cd % c !== 0) return algebraProof(rng, d);
    const dd = cd / c;
    if (dd === 0) return algebraProof(rng, d);
    rows.push([`${a}(${L(1, b)}) = ${c}(${L(1, dd)})`, R.given]);
    rows.push([`${L(a, a * b)} = ${L(c, c * dd)}`, R.dist]);
    rows.push([`${L(a - c, a * b)} = ${c * dd}`, R.subEq]);
    finish(a - c, a * b, c * dd);
  } else {
    // d = a(x + b): solve on the right, finish with the symmetric property
    const a = nz(2, 7);
    const b = nz(-9, 9);
    const lhs = a * (x + b);
    rows.push([`${lhs} = ${a}(${L(1, b)})`, R.given]);
    rows.push([`${lhs} = ${L(a, a * b)}`, R.dist]);
    rows.push([`${lhs - a * b} = ${L(a, 0)}`, a * b > 0 ? R.subEq : R.addEq]);
    rows.push([`${x} = x`, R.divEq]);
    rows.push([`x = ${x}`, R.symEq]);
  }
  // statement alternatives: arithmetic slips (wrong right-hand side)
  const stmtAlts: Record<number, string[]> = {};
  rows.forEach(([s], i) => {
    if (i === 0) return;
    const mm = /^(.*) = (-?\d+)$/.exec(s);
    if (mm) stmtAlts[i] = [1, -1, 2].map((k) => `${mm[1]} = ${Number(mm[2]) + k}`);
  });
  return { givens: [rows[0]![0]], prove: rows[rows.length - 1]![0], rows, stmtAlts, alt: '' };
}

// ---------------------------------------------------------------- transversal figure (numbered angles)

type Pos = 'TL' | 'TR' | 'BL' | 'BR';
interface Slot {
  at: 0 | 1;
  pos: Pos;
}
const SLOTS: Slot[] = [0, 1].flatMap((at) => (['TL', 'TR', 'BL', 'BR'] as Pos[]).map((pos) => ({ at: at as 0 | 1, pos })));
type Rel = 'corr' | 'altInt' | 'altExt' | 'ssi' | 'sse' | 'vertical' | 'linear' | null;
const top = (p: Pos) => p[0] === 'T';
const right = (p: Pos) => p[1] === 'R';
function relationOf(a: Slot, b: Slot): Rel {
  if (a.at === b.at) {
    if (a.pos === b.pos) return null;
    return top(a.pos) !== top(b.pos) && right(a.pos) !== right(b.pos) ? 'vertical' : 'linear';
  }
  const [u, l] = a.at === 0 ? [a, b] : [b, a];
  const interior = (s: Slot) => (s.at === 0 ? !top(s.pos) : top(s.pos));
  if (u.pos === l.pos) return 'corr';
  const sameSide = right(u.pos) === right(l.pos);
  if (interior(u) && interior(l)) return sameSide ? 'ssi' : 'altInt';
  if (!interior(u) && !interior(l)) return sameSide ? 'sse' : 'altExt';
  return null;
}
const measureAt = (s: Slot, theta: number) => (s.pos === 'TR' || s.pos === 'BL' ? theta : 180 - theta);
const THEOREM: Record<string, string> = { corr: R.corr, altInt: R.altInt, altExt: R.altExt };
const CONVERSE: Record<string, string> = { corr: R.convCorr, altInt: R.convAltInt, altExt: R.convAltExt, ssi: R.convSsi };

interface Transversal {
  data: FigureData;
  label: (s: Slot) => number;
  draw: (lineNames: boolean) => Diagram;
  theta: number;
}

function transversal(rng: Rng, names: { p: string; q: string; t: string }): Transversal {
  const theta = rng.pick([rng.int(40, 75), rng.int(105, 140)]);
  const phi = rng.int(-10, 10);
  const u = dirDeg(phi);
  const t = dirDeg(phi + theta);
  const I0: Pt = [0, 0];
  const I1 = add(I0, mul(t, -1.15 / Math.sin((theta * Math.PI) / 180)));
  const Lh = 1.45;
  const numbers = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
  const label = (s: Slot) => numbers[SLOTS.findIndex((q) => q.at === s.at && q.pos === s.pos)]!;
  const lines: Record<string, [Pt, Pt]> = {
    [names.p]: [add(I0, mul(u, -Lh)), add(I0, mul(u, Lh))],
    [names.q]: [add(I1, mul(u, -Lh)), add(I1, mul(u, Lh))],
    [names.t]: [add(I0, mul(t, 0.85)), add(I1, mul(t, -0.85))],
  };
  const numbered: Record<string, [Pt, Pt, Pt]> = {};
  for (const s of SLOTS) {
    const I = s.at === 0 ? I0 : I1;
    numbered[String(label(s))] = [add(I, mul(u, right(s.pos) ? 1 : -1)), I, add(I, mul(t, top(s.pos) ? 1 : -1))];
  }
  const data = transformAll(rng, { points: {}, lines, numbered }, 12);
  const draw = (lineNames: boolean) => {
    const pts = Object.values(data.lines!).flat();
    const b = builderFor(pts, 200);
    for (const [name, [p, q]] of Object.entries(data.lines!)) {
      const dd = sub(q, p);
      b.arrow(add(p, mul(dd, -0.04)), add(q, mul(dd, 0.04)), { both: true, weight: 1.3 });
      if (lineNames) b.label(add(q, mul(unit(dd), b.px(14))), name, 'c');
    }
    for (const [n, [a, v, c]] of Object.entries(data.numbered!)) {
      const bis = DiagramBuilder.bisector(v, a, c);
      const s = SLOTS[numbers.indexOf(Number(n))]!;
      const angDeg = measureAt(s, theta);
      const dpx = Math.max(13, 9 / Math.sin((angDeg * Math.PI) / 360));
      b.label(add(v, mul(bis, b.px(dpx))), n, 'c');
    }
    return b.build('Two lines cut by a transversal; angles numbered 1 to 8');
  };
  return { data, label, draw, theta };
}

// ---------------------------------------------------------------- segment and angle proofs

function segmentAngleProof(rng: Rng, d: Difficulty): Proof {
  const kind = d === 'easy' ? rng.pick(['segAdd', 'midpoints', 'vertChain']) : d === 'medium' ? rng.pick(['segAdd', 'segSub', 'vertical', 'supplements']) : rng.pick(['segSub', 'supplements', 'bisector', 'vertical']);
  if (kind === 'segAdd' || kind === 'segSub' || kind === 'midpoints') {
    const [A, B, C, D] = randomLetters(rng, 4) as [string, string, string, string];
    const p = rng.int(3, 7);
    const q = kind === 'midpoints' ? p : rng.int(2, 7);
    const pts: Record<string, Pt> = { [A]: [0, 0], [B]: [p, 0], [C]: [p + q, 0], [D]: [2 * p + q, 0] };
    const data = transformAll(rng, { points: pts }, 20);
    const P = data.points;
    const b = builderFor(Object.values(P), 240);
    b.segment(P[A]!, P[D]!, { weight: 1.5 });
    const dir = unit(sub(P[D]!, P[A]!));
    const nrm: Pt = [-dir[1], dir[0]];
    for (const n of [A, B, C, D]) {
      b.dot(P[n]!);
      b.label(add(P[n]!, mul(nrm, b.px(11))), n, 'c');
    }
    const diagram = b.build(`Points ${A}, ${B}, ${C}, ${D} on a segment, in that order`);
    if (kind === 'midpoints') {
      const rows: Row[] = [
        [midS(B, A + C), R.given],
        [segC(A + B, B + C), R.defMid],
        [midS(C, B + D), R.given],
        [segC(B + C, C + D), R.defMid],
        [segC(A + B, C + D), R.transitive],
      ];
      return { givens: [rows[0]![0], rows[2]![0]], prove: rows[4]![0], rows, diagram, points: P, stmtAlts: { 1: [segC(A + B, A + C), segC(A + C, B + C)], 3: [segC(B + C, B + D)] }, alt: '' };
    }
    if (kind === 'segAdd') {
      const rows: Row[] = [
        [segC(A + B, C + D), R.given],
        [`${A}${B} = ${C}${D}`, R.defCongSeg],
        [`${B}${C} = ${B}${C}`, R.reflexive],
        [`${A}${B} + ${B}${C} = ${B}${C} + ${C}${D}`, R.addEq],
        [`${A}${B} + ${B}${C} = ${A}${C}`, R.segAdd],
        [`${B}${C} + ${C}${D} = ${B}${D}`, R.segAdd],
        [`${A}${C} = ${B}${D}`, R.substitution],
        [segC(A + C, B + D), R.defCongSeg],
      ];
      return { givens: [rows[0]![0]], prove: rows[7]![0], rows, diagram, points: P, stmtAlts: { 4: [`${A}${B} + ${B}${C} = ${B}${D}`], 5: [`${B}${C} + ${C}${D} = ${A}${D}`] }, alt: '' };
    }
    const rows: Row[] = [
      [segC(A + C, B + D), R.given],
      [`${A}${C} = ${B}${D}`, R.defCongSeg],
      [`${A}${B} + ${B}${C} = ${A}${C}`, R.segAdd],
      [`${B}${C} + ${C}${D} = ${B}${D}`, R.segAdd],
      [`${A}${B} + ${B}${C} = ${B}${C} + ${C}${D}`, R.substitution],
      [`${A}${B} = ${C}${D}`, R.subEq],
      [segC(A + B, C + D), R.defCongSeg],
    ];
    return { givens: [rows[0]![0]], prove: rows[6]![0], rows, diagram, points: P, stmtAlts: { 2: [`${A}${B} + ${B}${C} = ${B}${D}`] }, alt: '' };
  }
  if (kind === 'bisector') {
    const [A, B, C, D] = randomLetters(rng, 4) as [string, string, string, string];
    const half = rng.int(25, 70);
    const start = rng.int(0, 359);
    const pts: Record<string, Pt> = { [B]: [0, 0], [A]: dirDeg(start), [D]: dirDeg(start + half), [C]: dirDeg(start + 2 * half) };
    const data = transformAll(rng, { points: pts }, 0);
    const P = data.points;
    const b = builderFor([...Object.values(P), [0, 0]], 160);
    for (const n of [A, D, C]) b.arrow(P[B]!, add(P[B]!, mul(sub(P[n]!, P[B]!), 1.12)), { weight: 1.3 });
    for (const n of [A, D, C]) b.label(add(P[n]!, mul(unit(sub(P[n]!, P[B]!)), b.px(16))), n, 'c');
    b.dot(P[B]!);
    b.label(add(P[B]!, mul(unit(sub(P[B]!, P[D]!)), b.px(10))), B, 'c');
    const rows: Row[] = [
      [bisS(B + D, A + B + C), R.given],
      [angC(A + B + D, D + B + C), R.defBis],
      [`${mA(A + B + D)} = ${mA(D + B + C)}`, R.defCongAng],
      [`${mA(A + B + D)} + ${mA(D + B + C)} = ${mA(A + B + C)}`, R.angAdd],
      [`${mA(A + B + D)} + ${mA(A + B + D)} = ${mA(A + B + C)}`, R.substitution],
      [`2${mA(A + B + D)} = ${mA(A + B + C)}`, R.simplify],
      [`${mA(A + B + C)} = 2${mA(A + B + D)}`, R.symEq],
    ];
    return { givens: [rows[0]![0]], prove: rows[6]![0], rows, diagram: b.build(`Angle ${A}${B}${C} with ray ${B}${D} in its interior`), points: P, alt: '' };
  }
  // numbered angles at two intersections (the lines are drawn parallel so the givens are true)
  const T = transversal(rng, { p: 'p', q: 'q', t: 't' });
  const diagram = T.draw(false);
  const byRel = (s: Slot, rel: Rel) => SLOTS.filter((o) => relationOf(s, o) === rel);
  const a = rng.pick(SLOTS);
  // b: an angle at the other intersection with the same measure
  const b = rng.pick(SLOTS.filter((o) => o.at !== a.at && measureAt(o, T.theta) === measureAt(a, T.theta)));
  const n = (s: Slot) => T.label(s);
  const va = byRel(a, 'vertical')[0]!;
  const vb = byRel(b, 'vertical')[0]!;
  const base = { diagram, numbered: T.data.numbered, points: {}, alt: '' };
  if (kind === 'vertChain') {
    const rows: Row[] = [
      [angC(n(a), n(b)), R.given],
      [angC(n(b), n(vb)), R.vertical],
      [angC(n(a), n(vb)), R.transitive],
    ];
    const other = byRel(b, 'linear')[0]!;
    return { ...base, givens: [rows[0]![0]], prove: rows[2]![0], rows, stmtAlts: { 1: [angC(n(b), n(other))] } };
  }
  if (kind === 'vertical') {
    const rows: Row[] = [
      [angC(n(a), n(b)), R.given],
      [angC(n(va), n(a)), R.vertical],
      [angC(n(va), n(b)), R.transitive],
      [angC(n(b), n(vb)), R.vertical],
      [angC(n(va), n(vb)), R.transitive],
    ];
    return { ...base, givens: [rows[0]![0]], prove: rows[4]![0], rows, stmtAlts: { 1: [angC(byRel(a, 'linear')[0] ? n(byRel(a, 'linear')[0]!) : n(vb), n(a))] } };
  }
  // congruent supplements
  const la = rng.pick(byRel(a, 'linear'));
  const lb = byRel(b, 'linear').find((o) => o.pos[0] === la.pos[0] || o.pos[1] === la.pos[1]) ?? byRel(b, 'linear')[0]!;
  if (measureAt(la, T.theta) !== measureAt(lb, T.theta)) return segmentAngleProof(rng, d);
  const rows: Row[] = [
    [angC(n(a), n(b)), R.given],
    [suppS(n(a), n(la)), R.linearPair],
    [suppS(n(b), n(lb)), R.linearPair],
    [angC(n(la), n(lb)), R.congSupp],
  ];
  return { ...base, givens: [rows[0]![0]], prove: rows[3]![0], rows };
}

// ---------------------------------------------------------------- parallel-line proofs

function parallelProof(rng: Rng, d: Difficulty): Proof {
  const lp = rng.pick(['p', 'm', 'j', 'r']);
  const lq = { p: 'q', m: 'n', j: 'k', r: 's' }[lp]!;
  const T = transversal(rng, { p: lp, q: lq, t: 't' });
  const diagram = T.draw(true);
  const n = (s: Slot) => T.label(s);
  const kind = d === 'easy' ? rng.pick(['direct', 'converse']) : d === 'medium' ? rng.pick(['chain', 'converseSsi', 'ssi', 'converse']) : rng.pick(['chain', 'converseChain', 'suppChain']);
  const pairs = (rels: Rel[]) => {
    const out: Array<[Slot, Slot, Rel]> = [];
    for (const a of SLOTS) for (const b of SLOTS) if (a.at === 0 && b.at === 1 && rels.includes(relationOf(a, b))) out.push([a, b, relationOf(a, b)]);
    return out;
  };
  const vert = (s: Slot) => SLOTS.find((o) => relationOf(s, o) === 'vertical')!;
  const lin = (s: Slot) => SLOTS.filter((o) => relationOf(s, o) === 'linear');
  const par = parS(lp, lq);
  const base = { diagram, numbered: T.data.numbered, lines: T.data.lines, points: {}, alt: '' };
  const swap = <X>(xs: [X, X]): [X, X] => (rng.bool() ? xs : [xs[1], xs[0]]);
  if (kind === 'direct' || kind === 'converse') {
    const [a, b, rel] = rng.pick(pairs(['corr', 'altInt', 'altExt']));
    const [x, y] = swap([a, b]);
    if (kind === 'direct') {
      const rows: Row[] = [
        [par, R.given],
        [angC(n(x), n(y)), THEOREM[rel!]!],
      ];
      return { ...base, givens: [par], prove: rows[1]![0], rows };
    }
    const rows: Row[] = [
      [angC(n(x), n(y)), R.given],
      [par, CONVERSE[rel!]!],
    ];
    return { ...base, givens: [rows[0]![0]], prove: par, rows };
  }
  if (kind === 'ssi' || kind === 'converseSsi') {
    const [a, b] = swap(rng.pick(pairs(['ssi'])).slice(0, 2) as [Slot, Slot]);
    if (kind === 'ssi') {
      const rows: Row[] = [
        [par, R.given],
        [suppS(n(a), n(b)), R.ssi],
      ];
      return { ...base, givens: [par], prove: rows[1]![0], rows };
    }
    const rows: Row[] = [
      [suppS(n(a), n(b)), R.given],
      [par, R.convSsi],
    ];
    return { ...base, givens: [rows[0]![0]], prove: par, rows };
  }
  // chains through a vertical angle
  const [a, c, rel] = rng.pick(pairs(['corr', 'altInt', 'altExt']));
  const [first, second] = rng.bool() ? [a, c] : [c, a];
  const bv = vert(second);
  if (kind === 'chain') {
    const rows: Row[] = [
      [par, R.given],
      [angC(n(first), n(second)), THEOREM[rel!]!],
      [angC(n(second), n(bv)), R.vertical],
      [angC(n(first), n(bv)), R.transitive],
    ];
    return { ...base, givens: [par], prove: rows[3]![0], rows, stmtAlts: { 2: [angC(n(second), n(lin(second)[0]!))] } };
  }
  if (kind === 'converseChain') {
    const rows: Row[] = [
      [angC(n(first), n(bv)), R.given],
      [angC(n(bv), n(second)), R.vertical],
      [angC(n(first), n(second)), R.transitive],
      [par, CONVERSE[rel!]!],
    ];
    // the given pair is itself related (e.g. alternate exterior): its converse would also be valid
    const relGiven = relationOf(first, bv);
    const wrongConv = Object.entries(CONVERSE)
      .filter(([k]) => k !== rel && k !== relGiven)
      .map(([, v]) => v);
    return { ...base, givens: [rows[0]![0]], prove: par, rows, stmtAlts: { 1: [angC(n(bv), n(lin(bv)[0]!))] }, reasonAlts: { 3: [...wrongConv, THEOREM[rel!]!] } };
  }
  // same-side angles shown supplementary through a linear pair
  const l2 = rng.pick(lin(second));
  const rows: Row[] = [
    [par, R.given],
    [angC(n(first), n(second)), THEOREM[rel!]!],
    [suppS(n(second), n(l2)), R.linearPair],
    [`${mA(n(second))} + ${mA(n(l2))} = 180^\\circ`, R.defSupp],
    [`${mA(n(first))} = ${mA(n(second))}`, R.defCongAng],
    [`${mA(n(first))} + ${mA(n(l2))} = 180^\\circ`, R.substitution],
    [suppS(n(first), n(l2)), R.defSupp],
  ];
  return { ...base, givens: [par], prove: rows[6]![0], rows };
}

// ---------------------------------------------------------------- congruence and similarity proofs

type Crit = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'HL';

interface Built {
  givens: string[];
  rows: Row[];
  tri: [string, string];
  /** Candidate CPCTC conclusions (corresponding parts not already shown). */
  cpctc: string[];
  stmtAlts?: Record<number, string[]>;
}

function congruenceProof(rng: Rng, d: Difficulty, similar = false): Proof {
  const layout = similar ? rng.pick(['nested', 'bowtie']) : rng.pick(['iso', 'bowtie', 'para', 'kite']);
  const names = randomLetters(rng, 5);
  let built: Built;
  let data: FigureData;
  let segments: string[];
  let alt: string;
  if (layout === 'iso') {
    const [A, B, C, D] = names as [string, string, string, string];
    const h = rng.int(12, 22) / 10;
    data = transformAll(rng, { points: { [A]: [-1, 0], [B]: [0, h], [C]: [1, 0], [D]: [0, 0] } });
    segments = [A + B, B + C, A + C, B + D];
    alt = `Triangle ${A}${B}${C} with segment ${B}${D} to side ${A}${C}`;
    const crit = rng.pick<Crit>(['SSS', 'SAS', 'SAS', 'ASA', 'AAS', 'HL']);
    const T1 = A + B + D;
    const T2 = C + B + D;
    const refl: Row = [segC(B + D, B + D), R.reflexive];
    const rightRows: Row[] = [
      [perpS(B + D, A + C), R.given],
      [rightsS(A + D + B, C + D + B), R.defPerp],
    ];
    const g = (s: string): Row => [s, R.given];
    let rows: Row[];
    const variant = crit === 'SAS' ? rng.pick(['bis', 'perpMid']) : '';
    if (crit === 'SSS') rows = [g(segC(A + B, C + B)), g(midS(D, A + C)), [segC(A + D, C + D), R.defMid], refl, [triC(T1, T2), R.SSS]];
    else if (crit === 'SAS' && variant === 'bis') rows = [g(segC(A + B, C + B)), g(bisS(B + D, A + B + C)), [angC(A + B + D, C + B + D), R.defBis], refl, [triC(T1, T2), R.SAS]];
    else if (crit === 'SAS') rows = [g(midS(D, A + C)), [segC(A + D, C + D), R.defMid], ...rightRows, [angC(A + D + B, C + D + B), R.rightCong], refl, [triC(T1, T2), R.SAS]];
    else if (crit === 'ASA') rows = [g(bisS(B + D, A + B + C)), [angC(A + B + D, C + B + D), R.defBis], ...rightRows, [angC(A + D + B, C + D + B), R.rightCong], refl, [triC(T1, T2), R.ASA]];
    else if (crit === 'AAS') rows = [g(angC(B + A + D, B + C + D)), ...rightRows, [angC(A + D + B, C + D + B), R.rightCong], refl, [triC(T1, T2), R.AAS]];
    else rows = [...rightRows, [rtriS(T1, T2), R.defRightTri], g(segC(A + B, C + B)), refl, [triC(T1, T2), R.HL]];
    const shown = rows.map((r) => r[0]).join(' ');
    const cp = [segC(A + D, C + D), angC(B + A + D, B + C + D), angC(A + B + D, C + B + D), segC(A + B, C + B)].filter((s) => !shown.includes(s));
    built = { givens: rows.filter((r) => r[1] === R.given).map((r) => r[0]), rows, tri: [T1, T2], cpctc: cp, stmtAlts: { [rows.indexOf(refl)]: [segC(B + D, A + D), segC(A + B, B + D)] } };
  } else if (layout === 'bowtie') {
    const [A, B, C, D, E] = names as [string, string, string, string, string];
    const k = similar ? rng.int(13, 20) / 10 * (rng.bool() ? 1 : 1 / 1.6) : 1;
    const al = rng.int(150, 210);
    const be = al + rng.pick([-1, 1]) * rng.int(35, 70);
    const ra = rng.int(9, 13) / 10;
    const rb = rng.int(9, 13) / 10;
    const Ap = mul(dirDeg(al), ra);
    const Bp = mul(dirDeg(be), rb);
    data = transformAll(rng, { points: { [A]: Ap, [B]: Bp, [C]: [0, 0], [D]: mul(Ap, -k), [E]: mul(Bp, -k) } });
    segments = [A + D, B + E, A + B, D + E];
    alt = `Segments ${A}${D} and ${B}${E} intersecting at ${C}`;
    const T1 = A + C + B;
    const T2 = D + C + E;
    const vertical: Row = [angC(A + C + B, D + C + E), R.vertical];
    const par: Row = [parS(A + B, D + E), R.given];
    const altA: Row = [angC(B + A + C, E + D + C), R.altInt];
    const altB: Row = [angC(A + B + C, D + E + C), R.altInt];
    if (similar) {
      const rows: Row[] = rng.bool() ? [par, altA, vertical, [triS(T1, T2), R.AA]] : [par, altA, altB, [triS(T1, T2), R.AA]];
      built = { givens: [par[0]], rows, tri: [T1, T2], cpctc: [`\\frac{${A}${C}}{${D}${C}} = \\frac{${A}${B}}{${D}${E}}`, `\\frac{${B}${C}}{${E}${C}} = \\frac{${A}${B}}{${D}${E}}`], stmtAlts: { 1: [angC(B + A + C, D + E + C)] } };
    } else {
      const crit = rng.pick<Crit>(['SAS', 'ASA', 'AAS', 'ASA']);
      let rows: Row[];
      const g = (s: string): Row => [s, R.given];
      if (crit === 'SAS') rows = [g(midS(C, A + D)), [segC(A + C, D + C), R.defMid], g(midS(C, B + E)), [segC(B + C, E + C), R.defMid], vertical, [triC(T1, T2), R.SAS]];
      else if (crit === 'AAS') rows = [par, altA, vertical, g(midS(C, B + E)), [segC(B + C, E + C), R.defMid], [triC(T1, T2), R.AAS]];
      else if (rng.bool()) rows = [par, altA, g(midS(C, A + D)), [segC(A + C, D + C), R.defMid], vertical, [triC(T1, T2), R.ASA]];
      else rows = [par, g(segC(A + B, D + E)), altA, altB, [triC(T1, T2), R.ASA]];
      const shown = rows.map((r) => r[0]).join(' ');
      const cp = [segC(A + B, D + E), angC(A + B + C, D + E + C), segC(A + C, D + C), segC(B + C, E + C), angC(B + A + C, E + D + C)].filter((s) => !shown.includes(s));
      built = { givens: rows.filter((r) => r[1] === R.given).map((r) => r[0]), rows, tri: [T1, T2], cpctc: cp, stmtAlts: { [rows.indexOf(vertical) >= 0 ? rows.indexOf(vertical) : 2]: [angC(A + C + B, A + C + E), angC(A + C + B, B + C + D)] } };
    }
  } else if (layout === 'para') {
    const [A, B, C, D] = names as [string, string, string, string];
    const w = rng.int(14, 20) / 10;
    const s = rng.int(3, 8) / 10;
    const h = rng.int(8, 12) / 10;
    data = transformAll(rng, { points: { [A]: [0, 0], [B]: [w, 0], [C]: [w + s, h], [D]: [s, h] } });
    segments = [A + B, B + C, C + D, D + A, A + C];
    alt = `Quadrilateral ${A}${B}${C}${D} with diagonal ${A}${C}`;
    const T1 = A + B + C;
    const T2 = C + D + A;
    const refl: Row = [segC(A + C, C + A), R.reflexive];
    const g = (s2: string): Row => [s2, R.given];
    const crit = rng.pick<Crit>(['SAS', 'ASA', 'SSS']);
    let rows: Row[];
    if (crit === 'SAS') rows = [g(parS(A + B, D + C)), g(segC(A + B, D + C)), [angC(B + A + C, D + C + A), R.altInt], refl, [triC(T1, T2), R.SAS]];
    else if (crit === 'ASA') rows = [g(parS(A + B, D + C)), [angC(B + A + C, D + C + A), R.altInt], g(parS(A + D, B + C)), [angC(B + C + A, D + A + C), R.altInt], refl, [triC(T1, T2), R.ASA]];
    else rows = [g(segC(A + B, C + D)), g(segC(B + C, D + A)), refl, [triC(T1, T2), R.SSS]];
    const shown = rows.map((r) => r[0]).join(' ');
    const cp = [angC(A + B + C, C + D + A), segC(B + C, D + A), segC(A + B, C + D)].filter((s2) => !shown.includes(s2));
    built = { givens: rows.filter((r) => r[1] === R.given).map((r) => r[0]), rows, tri: [T1, T2], cpctc: cp, stmtAlts: { [rows.indexOf(refl)]: [segC(A + C, B + D), segC(A + C, A + B)] } };
  } else if (layout === 'kite') {
    const [A, B, C, D] = names as [string, string, string, string];
    const t = rng.int(10, 16) / 10;
    const bt = rng.int(5, 9) / 10;
    const w = rng.int(6, 10) / 10;
    data = transformAll(rng, { points: { [A]: [0, t], [B]: [-w, 0], [C]: [0, -bt], [D]: [w, 0] } });
    segments = [A + B, B + C, C + D, D + A, A + C];
    alt = `Kite ${A}${B}${C}${D} with diagonal ${A}${C}`;
    const T1 = A + B + C;
    const T2 = A + D + C;
    const refl: Row = [segC(A + C, A + C), R.reflexive];
    const g = (s2: string): Row => [s2, R.given];
    const crit = rng.pick<Crit>(['SSS', 'SAS', 'ASA']);
    let rows: Row[];
    if (crit === 'SSS') rows = [g(segC(A + B, A + D)), g(segC(C + B, C + D)), refl, [triC(T1, T2), R.SSS]];
    else if (crit === 'SAS') rows = [g(segC(A + B, A + D)), g(bisS(A + C, B + A + D)), [angC(B + A + C, D + A + C), R.defBis], refl, [triC(T1, T2), R.SAS]];
    else rows = [g(bisS(A + C, B + A + D)), [angC(B + A + C, D + A + C), R.defBis], g(bisS(C + A, B + C + D)), [angC(B + C + A, D + C + A), R.defBis], refl, [triC(T1, T2), R.ASA]];
    const shown = rows.map((r) => r[0]).join(' ');
    const cp = [angC(A + B + C, A + D + C), segC(B + C, D + C), angC(B + A + C, D + A + C)].filter((s2) => !shown.includes(s2));
    built = { givens: rows.filter((r) => r[1] === R.given).map((r) => r[0]), rows, tri: [T1, T2], cpctc: cp, stmtAlts: { [rows.indexOf(refl)]: [segC(A + C, B + D)] } };
  } else {
    // nested triangles with DE ∥ BC
    const [A, B, C, D, E] = names as [string, string, string, string, string];
    const tt = rng.int(4, 6) / 10;
    const Ap: Pt = [rng.int(-3, 3) / 10, rng.int(14, 20) / 10];
    const Bp: Pt = [-1, 0];
    const Cp: Pt = [1, 0];
    data = transformAll(rng, { points: { [A]: Ap, [B]: Bp, [C]: Cp, [D]: add(Ap, mul(sub(Bp, Ap), tt)), [E]: add(Ap, mul(sub(Cp, Ap), tt)) } });
    segments = [A + B, A + C, B + C, D + E];
    alt = `Triangle ${A}${B}${C} with segment ${D}${E} parallel to ${B}${C}`;
    const T1 = A + D + E;
    const T2 = A + B + C;
    const par: Row = [parS(D + E, B + C), R.given];
    const c1: Row = [angC(A + D + E, A + B + C), R.corr];
    const c2: Row = [angC(A + E + D, A + C + B), R.corr];
    const refl: Row = [angC(D + A + E, B + A + C), R.reflexive];
    const rows: Row[] = rng.bool() ? [par, c1, c2, [triS(T1, T2), R.AA]] : [par, c1, refl, [triS(T1, T2), R.AA]];
    built = { givens: [par[0]], rows, tri: [T1, T2], cpctc: [`\\frac{${A}${D}}{${A}${B}} = \\frac{${D}${E}}{${B}${C}}`, `\\frac{${A}${E}}{${A}${C}} = \\frac{${D}${E}}{${B}${C}}`], stmtAlts: { 1: [angC(A + D + E, A + C + B)] } };
  }
  const rows = [...built.rows];
  let prove = rows[rows.length - 1]![0];
  if (d === 'hard' && built.cpctc.length) {
    const target = rng.pick(built.cpctc);
    rows.push([target, similar ? R.defSim : R.cpctc]);
    prove = target;
  }
  const b = drawNamed(data, segments, 170);
  return { givens: built.givens, prove, rows, diagram: b.build(alt), points: data.points, stmtAlts: built.stmtAlts, alt };
}

// ---------------------------------------------------------------- topics

type Family = 'algebra' | 'segments' | 'parallel' | 'congruence' | 'similarity';
const FAMILY_GEN: Record<Family, (rng: Rng, d: Difficulty) => Proof> = {
  algebra: algebraProof,
  segments: segmentAngleProof,
  parallel: parallelProof,
  congruence: (rng, d) => congruenceProof(rng, d, false),
  similarity: (rng, d) => congruenceProof(rng, d, true),
};

function checkData(p: Proof, mode: 'full' | 'fill'): Record<string, unknown> {
  return { kind: 'geometry.proof', mode, points: p.points ?? {}, lines: p.lines ?? {}, numbered: p.numbered ?? {} };
}

function fullTopic(family: Family, id: string, title: string, description: string, instruction: string) {
  return defineTopic({
    id,
    subject: 'geometry',
    category: 'Proofs',
    title,
    description,
    instruction,
    multipleChoice: false,
    defaultCount: family === 'algebra' ? 6 : 4,
    options: [],
    generate(ctx): ProblemContent {
      const p = FAMILY_GEN[family](ctx.rng, ctx.difficulty);
      return {
        question: `${header(p)} ${m(blankTable(p.rows.length))}`,
        answer: m(proofTable(p.rows)),
        steps: [`Start from the given ${p.givens.length > 1 ? 'statements' : 'statement'} and end with the statement to prove; every statement needs a reason.`],
        diagram: p.diagram,
        check: checkData(p, 'full'),
      };
    },
  });
}

export const algebraicProofs = fullTopic('algebra', 'geo.proof-algebra', 'Algebraic Proofs', 'Solve an equation and justify every step with a property of equality.', 'Complete each two-column proof: solve the equation and give a reason for every step.');
export const segmentAngleProofs = fullTopic(
  'segments',
  'geo.proof-segments-angles',
  'Segment and Angle Proofs',
  'Two-column proofs with segment addition, midpoints, vertical angles, linear pairs and angle bisectors.',
  'Write a two-column proof.',
);
export const parallelLineProofs = fullTopic('parallel', 'geo.proof-parallel', 'Parallel Lines Proofs', 'Prove angle pairs congruent or lines parallel using transversal angle theorems and their converses.', 'Write a two-column proof.');
export const congruenceProofs = fullTopic(
  'congruence',
  'geo.proof-congruence',
  'Triangle Congruence Proofs',
  'Prove triangles congruent by SSS, SAS, ASA, AAS or HL (and parts congruent by CPCTC).',
  'Write a two-column proof.',
);
export const similarityProofs = fullTopic('similarity', 'geo.proof-similarity', 'Similar Triangle Proofs', 'Prove triangles similar by AA similarity (and sides proportional).', 'Write a two-column proof.');

const FAMILIES: Family[] = ['algebra', 'segments', 'parallel', 'congruence', 'similarity'];

export const proofFillIn = defineTopic({
  id: 'geo.proof-fill-in',
  subject: 'geometry',
  category: 'Proofs',
  title: 'Proofs: Fill in the Missing Steps',
  description: 'Two-column proofs with some statements or reasons missing.',
  instruction: 'Fill in the missing statements and reasons of each proof.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'family',
      label: 'Proofs about',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'algebra', label: 'Algebra (properties of equality)' },
        { value: 'segments', label: 'Segments and angles' },
        { value: 'parallel', label: 'Parallel lines' },
        { value: 'congruence', label: 'Triangle congruence' },
        { value: 'similarity', label: 'Similar triangles' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'family');
    const family = chosen === 'any' ? rng.pick(FAMILIES) : (chosen as Family);
    const p = FAMILY_GEN[family](rng, difficulty);
    // blanks: reasons (never "Given"), plus one statement at medium/hard when an alternative is known
    const nBlank = Math.min(difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3, p.rows.length - 1);
    const reasonRows = p.rows.map((_, i) => i).filter((i) => p.rows[i]![1] !== R.given && WRONG[p.rows[i]![1]]);
    const stmtRows = Object.keys(p.stmtAlts ?? {})
      .map(Number)
      .filter((i) => i > 0 && i < p.rows.length && p.rows[i]![1] !== R.given);
    const blanks: Array<{ key: string; correct: string; wrong: string[] }> = [];
    const useStmt = difficulty !== 'easy' && stmtRows.length > 0 && rng.bool(0.6);
    if (useStmt) {
      const i = rng.pick(stmtRows);
      blanks.push({ key: `s${i}`, correct: m(p.rows[i]![0]), wrong: p.stmtAlts![i]!.map(m) });
    }
    for (const i of rng.shuffle(reasonRows)) {
      if (blanks.length >= nBlank) break;
      if (blanks.some((bl) => bl.key === `s${i}`)) continue;
      blanks.push({ key: `r${i}`, correct: p.rows[i]![1], wrong: p.reasonAlts?.[i] ?? WRONG[p.rows[i]![1]]! });
    }
    const order = (k: string) => Number(k.slice(1)) * 2 + (k[0] === 'r' ? 1 : 0);
    blanks.sort((a, b) => order(a.key) - order(b.key));
    const letters = 'abc';
    const marks = new Map(blanks.map((bl, i) => [bl.key, blankMark(letters[i]!)]));
    const fmt = (entries: string[]) => entries.map((e, i) => `(${letters[i]}) ${e}`).join('; ');
    const answer = fmt(blanks.map((bl) => bl.correct));
    const wrongs: string[] = [];
    for (let w = 0; w < 3; w++) {
      blanks.forEach((bl, i) => {
        const entries = blanks.map((x) => x.correct);
        entries[i] = bl.wrong[(w + i) % bl.wrong.length]!;
        wrongs.push(fmt(entries));
      });
    }
    return {
      question: `${header(p)} ${m(proofTable(p.rows, marks))}`,
      answer,
      steps: [m(proofTable(p.rows))],
      distractors: distinctDistractors(answer, rng.shuffle(wrongs), () => null),
      diagram: p.diagram,
      check: checkData(p, 'fill'),
    };
  },
});

