/** The Pythagorean theorem: find the missing side, with a figure or as a word problem. */
import { DiagramBuilder, rotate, type Pt } from '../../diagram';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, strOpt } from '../../generator';
import { isPerfectSquare, sqrtTex } from '../../radical';
import type { Rng } from '../../rng';
import { m, withUnit } from '../../tex';
import type { ProblemContent } from '../../types';
import { equalsTex, formatMeasure, pickUnit, triples } from './common';

/** Right triangle with legs a, b drawn to scale in a random orientation. */
export function rightTriangleFigure(
  rng: Rng,
  a: number,
  b: number,
  labels: { a: string; b: string; c: string },
  alt: string,
  vertexNames?: [string, string, string],
): ReturnType<DiagramBuilder['build']> {
  const c = Math.hypot(a, b);
  const scale = 125 / Math.max(a, b, c * 0.85);
  const fig = new DiagramBuilder(scale);
  const turn = rng.pick([0, 90, 180, 270]) + rng.int(-20, 20);
  const flip = rng.bool();
  const place = (p: Pt): Pt => rotate(flip ? [-p[0], p[1]] : p, turn);
  // right angle at R, leg a along R→A, leg b along R→B
  const R = place([0, 0]);
  const A = place([a, 0]);
  const B = place([0, b]);
  const inside: Pt = [(R[0] + A[0] + B[0]) / 3, (R[1] + A[1] + B[1]) / 3];
  fig.polygon([R, A, B], { weight: 1.4 });
  fig.rightAngle(R, A, B, 10);
  fig.sideLabel(R, A, labels.a, inside);
  fig.sideLabel(R, B, labels.b, inside);
  fig.sideLabel(A, B, labels.c, inside);
  if (vertexNames) {
    const away = (p: Pt) => {
      const d: Pt = [p[0] - inside[0], p[1] - inside[1]];
      const l = Math.hypot(d[0], d[1]) || 1;
      return [p[0] + (d[0] / l) * fig.px(9), p[1] + (d[1] / l) * fig.px(9)] as Pt;
    };
    fig.label(away(R), vertexNames[0], 'c');
    fig.label(away(A), vertexNames[1], 'c');
    fig.label(away(B), vertexNames[2], 'c');
  }
  return fig.build(alt);
}

interface Word {
  text: (a: number, b: number, c: number) => string;
  unknown: 'leg' | 'hyp';
  unit: string;
}

const WORDS: Word[] = [
  {
    text: (a, _b, c) => `A ${c} ft ladder leans against a wall with its foot ${a} ft from the wall. How high up the wall does it reach?`,
    unknown: 'leg',
    unit: 'ft',
  },
  {
    text: (a, b) => `A rectangle is ${a} cm wide and ${b} cm long. How long is its diagonal?`,
    unknown: 'hyp',
    unit: 'cm',
  },
  {
    text: (a, b) => `Maya walks ${a} km north and then ${b} km east. How far is she from her starting point?`,
    unknown: 'hyp',
    unit: 'km',
  },
  {
    text: (a, _b, c) => `A ${c} m wire runs from the top of a pole to a stake ${a} m from the base of the pole. How tall is the pole?`,
    unknown: 'leg',
    unit: 'm',
  },
  {
    text: (a, b) => `A TV screen is ${b} in wide and ${a} in tall. What is the length of its diagonal?`,
    unknown: 'hyp',
    unit: 'in',
  },
];

export const pythagoreanTheorem = defineTopic({
  id: 'geo.pythagorean',
  subject: 'geometry',
  title: 'The Pythagorean Theorem',
  description: 'Find a missing side of a right triangle.',
  instruction: (o) =>
    o.answerForm === 'exact'
      ? 'Find the missing side of each triangle. Leave your answers in simplest radical form.'
      : 'Find the missing side of each triangle. Round your answers to the nearest tenth if necessary.',
  multipleChoice: true,
  defaultCount: 9,
  options: [opt.rounding('round'), opt.units(true), { type: 'boolean', id: 'words', label: 'Word problems (hard)', default: false }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const form = strOpt(ctx, 'answerForm');
    const word = difficulty === 'hard' && boolOpt(ctx, 'words') && rng.bool(0.6) ? rng.pick(WORDS) : null;
    const findHyp = word ? word.unknown === 'hyp' : difficulty === 'easy' ? rng.bool(0.7) : rng.bool(0.5);
    const unit = word ? word.unit : pickUnit(rng, boolOpt(ctx, 'units'));

    // legs a, b and hypotenuse² c2
    const { a, b, c2 } = attempt('pythagorean', () => {
      if (difficulty === 'easy' || word) {
        const [p, q] = rng.pick(triples(40));
        const [a, b] = rng.bool() ? [p, q] : [q, p];
        return { a, b, c2: a * a + b * b };
      }
      if (findHyp) {
        const a = rng.int(2, difficulty === 'hard' ? 24 : 15);
        const b = rng.int(2, difficulty === 'hard' ? 24 : 15);
        if (a / b > 3 || b / a > 3 || isPerfectSquare(a * a + b * b)) return null;
        return { a, b, c2: a * a + b * b };
      }
      const cc = rng.int(5, difficulty === 'hard' ? 30 : 18);
      const a = rng.int(2, cc - 1);
      const b2 = cc * cc - a * a;
      if (isPerfectSquare(b2) || a / Math.sqrt(b2) > 3 || Math.sqrt(b2) / a > 3) return null;
      return { a, b: Math.sqrt(b2), c2: cc * cc };
    });
    const c = Math.sqrt(c2);
    const unknownValue = findHyp ? c : b;
    const unknownSq = findHyp ? c2 : Math.round(b * b);
    const exactTex = sqrtTex(unknownSq);
    const result = formatMeasure(unknownValue, form, unit, 1, exactTex);
    const answer = m(equalsTex('x', result));

    const shown = (v: number) => withUnit(String(Math.round(v)), unit);
    const steps: string[] = [];
    if (findHyp) {
      steps.push(m(`x^{2} = ${a}^{2} + ${Math.round(b)}^{2}`));
      steps.push(m(`x^{2} = ${a * a} + ${Math.round(b * b)} = ${c2}`));
    } else {
      steps.push(m(`x^{2} + ${a}^{2} = ${Math.round(c)}^{2}`));
      steps.push(m(`x^{2} = ${c2} - ${a * a} = ${unknownSq}`));
    }
    steps.push(m(`x = \\sqrt{${unknownSq}}${isPerfectSquare(unknownSq) ? ` = ${Math.round(unknownValue)}` : exactTex !== `\\sqrt{${unknownSq}}` ? ` = ${exactTex}` : ''}${result.approx ? ` \\approx ${result.tex}` : ''}`));

    const fmt = (v: number, sq: number) => m(equalsTex('x', formatMeasure(v, form, unit, 1, sqrtTex(sq))));
    const distractors = distinctDistractors(
      answer,
      [
        findHyp ? fmt(a + b, (a + b) ** 2) : fmt(Math.sqrt(c2 + a * a), c2 + a * a),
        findHyp ? fmt(Math.sqrt(Math.abs(b * b - a * a)) || a / 2, Math.abs(Math.round(b * b) - a * a) || 1) : fmt(c - a, (c - a) ** 2),
        fmt(unknownValue * 2, unknownSq * 4),
      ],
      (k) => fmt(Math.sqrt(unknownSq + k * 7), unknownSq + k * 7),
    );

    const check = { kind: 'measure', expected: unknownValue, form, findHyp, legs: [a, b], hyp: c };
    if (word) {
      const B = Math.round(b);
      return {
        question: word.text(a, B, Math.round(c)),
        answer,
        steps,
        distractors,
        check,
      };
    }
    const diagram = rightTriangleFigure(
      rng,
      a,
      b,
      {
        a: shown(a),
        b: findHyp ? shown(b) : 'x',
        c: findHyp ? 'x' : shown(c),
      },
      findHyp ? `Right triangle with legs ${a} and ${Math.round(b)}; hypotenuse x` : `Right triangle with leg ${a}, hypotenuse ${Math.round(c)}; other leg x`,
    );
    return {
      question: 'Find $x$.',
      answer,
      steps,
      distractors,
      diagram,
      check,
    };
  },
});
