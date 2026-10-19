/** Rationalizing denominators: radical denominators (monomial and binomial) and complex denominators. */
import { gcdAll } from '../../../fraction';
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { cdiv, cFracTex, cmul, conj, cTex, cx, norm2, randCx, type Cx } from './common';

/** (P + Q√c) / D with integers, c square-free > 1. */
interface Surd {
  P: number;
  Q: number;
  D: number;
  c: number;
}

function reduceSurd(s: Surd): Surd {
  const g = gcdAll([s.P, s.Q, s.D]) || 1;
  const sg = s.D < 0 ? -1 : 1;
  return { P: (sg * s.P) / g + 0, Q: (sg * s.Q) / g + 0, D: (sg * s.D) / g, c: s.c };
}

const rad = (c: number) => `\\sqrt{${c}}`;

function surdTex(s0: Surd): string {
  const s = reduceSurd(s0);
  const neg = s.D !== 1 && s.P <= 0 && s.Q <= 0;
  const top = sum([{ coef: neg ? -s.P : s.P }, { coef: neg ? -s.Q : s.Q, sym: rad(s.c) }]);
  return s.D === 1 ? top : `${neg ? '-' : ''}\\frac{${top}}{${s.D}}`;
}

/** `a + b√c` (or `b√c + a`) for a denominator or numerator. */
function binomTex(a: number, b: number, c: number, radicalFirst: boolean): string {
  return radicalFirst ? sum([{ coef: b, sym: rad(c) }, { coef: a }]) : sum([{ coef: a }, { coef: b, sym: rad(c) }]);
}

const SQUAREFREE = [2, 3, 5, 6, 7, 10, 11, 13, 14, 15];

type Kind = 'radical' | 'complex';

function radicalProblem(rng: Rng, d: Difficulty) {
  if (d === 'easy') {
    // k / √n  or  k / (m√c)
    const c = rng.pick(SQUAREFREE.slice(0, 7));
    const s = rng.pick([1, 1, 2, 3]);
    const k = rng.signedInt(1, 12, true);
    const n = s * s * c;
    const question = `\\frac{${k}}{\\sqrt{${n}}}`;
    const answer: Surd = { P: 0, Q: k, D: s * c, c };
    const steps = [
      s > 1 ? `Simplify: $\\sqrt{${n}} = ${s}\\sqrt{${c}}$` : `Multiply the numerator and denominator by $\\sqrt{${c}}$.`,
      s > 1 ? `Multiply the numerator and denominator by $\\sqrt{${c}}$: $\\frac{${sum([{ coef: k, sym: rad(c) }])}}{${s * c}}$` : `$\\frac{${sum([{ coef: k, sym: rad(c) }])}}{${c}}$`,
    ];
    const wrongs: Surd[] = [
      { P: 0, Q: k, D: n, c },
      { P: 0, Q: k, D: s, c },
      { P: 0, Q: k * c, D: s, c },
    ];
    return { question, answer, steps, wrongs };
  }
  const c = rng.pick(SQUAREFREE);
  return attempt('binomial denominator', () => {
    const a = rng.signedInt(1, d === 'medium' ? 6 : 9, true);
    const b = rng.signedInt(1, d === 'medium' ? 2 : 4, true);
    const p = d === 'medium' ? rng.signedInt(1, 12, true) : rng.signedInt(1, 9, true);
    const q = d === 'medium' ? 0 : rng.signedInt(1, 5, true);
    const D = a * a - b * b * c;
    if (D === 0 || Math.abs(D) > 60) return null;
    const answer: Surd = { P: p * a - q * b * c, Q: q * a - p * b, D, c };
    if (answer.P === 0 || answer.Q === 0) return null;
    const radFirst = rng.bool(0.3);
    const numTex = q === 0 ? String(p) : binomTex(p, q, c, false);
    const question = `\\frac{${numTex}}{${binomTex(a, b, c, radFirst)}}`;
    const conjTex = binomTex(a, -b, c, radFirst);
    const steps = [
      `Multiply the numerator and denominator by the conjugate $${conjTex}$.`,
      `Denominator: $${a * a} - ${b * b * c} = ${D}$`,
      `Numerator: $${sum([{ coef: answer.P }, { coef: answer.Q, sym: rad(c) }])}$`,
    ];
    const wrongs: Surd[] = [
      { ...answer, D: a * a + b * b * c },
      { P: p * a + q * b * c, Q: q * a + p * b, D, c },
      { P: answer.P, Q: -answer.Q, D, c },
      { P: p, Q: q, D, c },
    ];
    return { question, answer, steps, wrongs };
  });
}

function complexProblem(rng: Rng, d: Difficulty) {
  return attempt('complex denominator', () => {
    let top: Cx;
    let den: Cx;
    if (d === 'easy') {
      den = cx(0, rng.signedInt(1, 6, true));
      top = rng.bool(0.5) ? cx(rng.signedInt(1, 12, true)) : randCx(rng, 9);
    } else if (d === 'medium') {
      den = randCx(rng, 5);
      top = cx(rng.signedInt(1, 15, true));
    } else {
      den = randCx(rng, 6);
      top = randCx(rng, 9);
    }
    const q = cdiv(top, den);
    if (q.re.isZero() && q.im.isZero()) return null;
    if (d !== 'easy' && q.re.isInt() && q.im.isInt() && rng.bool(0.6)) return null;
    const question = `\\frac{${cTex(top)}}{${cTex(den)}}`;
    const mult = den.re.isZero() ? cx(0, 1) : conj(den);
    const steps = [
      den.re.isZero() ? 'Multiply the numerator and denominator by $i$ (use $i^{2} = -1$).' : `Multiply the numerator and denominator by the conjugate $${cTex(mult)}$.`,
      `$\\frac{${cTex(cmul(top, mult))}}{${cTex(cmul(den, mult))}} = ${cFracTex(q)}$`,
    ];
    const n2 = norm2(den);
    const top2 = cmul(top, conj(den));
    const d2 = den.re.mul(den.re).sub(den.im.mul(den.im));
    const wrong1 = den.re.isZero() || d2.isZero() ? { re: q.re.neg(), im: q.im.neg() } : { re: top2.re.div(d2), im: top2.im.div(d2) };
    const wrongs: Cx[] = [wrong1, conj(q), { re: top2.re, im: top2.im.div(n2) }, cmul(top, den)];
    return { question, answer: q, steps, wrongs };
  });
}

export const rationalizingDenominators = defineTopic({
  id: 'alg2.complex.rationalizing',
  subject: 'algebra2',
  title: 'Rationalizing Denominators',
  description: 'Rewrite quotients with radical or complex denominators so the denominator is rational (real).',
  category: 'Complex Numbers',
  instruction: 'Simplify. Rationalize each denominator.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Denominators',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'radical', label: 'Radicals (e.g. 3/(2 − √5))' },
        { value: 'complex', label: 'Complex numbers (e.g. 5/(2 − i))' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'type');
    const kind: Kind = chosen === 'any' ? rng.pick<Kind>(['radical', 'complex']) : (chosen as Kind);
    let question: string;
    let answer: string;
    let steps: string[];
    let cands: string[];
    let fallback: (k: number) => string;
    if (kind === 'radical') {
      const r = radicalProblem(rng, difficulty);
      question = r.question;
      answer = m(surdTex(r.answer));
      steps = r.steps;
      if (!steps[steps.length - 1]!.endsWith(`$${surdTex(r.answer)}$`)) steps.push(`Simplify: $${surdTex(r.answer)}$`);
      cands = r.wrongs.filter((w) => w.D !== 0).map((w) => m(surdTex(w)));
      fallback = (k) => m(surdTex({ ...r.answer, P: r.answer.P + k * reduceSurd(r.answer).D }));
    } else {
      const r = complexProblem(rng, difficulty);
      question = r.question;
      answer = m(cFracTex(r.answer));
      steps = r.steps;
      cands = r.wrongs.map((w) => m(cFracTex(w)));
      fallback = (k) => m(cFracTex({ re: r.answer.re.add(k), im: r.answer.im }));
    }
    return {
      question: m(question),
      answer,
      steps,
      distractors: distinctDistractors(answer, cands, fallback),
      check: { kind: `${KIND}.rationalize` },
    };
  },
});

