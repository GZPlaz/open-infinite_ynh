/** Triangle congruence: SSS, SAS, ASA, AAS, HL — or not enough information — from marked figures. */
import { DiagramBuilder, type Pt } from '../../diagram';
import { attempt, defineTopic } from '../../generator';
import type { Rng } from '../../rng';
import type { ProblemContent } from '../../types';
import { add, angleMarks, centroid, mid, mul, randomLetters, rotate, sub, ticks, unit } from './kit';
import { trianglePts } from './triangles';

type Crit = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'HL' | 'None';
type Layout = 'separate' | 'kite' | 'parallelogram' | 'vertical';
const ANSWER: Record<Crit, string> = { SSS: 'SSS', SAS: 'SAS', ASA: 'ASA', AAS: 'AAS', HL: 'HL', None: 'Not enough information' };

interface Marks {
  /** side i is opposite vertex i */
  S: number[];
  A: number[];
}

const others = (i: number) => [0, 1, 2].filter((j) => j !== i);

/** Mark sets realising `crit`, containing the implicit part (shared side 0 or vertical angle 0) when given. */
function marksFor(rng: Rng, crit: Crit, implicit: { side?: number; angle?: number }, right: number | null): Marks | null {
  const hasS = (m: Marks) => implicit.side === undefined || m.S.includes(implicit.side);
  const hasA = (m: Marks) => implicit.angle === undefined || m.A.includes(implicit.angle);
  const cands: Marks[] = [];
  for (let k = 0; k < 3; k++) {
    const [i, j] = others(k) as [number, number];
    if (crit === 'SAS') cands.push({ S: [i, j], A: [k] });
    if (crit === 'ASA') cands.push({ S: [k], A: [i, j] });
    if (crit === 'AAS') cands.push({ S: [i], A: [i, j] }, { S: [j], A: [i, j] });
    if (crit === 'None') {
      // SSA: two sides and an angle opposite one of them (not a right angle)
      if (right !== i) cands.push({ S: [i, j], A: [i] });
      if (right !== j) cands.push({ S: [i, j], A: [j] });
      cands.push({ S: [k], A: [] }, { S: [], A: [i, j] }, { S: [i, j], A: [] });
    }
  }
  if (crit === 'SSS') cands.push({ S: [0, 1, 2], A: [] });
  if (crit === 'None') cands.push({ S: [], A: [0, 1, 2] });
  if (crit === 'HL' && right !== null) for (const leg of others(right)) cands.push({ S: [right, leg], A: [right] });
  const ok = cands.filter((c) => hasS(c) && hasA(c) && !(crit === 'None' && right !== null && c.A.includes(right) && c.S.includes(right) && c.S.length === 2));
  return ok.length ? rng.pick(ok) : null;
}

export const triangleCongruence = defineTopic({
  id: 'geo.triangle-congruence',
  subject: 'geometry',
  category: 'Triangles',
  title: 'Triangle Congruence (SSS, SAS, ASA, AAS, HL)',
  description: 'Decide from the marked parts whether two triangles are congruent, and by which postulate or theorem.',
  instruction: 'State whether the triangles are congruent using the marked parts. If they are, name the postulate or theorem (SSS, SAS, ASA, AAS, HL); otherwise write “not enough information”.',
  multipleChoice: true,
  defaultCount: 9,
  options: [{ type: 'boolean', id: 'shared', label: 'Include shared sides and vertical angles', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const shared = ctx.options.shared === true && difficulty !== 'easy' && rng.bool(difficulty === 'hard' ? 0.7 : 0.35);
    const crit = rng.weighted<Crit>([
      ['SSS', 2],
      ['SAS', 3],
      ['ASA', 3],
      ['AAS', 3],
      ['HL', difficulty === 'easy' ? 0 : 2],
      ['None', 3],
    ]);
    const layout: Layout = shared ? rng.pick<Layout>(crit === 'HL' ? ['kite', 'parallelogram'] : ['kite', 'parallelogram', 'vertical']) : 'separate';
    const built = attempt('congruence', () => {
      const isRight = crit === 'HL' || rng.bool(0.15);
      // vertex angles; the right angle (if any) sits at a random vertex
      let ang: number[];
      if (isRight) {
        const a = rng.int(28, 62);
        ang = rng.shuffle([90, a, 90 - a]);
      } else {
        const a = rng.int(35, 95);
        const b = rng.int(30, 145 - a);
        ang = [a, b, 180 - a - b];
        if (ang[2]! < 28 || ang[2]! === 90) return null;
      }
      if (Math.min(Math.abs(ang[0]! - ang[1]!), Math.abs(ang[1]! - ang[2]!), Math.abs(ang[0]! - ang[2]!)) < 7) return null;
      const right = ang.indexOf(90);
      const implicit = layout === 'vertical' ? { angle: 0 } : layout === 'separate' ? {} : { side: 0 };
      const marks = marksFor(rng, crit, implicit, right >= 0 ? right : null);
      if (!marks) return null;
      // vertical layout needs a not-too-wide angle at the shared vertex
      if (layout === 'vertical' && ang[0]! > 80) return null;
      return { ang, right: right >= 0 ? right : null, marks };
    });
    const { ang, right, marks } = built;
    const T = trianglePts(ang[0]!, ang[1]!);
    const turn1 = rng.int(-20, 20) + (layout === 'separate' && rng.bool(0.3) ? 180 : 0);
    const T1 = T.map((p) => rotate(p, turn1, centroid(T)));
    let T2: Pt[];
    if (layout === 'separate') {
      const flip = rng.bool();
      const turn = rng.int(0, 359);
      const c = centroid(T1);
      const moved = T1.map((p) => rotate(flip ? ([2 * c[0] - p[0], p[1]] as Pt) : p, turn, c));
      const w1 = Math.max(...T1.map((p) => p[0]));
      const w2 = Math.min(...moved.map((p) => p[0]));
      const dy = centroid(T1)[1] - centroid(moved)[1];
      T2 = moved.map((p) => [p[0] - w2 + w1 + 0.45, p[1] + dy] as Pt);
    } else if (layout === 'kite') {
      // reflect vertex 0 across line P1P2
      const [P0, P1, P2] = T1 as [Pt, Pt, Pt];
      const d = unit(sub(P2, P1));
      const v = sub(P0, P1);
      const proj = add(P1, mul(d, v[0] * d[0] + v[1] * d[1]));
      T2 = [add(proj, sub(proj, P0)), P1, P2];
    } else if (layout === 'parallelogram') {
      const M = mid(T1[1]!, T1[2]!);
      T2 = T1.map((p) => sub(mul(M, 2), p));
    } else {
      // point reflection through vertex 0, slightly scaled triangles would not be congruent, so keep exact
      const V = T1[0]!;
      T2 = T1.map((p) => sub(mul(V, 2), p));
    }
    const all = [...T1, ...T2];
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const b = new DiagramBuilder(300 / Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.4));
    b.polygon(T1, { weight: 1.4 });
    b.polygon(T2, { weight: 1.4 });
    const implicitSide = layout === 'kite' || layout === 'parallelogram' ? 0 : -1;
    const implicitAngle = layout === 'vertical' ? 0 : -1;
    const sideTicks = rng.shuffle([1, 2, 3]);
    const angArcs = rng.shuffle([1, 2, 3]);
    for (const T of [T1, T2]) {
      for (const s of marks.S) if (s !== implicitSide) ticks(b, T[(s + 1) % 3]!, T[(s + 2) % 3]!, sideTicks[s]!);
      for (const a of marks.A) {
        if (a === implicitAngle) continue;
        const v = T[a]!;
        const p = T[(a + 1) % 3]!;
        const q = T[(a + 2) % 3]!;
        if (a === right) b.rightAngle(v, p, q, 9);
        else angleMarks(b, v, p, q, angArcs[a]!, 12);
      }
    }
    // names
    const L = randomLetters(rng, 6);
    const n1 = [L[0]!, L[1]!, L[2]!];
    let n2: string[];
    if (layout === 'separate') n2 = [L[3]!, L[4]!, L[5]!];
    else if (layout === 'kite') n2 = [L[3]!, n1[1]!, n1[2]!];
    else if (layout === 'parallelogram') n2 = [L[3]!, n1[2]!, n1[1]!];
    else n2 = [n1[0]!, L[3]!, L[4]!];
    const placed = new Set<string>();
    const nameAll = (T: Pt[], names: string[], ref: Pt) =>
      T.forEach((p, i) => {
        if (placed.has(names[i]!)) return;
        placed.add(names[i]!);
        const away = sub(p, ref);
        const len = Math.hypot(away[0], away[1]);
        const dir: Pt = len < 1e-9 ? [0, 1] : mul(away, 1 / len);
        b.label(add(p, mul(dir, b.px(9))), names[i]!, 'c');
      });
    if (layout === 'separate') {
      nameAll(T1, n1, centroid(T1));
      nameAll(T2, n2, centroid(T2));
    } else if (layout === 'vertical') {
      // shared vertex: put its name perpendicular to the bowtie axis
      const axis = unit(sub(mid(T1[1]!, T1[2]!), T1[0]!));
      b.label(add(T1[0]!, mul([-axis[1], axis[0]], b.px(11))), n1[0]!, 'c');
      placed.add(n1[0]!);
      nameAll(T1, n1, centroid(T1));
      nameAll(T2, n2, centroid(T2));
    } else {
      const c = centroid(all);
      nameAll(T1, n1, c);
      nameAll(T2, n2, c);
    }
    const answer = ANSWER[crit];
    const pool = (['SSS', 'SAS', 'ASA', 'AAS', 'HL', 'None'] as Crit[]).filter((c) => c !== crit).map((c) => ANSWER[c]);
    const distractors = rng.shuffle(pool);
    const tri1 = `\\triangle ${n1.join('')}`;
    const tri2 = `\\triangle ${n2.join('')}`;
    const partName = (T: string[], kind: 'S' | 'A', i: number) => (kind === 'S' ? `\\overline{${T[(i + 1) % 3]}${T[(i + 2) % 3]}}` : `\\angle ${T[i]}`);
    const parts = [...marks.S.map((s) => ['S', s] as const), ...marks.A.map((a) => ['A', a] as const)].map(([k, i]) => {
      const reason = k === 'S' && i === implicitSide ? ' (shared side)' : k === 'A' && i === implicitAngle ? ' (vertical angles)' : k === 'A' && i === right ? ' (right angles)' : '';
      return k === 'S' && i === implicitSide ? `$${partName(n1, 'S', i)}$ is shared${reason.replace(' (shared side)', '')}` : `$${partName(n1, k, i)} \\cong ${partName(n2, k, i)}$${reason}`;
    });
    const steps = [`Congruent parts: ${parts.join('; ')}.`, crit === 'None' ? 'These parts do not match any congruence postulate or theorem.' : `$${tri1} \\cong ${tri2}$ by ${crit}.`];
    return {
      question: `$${tri1}$ and $${tri2}$`,
      answer,
      steps,
      distractors,
      diagram: b.build(`Two triangles, ${n1.join('')} and ${n2.join('')}, with congruence marks`),
      check: { kind: 'geometry.congruence', T1, T2, S: marks.S.filter((s) => s !== implicitSide), A: marks.A.filter((a) => a !== implicitAngle) },
    };
  },
});
