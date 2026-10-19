/** Classifying conic sections from a general second-degree equation. */
import { attempt, boolOpt, defineTopic } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, sum, type Term } from '../../../tex';
import type { ProblemContent } from '../../../types';
import { CATEGORY } from './common';

type Kind = 'Circle' | 'Ellipse' | 'Parabola' | 'Hyperbola';
const KINDS: Kind[] = ['Circle', 'Ellipse', 'Parabola', 'Hyperbola'];

interface Q {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

const det3 = (q: Q) =>
  q.A * (q.C * q.F - (q.E * q.E) / 4) - (q.B / 2) * ((q.B / 2) * q.F - (q.E * q.D) / 4) + (q.D / 2) * ((q.B / 2) * (q.E / 2) - (q.C * q.D) / 2);

/** Type of a real, non-degenerate conic (null when degenerate or imaginary). */
function classify(q: Q): Kind | null {
  const det = det3(q);
  if (Math.abs(det) < 1e-9) return null;
  const disc = q.B * q.B - 4 * q.A * q.C;
  if (disc === 0) return 'Parabola';
  if (disc > 0) return 'Hyperbola';
  if ((q.A + q.C) * det >= 0) return null;
  return q.B === 0 && q.A === q.C ? 'Circle' : 'Ellipse';
}

function squareCoefs(rng: Rng, kind: Kind, xy: boolean, max: number): Pick<Q, 'A' | 'B' | 'C'> {
  const s = rng.sign();
  const n = () => rng.int(1, max);
  switch (kind) {
    case 'Circle': {
      const a = s * rng.int(1, 4);
      return { A: a, B: 0, C: a };
    }
    case 'Parabola': {
      if (xy) {
        const p = rng.int(1, 3);
        const r = rng.int(1, 3);
        return { A: s * p * p, B: rng.sign() * 2 * s * p * r, C: s * r * r };
      }
      return rng.bool() ? { A: s * n(), B: 0, C: 0 } : { A: 0, B: 0, C: s * n() };
    }
    case 'Ellipse': {
      const A = s * n();
      const C = s * n();
      if (!xy) return { A, B: 0, C };
      const B = rng.signedInt(1, 2 * max, true);
      return { A, B, C };
    }
    default: {
      const A = s * n();
      const C = -s * n();
      if (!xy) return { A, B: 0, C };
      return { A, B: rng.signedInt(1, 2 * max, true), C: rng.bool(0.3) ? 0 : C };
    }
  }
}

export const classifyConics = defineTopic({
  id: 'alg2.conic.classify',
  subject: 'algebra2',
  title: 'Classifying Conic Sections',
  description: 'Classify a general second-degree equation as a circle, ellipse, parabola or hyperbola.',
  category: CATEGORY,
  instruction: 'Classify each conic section.',
  multipleChoice: true,
  defaultCount: 12,
  options: [{ type: 'boolean', id: 'xy', label: 'Include xy-terms (discriminant test)', default: false }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const allowXY = boolOpt(ctx, 'xy');
    const kind = rng.pick(KINDS);
    const max = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 9 : 16;
    const lin = difficulty === 'easy' ? 10 : 20;
    const q = attempt('classify', () => {
      const xy = allowXY && kind !== 'Circle' && rng.bool(difficulty === 'easy' ? 0.4 : 0.7);
      const sq = squareCoefs(rng, kind, xy, max);
      const q: Q = { ...sq, D: rng.int(-lin, lin), E: rng.int(-lin, lin), F: rng.int(-3 * lin, 3 * lin) };
      if (kind === 'Parabola' && !xy && (sq.C === 0 ? q.E === 0 : q.D === 0)) return null;
      if (kind === 'Ellipse' && !xy && sq.A === sq.C) return null;
      return classify(q) === kind ? q : null;
    });

    // Render: easy keeps the usual order, medium shuffles, hard moves terms across the equal sign.
    const terms: Term[] = [
      { coef: q.A, sym: 'x^{2}' },
      { coef: q.B, sym: 'xy' },
      { coef: q.C, sym: 'y^{2}' },
      { coef: q.D, sym: 'x' },
      { coef: q.E, sym: 'y' },
      { coef: q.F },
    ].filter((t) => t.coef !== 0);
    const steps: string[] = [];
    const generalTex = `${sum(terms)} = 0`;
    let question: string;
    if (difficulty === 'easy') question = generalTex;
    else if (difficulty === 'medium') {
      const sh = rng.shuffle(terms);
      question = `${sum(sh)} = 0`;
      steps.push(`General form: $${generalTex}$`);
    } else {
      const left: Term[] = [];
      const right: Term[] = [];
      for (const t of rng.shuffle(terms)) (rng.bool(0.4) ? right : left).push(t);
      if (!left.length) left.push(right.pop()!);
      if (!right.length) right.push(left.pop()!);
      if (!left.length) left.push({ coef: 0 });
      question = `${sum(left)} = ${sum(right.map((t) => ({ coef: -(t.coef as number), sym: t.sym })))}`;
      steps.push(`Move every term to one side: $${generalTex}$`);
    }
    steps.push(`$A = ${q.A}$, $B = ${q.B}$, $C = ${q.C}$`);
    if (q.B !== 0 || allowXY) {
      const disc = q.B * q.B - 4 * q.A * q.C;
      const rel = disc === 0 ? '= 0' : disc > 0 ? '> 0' : '< 0';
      steps.push(`$B^{2} - 4AC = ${q.B * q.B} - ${4 * q.A * q.C < 0 ? `(${4 * q.A * q.C})` : 4 * q.A * q.C} = ${disc} ${rel}$`);
      if (kind === 'Circle') steps.push('$B = 0$ and $A = C$, so the conic is a circle.');
      else if (kind === 'Ellipse') steps.push('A negative discriminant with $A \\ne C$ or $B \\ne 0$ means an ellipse.');
      else steps.push(`${disc === 0 ? 'A zero discriminant' : 'A positive discriminant'} means a ${kind.toLowerCase()}.`);
    } else if (kind === 'Parabola') steps.push('Only one variable is squared, so the conic is a parabola.');
    else if (kind === 'Circle') steps.push('$A = C$, so the conic is a circle.');
    else if (kind === 'Ellipse') steps.push('$A$ and $C$ have the same sign but are not equal, so the conic is an ellipse.');
    else steps.push('$A$ and $C$ have opposite signs, so the conic is a hyperbola.');

    return {
      question: m(question),
      answer: kind,
      steps,
      distractors: KINDS.filter((k) => k !== kind),
      check: { kind: 'alg2-conics.classify' },
    };
  },
});
