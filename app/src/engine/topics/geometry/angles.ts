/** Angle relationships: complementary, supplementary, vertical angles, triangle sums. */
import { add, DiagramBuilder, dirDeg, mul, posToward, type Pt } from '../../diagram';
import { attempt, defineTopic, distinctDistractors, offset } from '../../generator';
import { linear, m, sum } from '../../tex';
import type { ProblemContent } from '../../types';

type Relation = 'linear' | 'complementary' | 'vertical' | 'triangle';

const TOTAL: Record<Relation, number> = { linear: 180, complementary: 90, vertical: 0, triangle: 180 };

/** (a·x + b)° as LaTeX. */
function exprTex(a: number, b: number): string {
  return b === 0 ? `${a === 1 ? '' : a}x^\\circ` : `(${linear(a, b)})^\\circ`;
}

function rayFigure(angles: number[], labels: string[], opts: { line?: boolean; rightAngle?: boolean }): DiagramBuilder {
  const f = new DiagramBuilder(80);
  const O: Pt = [0, 0];
  const R = 1.25;
  if (opts.line) f.arrow([-R, 0], [R, 0], { both: true, weight: 1.3 });
  // rays at the boundaries of consecutive angles
  let at = 0;
  const bounds = [0];
  for (const a of angles) bounds.push((at += a));
  bounds.forEach((deg, i) => {
    if (opts.line && (i === 0 || i === bounds.length - 1)) return;
    f.arrow(O, mul(dirDeg(deg), R), { weight: 1.3 });
  });
  if (opts.rightAngle) f.rightAngle(O, [1, 0], [0, 1], 9);
  angles.forEach((a, i) => {
    const from = bounds[i]!;
    const bis = dirDeg(from + a / 2);
    f.arc(O, f.px(i % 2 ? 22 : 17), from, from + a);
    f.label(add(O, mul(bis, f.px(30))), labels[i]!, posToward(bis));
  });
  f.dot(O);
  return f;
}

function verticalFigure(theta1: number, A: number, labels: [string, string]): DiagramBuilder {
  const f = new DiagramBuilder(80);
  const R = 1.25;
  for (const t of [theta1, theta1 + A]) f.arrow(mul(dirDeg(t + 180), R), mul(dirDeg(t), R), { both: true, weight: 1.3 });
  [theta1, theta1 + 180].forEach((start, i) => {
    const bis = dirDeg(start + A / 2);
    f.arc([0, 0], f.px(17), start, start + A);
    f.label(mul(bis, f.px(30)), labels[i]!, posToward(bis));
  });
  f.dot([0, 0]);
  return f;
}

function triangleFigure(A: number, B: number, names: [string, string, string]): DiagramBuilder {
  const f = new DiagramBuilder(150);
  const P0: Pt = [0, 0];
  const P1: Pt = [1, 0];
  const t = Math.sin((B * Math.PI) / 180) / Math.sin(((A + B) * Math.PI) / 180);
  const P2 = mul(dirDeg(A), t);
  f.polygon([P0, P1, P2], { weight: 1.4 });
  const c: Pt = [(P0[0] + P1[0] + P2[0]) / 3, (P0[1] + P1[1] + P2[1]) / 3];
  ([P0, P1, P2] as Pt[]).forEach((p, i) => {
    const away: Pt = [p[0] - c[0], p[1] - c[1]];
    f.label(p, names[i]!, posToward(away));
  });
  f.angleArc(P0, P1, P2, 16);
  f.angleArc(P1, P2, P0, 16);
  f.angleArc(P2, P0, P1, 16);
  return f;
}

export const angleRelationships = defineTopic({
  id: 'geo.angles',
  subject: 'geometry',
  title: 'Angle Relationships',
  description: 'Complementary and supplementary angles, linear pairs, vertical angles, triangle angle sum.',
  instruction: 'Find the value of x.',
  multipleChoice: true,
  defaultCount: 9,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const relation: Relation =
      difficulty === 'easy'
        ? rng.pick<Relation>(['linear', 'complementary', 'linear'])
        : difficulty === 'medium'
          ? rng.pick<Relation>(['linear', 'complementary', 'vertical'])
          : rng.pick<Relation>(['vertical', 'triangle', 'linear']);

    if (difficulty === 'easy') {
      const total = TOTAL[relation];
      const known = relation === 'linear' ? rng.int(35, 145) : rng.int(25, 65);
      const x = total - known;
      const knownFirst = rng.bool();
      const angles = knownFirst ? [known, x] : [x, known];
      const labels = knownFirst ? [`${known}^\\circ`, 'x^\\circ'] : ['x^\\circ', `${known}^\\circ`];
      const fig = rayFigure(angles, labels, { line: relation === 'linear', rightAngle: relation === 'complementary' });
      const answer = m(`x = ${x}`);
      return {
        question: relation === 'linear' ? 'The angles form a linear pair.' : 'The angles are complementary.',
        answer,
        steps: [m(`x + ${known} = ${total}`), m(`x = ${x}`)],
        distractors: distinctDistractors(answer, [m(`x = ${(relation === 'linear' ? 90 : 180) - known}`), m(`x = ${known}`), m(`x = ${x + 10}`)], (k) => m(`x = ${x + offset(k)}`)),
        diagram: fig.build(`${relation === 'linear' ? 'Linear pair' : 'Complementary angles'}: ${known} degrees and x degrees`),
        check: { kind: 'angles', relation, exprs: knownFirst ? [[0, known], [1, 0]] : [[1, 0], [0, known]], total },
      };
    }

    const p = attempt('angles', () => {
      const x = rng.int(3, 25);
      const count = relation === 'triangle' ? 3 : 2;
      const total = TOTAL[relation];
      let values: number[];
      if (relation === 'vertical') {
        const A = rng.int(40, 140);
        values = [A, A];
      } else if (relation === 'triangle') {
        const A = rng.int(30, 100);
        const B = rng.int(30, 150 - A);
        values = [A, B, 180 - A - B];
        if (values[2]! < 25) return null;
      } else {
        const lo = relation === 'linear' ? 40 : 30;
        const A = rng.int(lo, total - lo);
        values = [A, total - A];
      }
      const exprs = values.map((v) => {
        const a = rng.int(1, 6);
        return [a, v - a * x] as [number, number];
      });
      if (exprs.some(([a, b]) => Math.abs(b) > 70 || (a === 1 && b === 0))) return null;
      if (relation === 'vertical' && exprs[0]![0] === exprs[1]![0]) return null;
      if (count === 2 && exprs[0]![0] === exprs[1]![0] && exprs[0]![1] === exprs[1]![1]) return null;
      return { x, values, exprs };
    });
    const { x, values, exprs } = p;
    const names = relation === 'triangle' ? rng.pick<[string, string, string]>([['A', 'B', 'C'], ['P', 'Q', 'R'], ['X', 'Y', 'Z'], ['J', 'K', 'L']]) : (['1', '2', '3'] as [string, string, string]);
    const angleName = (i: number) => `m\\angle ${names[i]}`;
    const givens = exprs.map(([a, b], i) => m(`${angleName(i)} = ${exprTex(a, b)}`)).join(', ');
    let fig: DiagramBuilder;
    if (relation === 'vertical') fig = verticalFigure(rng.int(5, 35), values[0]!, ['1', '2']);
    else if (relation === 'triangle') fig = triangleFigure(values[0]!, values[1]!, names);
    else {
      const order = rng.bool() ? [0, 1] : [1, 0];
      const ordered = order.map((i) => values[i]!);
      fig = rayFigure(ordered, order.map((i) => names[i]!), { line: relation === 'linear', rightAngle: relation === 'complementary' });
    }
    const A = exprs.reduce((s, [a]) => s + a, 0);
    const B = exprs.reduce((s, [, b]) => s + b, 0);
    const steps: string[] = [];
    if (relation === 'vertical') {
      const [[a1, b1], [a2, b2]] = exprs as [[number, number], [number, number]];
      steps.push(`Vertical angles are congruent: $${linear(a1, b1)} = ${linear(a2, b2)}$`);
      steps.push(m(`${sum([{ coef: a1 - a2, sym: 'x' }])} = ${b2 - b1}`));
    } else {
      const reason = relation === 'linear' ? 'Linear pair' : relation === 'complementary' ? 'Complementary' : 'Triangle sum';
      steps.push(`${reason}: $${exprs.map(([a, b]) => `(${linear(a, b)})`).join(' + ')} = ${TOTAL[relation]}$`);
      steps.push(m(`${linear(A, B)} = ${TOTAL[relation]}`));
    }
    steps.push(m(`x = ${x}`));
    steps.push(values.map((v, i) => m(`${angleName(i)} = ${v}^\\circ`)).join(', '));
    const answer = m(`x = ${x}`);
    const wrongTotal = relation === 'complementary' ? 180 : 90;
    const alt = relation === 'vertical' ? null : (wrongTotal - B) / A;
    return {
      question: `${givens}.`,
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        [alt !== null && Number.isInteger(alt) && alt > 0 ? m(`x = ${alt}`) : null, m(`x = ${values[0]}`), m(`x = ${x + 2}`)],
        (k) => m(`x = ${x + offset(k)}`),
      ),
      diagram: fig.build(relation === 'vertical' ? 'Two intersecting lines; angles 1 and 2 are vertical angles' : relation === 'triangle' ? `Triangle ${names.join('')}` : 'Angles 1 and 2 share a vertex'),
      check: { kind: 'angles', relation, exprs, total: TOTAL[relation] },
    };
  },
});
