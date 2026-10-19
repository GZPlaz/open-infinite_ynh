/** Circles: center and radius from an equation (and graph), and equations from given features. */
import { plotParam } from '../../../diagram';
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { isPerfectSquare } from '../../../radical';
import type { Rng } from '../../../rng';
import { m, num, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { blankPlane, CATEGORY, fields, fr, generalTex, plane, ptTex, rootTex, sqTex } from './common';

interface Circ {
  h: Frac;
  k: Frac;
  r2: Frac;
}

const standardTex = (c: Circ) => `${sqTex('x', c.h)} + ${sqTex('y', c.k)} = ${num(c.r2)}`;

/** Radius LaTeX: `5`, `\sqrt{7}`, `2\sqrt{3}`, `\frac{\sqrt{65}}{2}`. */
function radiusTex(r2: Frac): string {
  if (r2.isInt()) return rootTex(r2.n);
  // √(n/d) = √(n·d)/d
  const top = rootTex(r2.n * r2.d);
  return isPerfectSquare(r2.n * r2.d) ? num(new Frac(Math.round(Math.sqrt(r2.n * r2.d)), r2.d)) : `\\frac{${top}}{${r2.d}}`;
}

function propsAnswer(c: Circ): string {
  return fields([
    ['Center', m(ptTex(c.h, c.k))],
    ['Radius', m(radiusTex(c.r2))],
  ]);
}

/** Squares with lattice points: r² for r = 1…9 and a few non-squares. */
const SQUARE_R2 = [1, 4, 9, 16, 25, 36, 49, 64, 81];
const OTHER_R2 = [2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 17, 18, 20];

function pickCircle(rng: Rng, d: Difficulty, irrational: boolean): Circ {
  return attempt('circle', () => {
    const span = d === 'easy' ? 4 : 6;
    const atOrigin = d === 'easy' && rng.bool(0.25);
    const h = atOrigin ? 0 : rng.int(-span, span);
    const k = atOrigin ? 0 : rng.int(-span, span);
    const r2 = irrational && rng.bool(0.4) ? rng.pick(OTHER_R2) : rng.pick(SQUARE_R2.slice(0, d === 'easy' ? 6 : 9));
    const r = Math.sqrt(r2);
    if (Math.abs(h) + r > 10 || Math.abs(k) + r > 10) return null;
    return { h: fr(h), k: fr(k), r2: fr(r2) };
  });
}

export const circleGraph = defineTopic({
  id: 'alg2.conic.circle-graph',
  subject: 'algebra2',
  title: 'Graphing Circles',
  description: 'Find the center and radius of a circle from its standard or general equation, and graph it.',
  category: CATEGORY,
  instruction: (o) => (o.graph ? 'Identify the center and radius of each circle. Then sketch the graph.' : 'Identify the center and radius of each circle.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Equation form',
      default: 'auto',
      choices: [
        { value: 'auto', label: 'By difficulty' },
        { value: 'standard', label: 'Standard form' },
        { value: 'general', label: 'General form (complete the square)' },
      ],
    },
    { type: 'boolean', id: 'irrational', label: 'Allow irrational radii', default: false },
    { type: 'boolean', id: 'graph', label: 'Graph the circle', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const formOpt = strOpt(ctx, 'form');
    const general =
      formOpt === 'general' ? true : formOpt === 'standard' ? false : difficulty === 'easy' ? false : difficulty === 'medium' ? rng.bool(0.4) : true;
    const c = pickCircle(rng, difficulty, boolOpt(ctx, 'irrational'));
    const h = c.h.value;
    const k = c.k.value;
    const r2 = c.r2.value;
    const steps: string[] = [];
    let question: string;
    if (!general) {
      question = standardTex(c);
      steps.push(`Compare with $(x - h)^{2} + (y - k)^{2} = r^{2}$: $h = ${h}$, $k = ${k}$, $r^{2} = ${r2}$`);
    } else {
      const mult = difficulty === 'hard' && rng.bool(0.4) ? rng.pick([2, 3, -1]) : 1;
      const F = h * h + k * k - r2;
      const co = { A: mult, C: mult, D: -2 * h * mult, E: -2 * k * mult, F: F * mult };
      const moved = difficulty === 'hard' && rng.bool(0.4) && F !== 0;
      question = moved ? `${generalTex({ ...co, F: 0 })} = ${-co.F}` : `${generalTex(co)} = 0`;
      if (mult !== 1) steps.push(`Divide both sides by $${mult}$: $${generalTex({ A: 1, C: 1, D: -2 * h, E: -2 * k, F })} = 0$`);
      const grp = (v: string, c0: number) => (c0 === 0 ? `${v}^{2}` : `(${sum([{ coef: 1, sym: `${v}^{2}` }, { coef: -2 * c0, sym: v }, { coef: c0 * c0 }])})`);
      steps.push(`Complete the square in $x$ and in $y$: $${grp('x', h)} + ${grp('y', k)} = ${sum([{ coef: -F }, { coef: h * h }, { coef: k * k }])}$`);
      steps.push(`$${standardTex(c)}$`);
    }
    steps.push(`Center $${ptTex(c.h, c.k)}$, radius $r = \\sqrt{${r2}} = ${radiusTex(c.r2)}$`.replace(`\\sqrt{${r2}} = \\sqrt{${r2}}`, `\\sqrt{${r2}}`));

    const answer = propsAnswer(c);
    const distractors = distinctDistractors(
      answer,
      [
        h !== 0 || k !== 0 ? propsAnswer({ ...c, h: c.h.neg(), k: c.k.neg() }) : null,
        r2 !== 1 ? fields([['Center', m(ptTex(c.h, c.k))], ['Radius', m(String(r2))]]) : null,
        h !== k ? propsAnswer({ ...c, h: c.k, k: c.h }) : null,
        general ? propsAnswer({ ...c, r2: fr(r2 - 2 * (h * h + k * k) > 0 ? r2 - 2 * (h * h + k * k) : r2 + h * h + k * k) }) : null,
      ],
      (n) => (r2 + offset(n) > 0 ? propsAnswer({ ...c, r2: fr(r2 + offset(n)) }) : null),
    );

    let diagram;
    let answerDiagram;
    if (boolOpt(ctx, 'graph')) {
      diagram = blankPlane();
      const { b, w } = plane();
      const r = Math.sqrt(r2);
      plotParam(b, (t) => h + r * Math.cos(t), (t) => k + r * Math.sin(t), 0, 2 * Math.PI, w, {}, 240);
      b.dot([h, k]);
      answerDiagram = b.build(`Circle with center (${h}, ${k}) and radius √${r2}`);
    }
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      diagram,
      answerDiagram,
      check: { kind: 'alg2-conics.props', conic: 'circle' },
    };
  },
});

// ---------------------------------------------------------------- writing equations

type Given = 'center-radius' | 'center-point' | 'diameter' | 'tangent';

export const circleWrite = defineTopic({
  id: 'alg2.conic.circle-write',
  subject: 'algebra2',
  title: 'Writing Equations of Circles',
  description: 'Write the standard-form equation of a circle from its center and radius, a point, a diameter or a tangent line.',
  category: CATEGORY,
  instruction: 'Use the information provided to write the standard form equation of each circle.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'given',
      label: 'Given information',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'center-radius', label: 'Center and radius' },
        { value: 'center-point', label: 'Center and a point' },
        { value: 'diameter', label: 'Endpoints of a diameter' },
        { value: 'tangent', label: 'Center and a tangent line' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const g = strOpt(ctx, 'given');
    const pool: Given[] = difficulty === 'easy' ? ['center-radius', 'center-point', 'diameter'] : ['center-radius', 'center-point', 'diameter', 'tangent'];
    const given: Given = g === 'mixed' || !g ? rng.pick(pool) : (g as Given);
    const span = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 12;
    const steps: string[] = [];
    let question: string;
    let c: Circ;
    const rnd = () => fr(rng.int(-span, span));

    if (given === 'center-radius') {
      const h = difficulty === 'easy' && rng.bool(0.3) ? fr(0) : rnd();
      const k = rnd();
      const irr = difficulty === 'hard' && rng.bool(0.6);
      const r2 = irr ? rng.pick(OTHER_R2) : rng.int(1, difficulty === 'easy' ? 9 : 15) ** 2;
      c = { h, k, r2: fr(r2) };
      question = fields([
        ['Center', m(ptTex(h, k))],
        ['Radius', m(radiusTex(c.r2))],
      ]);
      steps.push(`$r^{2} = ${irr ? `\\left(${radiusTex(c.r2)}\\right)^{2}` : `${Math.sqrt(r2)}^{2}`} = ${r2}$`);
    } else if (given === 'center-point') {
      c = attempt('circle-point', () => {
        const h = rnd();
        const k = rnd();
        const dx = rng.int(-6, 6);
        const dy = rng.int(-6, 6);
        if (dx === 0 && dy === 0) return null;
        return { h, k, r2: fr(dx * dx + dy * dy), dx, dy };
      }) as Circ & { dx: number; dy: number };
      const { dx, dy } = c as Circ & { dx: number; dy: number };
      const P = [c.h.add(dx), c.k.add(dy)] as const;
      question = fields([
        ['Center', m(ptTex(c.h, c.k))],
        ['Passes through', m(ptTex(P[0], P[1]))],
      ]);
      steps.push(`$r^{2} = (${num(P[0])} - ${num(c.h)})^{2} + (${num(P[1])} - ${num(c.k)})^{2} = ${dx * dx} + ${dy * dy} = ${dx * dx + dy * dy}$`.replace(/- -/g, '+ '));
    } else if (given === 'diameter') {
      const r = attempt('circle-diameter', () => {
        const x1 = rnd();
        const y1 = rnd();
        let dx = rng.int(-10, 10);
        let dy = rng.int(-10, 10);
        if (difficulty !== 'hard') {
          dx -= dx % 2;
          dy -= dy % 2;
        } else if (dx % 2 === 0 && dy % 2 === 0 && rng.bool(0.7)) return null;
        if (dx === 0 && dy === 0) return null;
        return { x1, y1, x2: x1.add(dx), y2: y1.add(dy), dx, dy };
      });
      const h = r.x1.add(r.x2).div(2);
      const k = r.y1.add(r.y2).div(2);
      c = { h, k, r2: new Frac(r.dx * r.dx + r.dy * r.dy, 4) };
      question = fields([['Diameter endpoints', `${m(ptTex(r.x1, r.y1))} and ${m(ptTex(r.x2, r.y2))}`]]);
      steps.push(`The center is the midpoint: $${ptTex(h, k)}$`);
      steps.push(`$r^{2} = \\left(\\frac{d}{2}\\right)^{2} = \\frac{${r.dx * r.dx} + ${r.dy * r.dy}}{4} = ${num(c.r2)}$`);
    } else {
      const h = rnd();
      const k = rnd();
      const vertical = rng.bool();
      const at = (vertical ? h : k).add(rng.signedInt(1, 9, true));
      const r = Math.abs(at.sub(vertical ? h : k).value);
      c = { h, k, r2: fr(r * r) };
      const line = `${vertical ? 'x' : 'y'} = ${num(at)}`;
      question = fields([
        ['Center', m(ptTex(h, k))],
        ['Tangent to', m(line)],
      ]);
      steps.push(`The radius is the distance from the center to the line $${line}$: $r = ${r}$, so $r^{2} = ${r * r}$`);
    }
    const answer = m(standardTex(c));
    steps.push(answer);

    const r2 = c.r2;
    const rTex = radiusTex(r2);
    const notSquared = m(`${sqTex('x', c.h)} + ${sqTex('y', c.k)} = ${rTex}`);
    const distractors = distinctDistractors(
      answer,
      [
        rTex !== num(r2) ? notSquared : null,
        !c.h.isZero() || !c.k.isZero() ? m(standardTex({ ...c, h: c.h.neg(), k: c.k.neg() })) : null,
        m(standardTex({ ...c, r2: r2.mul(4) })),
        !c.h.isZero() ? m(standardTex({ ...c, h: c.h.neg() })) : null,
      ],
      (n) => (r2.value + offset(n) > 0 ? m(standardTex({ ...c, r2: r2.add(offset(n)) })) : null),
    );
    return {
      question,
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-conics.write', conic: 'circle' },
    };
  },
});
