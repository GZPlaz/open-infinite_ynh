/** Systems by graphing: two-variable linear systems and systems of linear inequalities. */
import { graphPlane } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, variant } from '../../generator';
import { m, tuple } from '../../tex';
import type { ProblemContent } from '../../types';
import { drawLine, isStrict, latticePoints, lineY, slopeInterceptTex, standardForm, standardTex, type Line } from './helpers';
import { drawIneqs, GR, randomIneq, shadeWords, type LinearIneq } from './linear';
import { systemsOfEquations } from './systems';

const aligned = (rows: string[]) => `\\begin{aligned} ${rows.join(' \\\\ ')} \\end{aligned}`;
/** Put the alignment mark before the (first) relation symbol. */
const alignRow = (tex: string) => tex.replace(/ (\\le|\\ge|<|>|=) /, ' &$1 ');

// ================================================================ systems of inequalities

function regionShare(qs: LinearIneq[]): number {
  let n = 0;
  let inside = 0;
  for (let x = -GR + 0.5; x < GR; x += 1) {
    for (let y = -GR + 0.5; y < GR; y += 1) {
      n++;
      const ok = qs.every((q) => {
        const v = q.l.m === null ? x - q.l.b.value : y - (q.l.m.value * x + q.l.b.value);
        return q.rel === '<' || q.rel === '\\le' ? v < 0 : v > 0;
      });
      if (ok) inside++;
    }
  }
  return inside / n;
}

export const graphingSystemsOfInequalities = defineTopic({
  id: 'alg1.systems.graph-ineq',
  subject: 'algebra1',
  category: 'Systems of Equations and Inequalities',
  title: 'Graphing Systems of Linear Inequalities',
  description: 'Graph both boundary lines (dashed or solid) and shade the region that satisfies every inequality.',
  instruction: 'Sketch the solution to each system of inequalities.',
  multipleChoice: false,
  defaultCount: 4,
  options: [
    { type: 'boolean', id: 'standard', label: 'Standard form (medium and hard)', default: true },
    { type: 'boolean', id: 'hv', label: 'Include horizontal and vertical boundaries', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const standard = boolOpt(ctx, 'standard') && d !== 'easy';
    const hv = boolOpt(ctx, 'hv');
    const qs = attempt('inequality system', () => {
      const a = randomIneq(rng, d, standard, hv && rng.bool(0.2));
      const b = randomIneq(rng, d, standard, hv && rng.bool(0.2));
      const same = (a.l.m === null) === (b.l.m === null) && (a.l.m === null || a.l.m.eq(b.l.m!)) && a.l.b.eq(b.l.b);
      if (same) return null;
      const share = regionShare([a, b]);
      if (share < 0.08 || share > 0.6) return null;
      return [a, b];
    });
    const { b, w } = graphPlane(GR, 2);
    drawIneqs(b, w, qs);
    const desc = qs.map((q) => `${isStrict(q.rel) ? 'dashed' : 'solid'} $${slopeInterceptTex(q.l)}$`);
    const steps = qs.map((q) => `$${q.tex}$: ${isStrict(q.rel) ? 'dashed' : 'solid'} boundary $${slopeInterceptTex(q.l)}$, ${shadeWords(q)}.`);
    steps.push('The solution is the region where the two shadings overlap.');
    return {
      question: m(aligned(qs.map((q) => alignRow(q.tex)))),
      answer: `Boundaries: ${desc.join(' and ')}; shade the overlap of both half-planes`,
      steps,
      diagram: graphPlane(GR, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build('Solution region of the system'),
      check: { kind: 'algebra1.shading', range: GR },
    };
  },
});

// ================================================================ solving systems by graphing

export const solvingSystemsByGraphing = defineTopic({
  id: 'alg1.systems.graphing',
  subject: 'algebra1',
  category: 'Systems of Equations and Inequalities',
  title: 'Solving Systems by Graphing',
  description: 'Graph both lines and read the intersection point; parallel lines have no solution.',
  instruction: 'Solve each system by graphing.',
  multipleChoice: true,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'special', label: 'Include “no solution” / “infinitely many”', default: false }],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const special = boolOpt(ctx, 'special') && rng.bool(0.25) ? rng.pick(['none', 'all'] as const) : null;
    const slopes = d === 'easy' ? [-3, -2, -1, 1, 2, 3].map((s) => new Frac(s)) : [-3, -2, -1, 1, 2, 3, 0].map((s) => new Frac(s)).concat([new Frac(1, 2), new Frac(-1, 2), new Frac(2, 3), new Frac(-2, 3), new Frac(3, 2), new Frac(-1, 3)]);
    const { l1, l2, S } = attempt('graph system', () => {
      const S: [number, number] = [rng.int(-5, 5), rng.int(-5, 5)];
      const m1 = rng.pick(slopes);
      const m2 = rng.pick(slopes);
      const through = (mm: Frac) => lineY(mm, new Frac(S[1]).sub(mm.mul(S[0])));
      const l1 = through(m1);
      let l2: Line;
      if (special === 'none') l2 = lineY(m1, l1.b.add(rng.signedInt(2, 5, true)));
      else if (special === 'all') l2 = l1;
      else {
        if (m1.eq(m2)) return null;
        l2 = through(m2);
      }
      if (!l1.b.isInt() || !l2.b.isInt() || Math.abs(l1.b.value) > 8 || Math.abs(l2.b.value) > 8) return null;
      if (latticePoints(l1, GR - 1).length < 3 || latticePoints(l2, GR - 1).length < 3) return null;
      return { l1, l2, S };
    });
    const formOf = (l: Line, std: boolean) => {
      if (!std || l.m!.isZero()) return slopeInterceptTex(l);
      const s = standardForm(l);
      return standardTex(s.A, s.B, s.C);
    };
    const std1 = d === 'hard' || (d === 'medium' && rng.bool(0.5));
    const std2 = d === 'hard' ? rng.bool(0.7) : d === 'medium' ? !std1 || special === 'all' : special === 'all';
    const rows = [formOf(l1, std1), formOf(l2, special === 'all' ? true : std2)];
    if (special === 'all' && rows[0] === rows[1]) {
      // same line written differently: scale the standard form
      const s = standardForm(l2);
      const k = rng.pick([2, 3, -2]);
      rows[1] = standardTex(s.A * k, s.B * k, s.C * k);
    }
    const { b, w } = graphPlane(GR, 2);
    drawLine(b, l1, w);
    if (special !== 'all') drawLine(b, l2, w);
    if (!special) b.dot(S, false, 'accent');
    const pair = (x: number, y: number) => m(tuple([x, y]));
    let answer: string;
    let distractors: string[];
    const steps = [`Graph $${slopeInterceptTex(l1)}$ and $${slopeInterceptTex(l2)}$.`];
    if (special === 'none') {
      answer = 'No solution';
      steps.push('The lines are parallel (same slope, different intercepts), so they never meet.');
      distractors = distinctDistractors(answer, ['Infinitely many solutions', pair(0, l1.b.value), pair(0, l2.b.value)], (k) => pair(k, k));
    } else if (special === 'all') {
      answer = 'Infinitely many solutions';
      steps.push('Both equations describe the same line.');
      distractors = distinctDistractors(answer, ['No solution', pair(0, l1.b.value), pair(S[0], S[1])], (k) => pair(k, -k));
    } else {
      answer = pair(S[0], S[1]);
      steps.push(`The lines intersect at $${tuple(S)}$.`);
      distractors = distinctDistractors(answer, [pair(S[1], S[0]), pair(-S[0], S[1]), pair(S[0], -S[1]), pair(0, l1.b.value)], (k) => pair(S[0] + offset(k), S[1]));
    }
    return {
      question: m(aligned(rows.map(alignRow))),
      answer,
      steps,
      distractors,
      diagram: graphPlane(GR, 2).b.build('Blank coordinate plane'),
      answerDiagram: b.build('Graph of both lines'),
      check: { kind: 'algebra1.graphSystem', solution: special ?? [S[0], S[1]], eq: rows },
    };
  },
});

// ================================================================ elimination / substitution

export const systemsByElimination = variant(systemsOfEquations, {
  id: 'alg1.systems.elimination',
  title: 'Solving Systems by Elimination',
  category: 'Systems of Equations and Inequalities',
  description: 'Solve two-variable linear systems by adding multiples of the equations.',
  fixed: { method: 'elimination' },
});

export const systemsBySubstitution = variant(systemsOfEquations, {
  id: 'alg1.systems.substitution',
  title: 'Solving Systems by Substitution',
  category: 'Systems of Equations and Inequalities',
  description: 'Solve two-variable linear systems by substituting one equation into the other.',
  fixed: { method: 'substitution' },
});

