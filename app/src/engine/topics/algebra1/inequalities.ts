/** Multi-step and compound linear inequalities, with number-line graphs. */
import { numberLine, type Diagram } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, num, scaled, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Rel = '<' | '>' | '\\le' | '\\ge';
const FLIP: Record<Rel, Rel> = { '<': '>', '>': '<', '\\le': '\\ge', '\\ge': '\\le' };
const STRICT_SWAP: Record<Rel, Rel> = { '<': '\\le', '\\le': '<', '>': '\\ge', '\\ge': '>' };
const isStrict = (r: Rel) => r === '<' || r === '>';

type Form = 'ax+b|c' | 'b-ax|c' | 'm(px+q)|c' | 'ax+b|cx+d' | 'm(px+q)|cx+d' | 'compound';

const FORMS: Record<Difficulty, Form[]> = {
  easy: ['ax+b|c', 'b-ax|c'],
  medium: ['m(px+q)|c', 'ax+b|cx+d', 'b-ax|c'],
  hard: ['m(px+q)|cx+d', 'compound', 'ax+b|cx+d'],
};

interface Simple {
  kind: 'simple';
  leftTex: string;
  rightTex: string;
  expanded?: [string, string];
  L: { a: number; b: number };
  R: { a: number; b: number };
  rel: Rel;
}

interface Compound {
  kind: 'compound';
  lo: number;
  hi: number;
  a: number;
  b: number;
  rel1: Rel;
  rel2: Rel;
}

/** Number line around the solution, with the solution set drawn in the answer key. */
function graphs(points: number[], shade: (lo: number, hi: number) => Array<[number, number]>, dots: Array<[number, boolean]>): { blank: Diagram; solved: Diagram } {
  const center = Math.round(points.reduce((s, p) => s + p, 0) / points.length);
  let lo = Math.min(center - 5, Math.floor(Math.min(...points)) - 2);
  let hi = Math.max(center + 5, Math.ceil(Math.max(...points)) + 2);
  if (hi - lo > 14) {
    lo = Math.floor(Math.min(...points)) - 2;
    hi = Math.ceil(Math.max(...points)) + 2;
  }
  const blank = numberLine(lo, hi).build('Blank number line');
  const b = numberLine(lo, hi);
  for (const [s, e] of shade(lo - 0.7, hi + 0.7)) {
    const reachesEnd = e >= hi + 0.7 || s <= lo - 0.7;
    if (reachesEnd) {
      const from: [number, number] = e >= hi + 0.7 ? [s, 0] : [e, 0];
      const to: [number, number] = e >= hi + 0.7 ? [hi + 0.7, 0] : [lo - 0.7, 0];
      b.arrow(from, to, { ink: 'accent', weight: 3 });
    } else b.segment([s, 0], [e, 0], { ink: 'accent', weight: 3 });
  }
  dots.forEach(([p, open]) => b.dot([p, 0], open, 'accent'));
  return { blank, solved: b.build('Number line with the solution graphed') };
}

function build(rng: Rng, form: Form, negatives: boolean, fractions: boolean): Simple | Compound {
  return attempt<Simple | Compound>('inequality', () => {
    const rel = rng.pick<Rel>(['<', '>', '\\le', '\\ge']);
    const coef = (max = 9) => rng.signedInt(1, max, negatives);
    const pickX = (A: number): Frac | null => {
      if (fractions) {
        const d = [2, 3, 4, 5].filter((k) => A % k === 0);
        if (!d.length) return null;
        const den = rng.pick(d);
        const x = new Frac(rng.signedInt(1, 9 * den, negatives), den);
        return x.isInt() || Math.abs(x.value) > 9 ? null : x;
      }
      return new Frac(rng.signedInt(1, 9, negatives));
    };
    if (form === 'compound') {
      const a = rng.signedInt(2, 6, negatives);
      const b = rng.signedInt(1, 12, negatives);
      const lo = rng.signedInt(1, 8, negatives);
      const width = rng.int(2, 7);
      const hi = lo + width;
      const rel1 = rng.pick<Rel>(['<', '\\le']);
      const rel2 = rng.pick<Rel>(['<', '\\le']);
      // c1 rel1 ax + b rel2 c2 with solution between lo and hi
      return { kind: 'compound', lo, hi, a, b, rel1, rel2 };
    }
    let L: { a: number; b: number };
    let R: { a: number; b: number };
    let leftTex: string;
    let rightTex: (c: number) => string;
    let expanded: ((c: number) => [string, string]) | undefined;
    let mult: number;
    switch (form) {
      case 'ax+b|c': {
        const a = rng.signedInt(2, 9, negatives);
        const b = coef(15);
        L = { a, b };
        R = { a: 0, b: 0 };
        leftTex = linear(a, b);
        rightTex = (c) => num(c);
        break;
      }
      case 'b-ax|c': {
        const a = rng.int(2, 9);
        const b = rng.int(1, 15);
        L = { a: -a, b };
        R = { a: 0, b: 0 };
        leftTex = sum([{ coef: b }, { coef: -a, sym: 'x' }]);
        rightTex = (c) => num(c);
        break;
      }
      case 'm(px+q)|c': {
        mult = rng.signedInt(2, 6, negatives);
        const p = rng.signedInt(1, 5, negatives);
        const q = coef(9);
        L = { a: mult * p, b: mult * q };
        R = { a: 0, b: 0 };
        leftTex = scaled(mult, linear(p, q));
        rightTex = (c) => num(c);
        expanded = (c) => [linear(mult * p, mult * q), num(c)];
        break;
      }
      case 'ax+b|cx+d': {
        const a = coef();
        const b = coef(15);
        const c2 = coef();
        L = { a, b };
        R = { a: c2, b: 0 };
        leftTex = linear(a, b);
        rightTex = (d) => linear(c2, d);
        break;
      }
      case 'm(px+q)|cx+d': {
        mult = rng.signedInt(2, 6, negatives);
        const p = rng.signedInt(1, 5, negatives);
        const q = coef(9);
        const c2 = coef();
        L = { a: mult * p, b: mult * q };
        R = { a: c2, b: 0 };
        leftTex = scaled(mult, linear(p, q));
        rightTex = (d) => linear(c2, d);
        expanded = (d) => [linear(mult * p, mult * q), linear(c2, d)];
        break;
      }
    }
    const A = L.a - R.a;
    if (A === 0) return null;
    const x0 = pickX(A);
    if (!x0) return null;
    // Free constant on the right: L(x0) = R.a·x0 + d  ⇒  d = L(x0) − R.a·x0
    const d = x0.mul(L.a).add(L.b).sub(x0.mul(R.a));
    if (!d.isInt() || d.isZero() || Math.abs(d.value) > 80 || (!negatives && d.sign < 0)) return null;
    R = { a: R.a, b: d.value };
    return {
      kind: 'simple',
      leftTex,
      rightTex: rightTex(d.value),
      expanded: expanded?.(d.value),
      L,
      R,
      rel,
    };
  });
}

function relTex(v: string, rel: Rel, x: Frac): string {
  return `${v} ${rel} ${num(x)}`;
}

export const inequalities = defineTopic({
  id: 'alg1.inequalities',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Multi-Step Inequalities',
  description: 'Solve linear and compound inequalities; optionally graph the solution set.',
  instruction: (o) => (o.graph ? 'Solve each inequality and graph its solution.' : 'Solve each inequality.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    opt.negatives(true),
    opt.fractionAnswers(false),
    opt.variedVariables(false),
    { type: 'boolean', id: 'graph', label: 'Graph on a number line', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const graph = boolOpt(ctx, 'graph');
    const form = rng.pick(FORMS[difficulty]);
    const p = build(rng, form, negatives, boolOpt(ctx, 'fractions'));
    const sub = (t: string) => t.replace(/x/g, v);
    const steps: string[] = [];

    if (p.kind === 'compound') {
      const { a, b, rel1, rel2 } = p;
      // values of ax + b at the solution bounds
      const atLo = a * p.lo + b;
      const atHi = a * p.hi + b;
      const [c1, c2, rA, rB] = a > 0 ? [atLo, atHi, rel1, rel2] : [atHi, atLo, rel2, rel1];
      const question = `${c1} ${rA} ${sub(linear(a, b))} ${rB} ${c2}`;
      steps.push(`${b > 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ in all three parts: $${c1 - b} ${rA} ${sub(sum([{ coef: a, sym: 'x' }]))} ${rB} ${c2 - b}$`);
      if (a !== 1) {
        if (a > 0) steps.push(`Divide by $${a}$: $${p.lo} ${rel1} ${v} ${rel2} ${p.hi}$`);
        else {
          steps.push(`Divide by $${a}$ and reverse the signs: $${p.hi} ${FLIP[rel2]} ${v} ${FLIP[rel1]} ${p.lo}$`);
          steps.push(`Rewrite in increasing order: $${p.lo} ${rel1} ${v} ${rel2} ${p.hi}$`);
        }
      }
      const answerTex = (lo: number, r1: Rel, r2: Rel, hi: number) => m(`${lo} ${r1} ${v} ${r2} ${hi}`);
      const answer = answerTex(p.lo, rel1, rel2, p.hi);
      const g = graphs([p.lo, p.hi], () => [[p.lo, p.hi]], [
        [p.lo, isStrict(rel1)],
        [p.hi, isStrict(rel2)],
      ]);
      const distractors = distinctDistractors(
        answer,
        [answerTex(p.lo, STRICT_SWAP[rel1], STRICT_SWAP[rel2], p.hi), answerTex(-p.hi, rel2, rel1, -p.lo), answerTex(p.lo - 1, rel1, rel2, p.hi + 1)],
        (k) => answerTex(p.lo + k, rel1, rel2, p.hi + k),
      );
      return {
        question: m(question),
        answer,
        steps,
        distractors,
        diagram: graph ? g.blank : undefined,
        answerDiagram: graph ? g.solved : undefined,
        check: { kind: 'inequality', variable: v },
      };
    }

    const { L, R, rel } = p;
    if (p.expanded) steps.push(`Distribute: $${sub(p.expanded[0])} ${rel} ${sub(p.expanded[1])}$`);
    const A = L.a - R.a;
    if (R.a !== 0) {
      steps.push(
        `${R.a > 0 ? 'Subtract' : 'Add'} $${sub(sum([{ coef: Math.abs(R.a), sym: 'x' }]))}$ ${R.a > 0 ? 'from' : 'to'} both sides: $${sub(linear(A, L.b))} ${rel} ${R.b}$`,
      );
    }
    const rhs = R.b - L.b;
    if (L.b !== 0) {
      steps.push(`${L.b > 0 ? 'Subtract' : 'Add'} $${Math.abs(L.b)}$ ${L.b > 0 ? 'from' : 'to'} both sides: $${sub(sum([{ coef: A, sym: 'x' }]))} ${rel} ${rhs}$`);
    }
    const x0 = new Frac(rhs, A);
    const finalRel = A > 0 ? rel : FLIP[rel];
    if (A !== 1) {
      steps.push(
        A > 0
          ? `Divide both sides by $${A}$: $${relTex(v, finalRel, x0)}$`
          : `Divide both sides by $${A}$ and reverse the inequality sign: $${relTex(v, finalRel, x0)}$`,
      );
    }
    const answer = m(relTex(v, finalRel, x0));
    const toRight = finalRel === '>' || finalRel === '\\ge';
    const g = graphs([x0.value], (lo, hi) => [toRight ? [x0.value, hi] : [lo, x0.value]], [[x0.value, isStrict(finalRel)]]);
    const distractors = distinctDistractors(
      answer,
      [m(relTex(v, FLIP[finalRel], x0)), m(relTex(v, finalRel, x0.neg())), m(relTex(v, STRICT_SWAP[finalRel], x0))],
      (k) => m(relTex(v, finalRel, x0.add(k))),
    );
    return {
      question: m(`${sub(p.leftTex)} ${rel} ${sub(p.rightTex)}`),
      answer,
      steps,
      distractors,
      diagram: graph ? g.blank : undefined,
      answerDiagram: graph ? g.solved : undefined,
      check: { kind: 'inequality', variable: v },
    };
  },
});
