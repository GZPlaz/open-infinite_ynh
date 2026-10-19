/** One-step and multi-step equations, one- and two-step inequalities (with number-line graphs). */
import { numberLine, type Diagram } from '../../diagram';
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar, strOpt } from '../../generator';
import { m, num, sum, type Term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT, Dec } from './common';

const addOrSub = (b: Frac | number) => (Frac.of(b).sign > 0 ? 'Subtract' : 'Add');
const absTex = (b: Frac | number) => num(Frac.of(b).abs());

// ---------------------------------------------------------------- one-step equations

type OneForm = 'x+a' | 'x-a' | 'a+x' | 'ax' | 'x/a' | 'frac';

export const oneStepEquations = defineTopic({
  id: 'prealg.one-step',
  subject: 'prealgebra',
  category: CAT.equations,
  title: 'One-Step Equations',
  description: 'Solve equations with one addition, subtraction, multiplication or division step.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'ops',
      label: 'Operations',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'All four' },
        { value: 'addsub', label: 'Addition and subtraction' },
        { value: 'muldiv', label: 'Multiplication and division' },
      ],
    },
    opt.negatives(true),
    { type: 'boolean', id: 'decimals', label: 'Decimals', default: false },
    opt.fractionAnswers(false),
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const decimals = boolOpt(ctx, 'decimals');
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const ops = strOpt(ctx, 'ops');
    const addsub: OneForm[] = ['x+a', 'x-a', 'a+x'];
    const muldiv: OneForm[] = difficulty === 'hard' && !decimals ? ['ax', 'x/a', 'frac'] : ['ax', 'x/a'];
    const forms = ops === 'addsub' ? addsub : ops === 'muldiv' ? muldiv : [...addsub, ...muldiv];
    const max = difficulty === 'easy' ? 12 : difficulty === 'medium' ? 25 : 60;
    const p = attempt('one-step', () => {
      const form = rng.pick(forms);
      // decimals as exact Dec, integers otherwise
      const dec = (lo: number, hi: number, places: number) => {
        const d = new Dec(rng.int(lo, hi * 10 ** places), places);
        return negatives && rng.bool(0.4) ? d.neg() : d;
      };
      const intv = (lo: number, hi: number) => rng.signedInt(lo, hi, negatives);
      const places = difficulty === 'hard' ? 2 : 1;
      let lhs: string;
      let x: Frac;
      let rhs: Frac;
      let step: string;
      let wrong: Frac;
      if (form === 'x+a' || form === 'x-a' || form === 'a+x') {
        const aa = decimals ? decFrac(dec(1, max, places)) : new Frac(intv(1, max));
        x = decimals ? decFrac(dec(1, max, places)) : new Frac(intv(1, max));
        const at = fracOrDec(aa, decimals);
        const absA = fracOrDec(aa.abs(), decimals);
        if (form === 'x-a') {
          rhs = x.sub(aa);
          lhs = aa.sign < 0 ? `${v} - (${at})` : `${v} - ${at}`;
          step = `Add $${fracOrDec(aa, decimals, true)}$ to both sides.`;
          wrong = rhs.sub(aa);
        } else {
          rhs = x.add(aa);
          lhs = form === 'x+a' ? (aa.sign < 0 ? `${v} - ${absA}` : `${v} + ${at}`) : `${at} + ${v}`;
          step = `${addOrSub(aa)} $${absA}$ ${aa.sign > 0 ? 'from' : 'to'} both sides.`;
          wrong = rhs.add(aa);
        }
      } else if (form === 'ax') {
        const a = decimals ? decFrac(dec(1, 9, 1)) : new Frac(intv(2, difficulty === 'easy' ? 9 : 12));
        if (a.eq(1) || a.eq(-1) || a.isZero()) return null;
        x = decimals ? decFrac(dec(1, 20, 1)) : fractions ? new Frac(intv(1, max), Math.abs(a.n)) : new Frac(intv(1, difficulty === 'easy' ? 10 : 15));
        if (fractions && !decimals && x.isInt()) return null;
        rhs = a.mul(x);
        lhs = `${fracOrDec(a, decimals)}${v}`;
        step = `Divide both sides by $${fracOrDec(a, decimals)}$.`;
        wrong = rhs.mul(a);
      } else if (form === 'x/a') {
        const a = rng.int(2, difficulty === 'easy' ? 9 : 12);
        const q = decimals ? decFrac(dec(1, 20, 1)) : new Frac(intv(1, difficulty === 'easy' ? 10 : 15));
        x = q.mul(a);
        rhs = q;
        const neg = negatives && rng.bool(0.3);
        if (neg) x = x.neg();
        lhs = `${neg ? '-' : ''}\\frac{${v}}{${a}}`;
        step = `Multiply both sides by $${neg ? -a : a}$.`;
        wrong = rhs.div(neg ? -a : a);
      } else {
        const den = rng.int(2, 5);
        const k = new Frac(rng.signedInt(1, den * 2, negatives), den);
        if (k.isInt() || k.d !== den) return null;
        x = new Frac(rng.signedInt(1, 8, negatives) * den);
        if (fractions) x = x.add(new Frac(1, 2));
        rhs = k.mul(x);
        if (!rhs.isInt() && !fractions) return null;
        lhs = sum([{ coef: k, sym: v }]);
        step = `Multiply both sides by $${num(k.inv())}$.`;
        wrong = rhs.mul(k);
      }
      if (x.isZero() || rhs.isZero()) return null;
      if (!negatives && (x.sign < 0 || rhs.sign < 0)) return null;
      if (!fractions && !decimals && !x.isInt()) return null;
      if (decimals && !isTerminating(x)) return null;
      if (Math.abs(rhs.value) > 400) return null;
      return { lhs, x, rhs, step, wrong };
    });
    const show = (f: Frac) => fracOrDec(f, decimals);
    const answer = m(`${v} = ${show(p.x)}`);
    const distractors = distinctDistractors(
      answer,
      [isTerminating(p.wrong) || !decimals ? m(`${v} = ${show(p.wrong)}`) : null, m(`${v} = ${show(p.x.neg())}`), m(`${v} = ${show(p.rhs)}`)],
      (k) => m(`${v} = ${show(p.x.add(decimals ? new Frac(offset(k), 10) : offset(k)))}`),
    );
    return {
      question: m(`${p.lhs} = ${show(p.rhs)}`),
      answer,
      steps: [p.step, m(`${v} = ${show(p.x)}`)],
      distractors,
      check: { kind: 'linear', variable: v, solution: p.x.value },
    };
  },
});

function decFrac(d: Dec): Frac {
  return new Frac(d.n, 10 ** d.s);
}

function isTerminating(f: Frac): boolean {
  let d = f.d;
  for (const p of [2, 5]) while (d % p === 0) d /= p;
  return d === 1;
}

/** A rational shown as a decimal (when `decimals`) or a fraction; negatives in parentheses when `wrapNeg`. */
function fracOrDec(f: Frac, decimals: boolean, wrapNeg = false): string {
  let t: string;
  if (decimals && isTerminating(f)) {
    let s = 0;
    while (!f.mul(10 ** s).isInt()) s++;
    t = new Dec(f.mul(10 ** s).n, s).toTex();
  } else t = f.toTex();
  return wrapNeg && f.sign < 0 ? `(${t})` : t;
}

// ---------------------------------------------------------------- multi-step equations

type Chunk = { k: 'v'; c: number } | { k: 'c'; c: number } | { k: 'g'; m: number; p: number; q: number };

const SHAPES: Record<string, Record<Difficulty, Array<[string, string]>>> = {
  combine: {
    easy: [['vcv', 'c'], ['vvc', 'c']],
    medium: [['vcv', 'c'], ['cvvc', 'c'], ['vcvc', 'c']],
    hard: [['vcvc', 'c'], ['cvcv', 'c'], ['vvcc', 'c']],
  },
  distribute: {
    easy: [['g', 'c'], ['gc', 'c']],
    medium: [['gc', 'c'], ['gv', 'c'], ['cg', 'c']],
    hard: [['gv', 'c'], ['cg', 'c'], ['gg', 'c']],
  },
  both: {
    easy: [['vc', 'vc'], ['v', 'vc']],
    medium: [['vc', 'vc'], ['g', 'vc'], ['cv', 'vc']],
    hard: [['g', 'vc'], ['gv', 'vc'], ['vc', 'gc']],
  },
};

function sideTex(side: Chunk[], v: string): string {
  let out = '';
  side.forEach((ch, i) => {
    let sign: number;
    let mag: string;
    if (ch.k === 'g') {
      sign = Math.sign(ch.m);
      const inner = sum([{ coef: ch.p, sym: v }, { coef: ch.q }]);
      mag = Math.abs(ch.m) === 1 ? `(${inner})` : `${Math.abs(ch.m)}(${inner})`;
    } else {
      sign = Math.sign(ch.c);
      mag = sum([{ coef: Math.abs(ch.c), sym: ch.k === 'v' ? v : '' }]);
    }
    out += i === 0 ? (sign < 0 ? `-${mag}` : mag) : ` ${sign < 0 ? '-' : '+'} ${mag}`;
  });
  return out;
}

function expandTerms(side: Chunk[], v: string): Term[] {
  return side.flatMap((ch): Term[] => (ch.k === 'g' ? [{ coef: ch.m * ch.p, sym: v }, { coef: ch.m * ch.q }] : [{ coef: ch.c, sym: ch.k === 'v' ? v : '' }]));
}

function collect(side: Chunk[]): { a: number; b: number } {
  return side.reduce(
    (acc, ch) => (ch.k === 'g' ? { a: acc.a + ch.m * ch.p, b: acc.b + ch.m * ch.q } : ch.k === 'v' ? { a: acc.a + ch.c, b: acc.b } : { a: acc.a, b: acc.b + ch.c }),
    { a: 0, b: 0 },
  );
}

export const multiStepEquations = defineTopic({
  id: 'prealg.multi-step',
  subject: 'prealgebra',
  category: CAT.equations,
  title: 'Multi-Step Equations',
  description: 'Combine like terms, distribute, and collect variables on one side to solve.',
  instruction: 'Solve each equation.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'form',
      label: 'Equation type',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'combine', label: 'Combining like terms' },
        { value: 'distribute', label: 'Distributive property' },
        { value: 'both', label: 'Variables on both sides' },
      ],
    },
    opt.negatives(true),
    opt.fractionAnswers(false),
    opt.variedVariables(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const f = strOpt(ctx, 'form');
    const family = f === 'mixed' ? rng.pick(['combine', 'distribute', 'both']) : f;
    const [ls, rs] = rng.pick(SHAPES[family]![difficulty]);
    const maxC = difficulty === 'easy' ? 9 : 12;
    const p = attempt('multi-step', () => {
      const chunk = (k: string): Chunk => {
        if (k === 'v') return { k: 'v', c: rng.signedInt(1, difficulty === 'easy' ? 6 : 9, negatives) };
        if (k === 'c') return { k: 'c', c: rng.signedInt(1, maxC, negatives) };
        return { k: 'g', m: rng.signedInt(2, difficulty === 'hard' ? 7 : 5, negatives), p: rng.signedInt(1, difficulty === 'hard' ? 4 : 1, negatives && difficulty === 'hard'), q: rng.signedInt(1, 9, negatives) };
      };
      const L = [...ls].map(chunk);
      const R = [...rs].map(chunk);
      const last = R[R.length - 1]!;
      if (last.k !== 'c') return null;
      const cl = collect(L);
      const cr0 = collect(R.slice(0, -1));
      const A = cl.a - cr0.a;
      if (A === 0 || cl.a === 0 || Math.abs(A) === 1 && rng.bool(0.6)) return null;
      // need at least one like-term combination or a distribution
      const x = fractions ? new Frac(rng.signedInt(1, 12, negatives), rng.int(2, 4)) : new Frac(rng.signedInt(1, difficulty === 'easy' ? 8 : 10, negatives));
      if (fractions && x.isInt()) return null;
      const c = x.mul(A).add(cl.b - cr0.b);
      if (!c.isInt() || c.isZero() || Math.abs(c.value) > 80) return null;
      if (!negatives && c.sign < 0) return null;
      (last as { c: number }).c = c.value;
      return { L, R, x, A, cl, cr: collect(R) };
    });
    const { L, R, x, A, cl, cr } = p;
    const steps: string[] = [];
    const hasGroup = [...L, ...R].some((ch) => ch.k === 'g');
    if (hasGroup) steps.push(`Distribute: $${sum(expandTerms(L, v))} = ${sum(expandTerms(R, v))}$`);
    const termsL = expandTerms(L, v);
    const termsR = expandTerms(R, v);
    const needsCombine = (ts: Term[]) => ts.filter((t) => t.sym).length > 1 || ts.filter((t) => !t.sym).length > 1;
    if (needsCombine(termsL) || needsCombine(termsR)) steps.push(`Combine like terms: $${sum([{ coef: cl.a, sym: v }, { coef: cl.b }])} = ${sum([{ coef: cr.a, sym: v }, { coef: cr.b }])}$`);
    if (cr.a !== 0) steps.push(`${addOrSub(cr.a)} $${sum([{ coef: Math.abs(cr.a), sym: v }])}$ ${cr.a > 0 ? 'from' : 'to'} both sides: $${sum([{ coef: A, sym: v }, { coef: cl.b }])} = ${cr.b}$`);
    const rhs = cr.b - cl.b;
    if (cl.b !== 0) steps.push(`${addOrSub(cl.b)} $${absTex(cl.b)}$ ${cl.b > 0 ? 'from' : 'to'} both sides: $${sum([{ coef: A, sym: v }])} = ${rhs}$`);
    if (A === -1) steps.push(`Multiply both sides by $-1$: $${v} = ${num(x)}$`);
    else if (A !== 1) steps.push(`Divide both sides by $${A}$: $${v} = ${num(x)}$`);
    const answer = m(`${v} = ${num(x)}`);
    const signSlip = new Frac(cr.b + cl.b, A);
    const addCoef = cl.a + cr.a !== 0 && cr.a !== 0 ? new Frac(rhs, cl.a + cr.a) : null;
    const distractors = distinctDistractors(
      answer,
      [signSlip, x.neg(), addCoef, new Frac(rhs).mul(A)].map((c) => (c && c.d <= 4 && Math.abs(c.value) <= 100 ? m(`${v} = ${num(c)}`) : null)),
      (k) => m(`${v} = ${num(x.add(offset(k)))}`),
    );
    return { question: m(`${sideTex(L, v)} = ${sideTex(R, v)}`), answer, steps, distractors, check: { kind: 'linear', variable: v, solution: x.value } };
  },
});

// ---------------------------------------------------------------- one- and two-step inequalities

type Rel = '<' | '>' | '\\le' | '\\ge';
const FLIP: Record<Rel, Rel> = { '<': '>', '>': '<', '\\le': '\\ge', '\\ge': '\\le' };
const STRICT_SWAP: Record<Rel, Rel> = { '<': '\\le', '\\le': '<', '>': '\\ge', '\\ge': '>' };
const isStrict = (r: Rel) => r === '<' || r === '>';

/** Number line around the boundary, with the solution ray in the answer key. */
function rayGraphs(x0: number, toRight: boolean, strict: boolean): { blank: Diagram; solved: Diagram } {
  const c = Math.round(x0);
  const lo = c - 5;
  const hi = c + 5;
  const blank = numberLine(lo, hi).build('Blank number line');
  const b = numberLine(lo, hi);
  b.arrow([x0, 0], [toRight ? hi + 0.7 : lo - 0.7, 0], { ink: 'accent', weight: 3 });
  b.dot([x0, 0], strict, 'accent');
  return { blank, solved: b.build('Number line with the solution graphed') };
}

type IForm = 'x+a' | 'x-a' | 'ax' | 'x/a' | 'ax+b' | 'x/a+b' | 'b-ax';

export const oneTwoStepInequalities = defineTopic({
  id: 'prealg.inequalities',
  subject: 'prealgebra',
  category: CAT.equations,
  title: 'One-Step and Two-Step Inequalities',
  description: 'Solve one- and two-step inequalities and graph the solutions on a number line.',
  instruction: (o) => (o.graph ? 'Solve each inequality and graph its solution.' : 'Solve each inequality.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'steps',
      label: 'Steps',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'One- and two-step' },
        { value: 'one', label: 'One-step' },
        { value: 'two', label: 'Two-step' },
      ],
    },
    opt.negatives(true),
    { type: 'boolean', id: 'graph', label: 'Graph on a number line', default: true },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const graph = boolOpt(ctx, 'graph');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const st = strOpt(ctx, 'steps');
    const one: IForm[] = ['x+a', 'x-a', 'ax', 'x/a'];
    const two: IForm[] = negatives ? ['ax+b', 'x/a+b', 'b-ax'] : ['ax+b', 'x/a+b'];
    const forms = st === 'one' ? one : st === 'two' ? two : difficulty === 'easy' ? one : difficulty === 'medium' ? [...one, ...two] : two;
    const p = attempt('inequality', () => {
      const form = rng.pick(forms);
      const rel = rng.pick<Rel>(['<', '>', '\\le', '\\ge']);
      const x0 = rng.signedInt(0, difficulty === 'easy' ? 9 : 12, negatives) + 0;
      // negative coefficients (sign flips) from medium on
      const negCoef = negatives && difficulty !== 'easy' && rng.bool(0.5);
      const a = rng.int(2, difficulty === 'easy' ? 6 : 9) * (negCoef ? -1 : 1);
      const b = rng.signedInt(1, difficulty === 'easy' ? 10 : 15, negatives);
      let lhs: string;
      let A: Frac;
      let B = 0;
      switch (form) {
        case 'x+a':
          A = Frac.ONE;
          B = b;
          lhs = sum([{ coef: 1, sym: v }, { coef: b }]);
          break;
        case 'x-a':
          A = Frac.ONE;
          B = -Math.abs(b);
          lhs = sum([{ coef: 1, sym: v }, { coef: B }]);
          break;
        case 'ax':
        case 'ax+b':
          A = new Frac(a);
          B = form === 'ax' ? 0 : b;
          lhs = sum([{ coef: a, sym: v }, { coef: B }]);
          break;
        case 'x/a':
        case 'x/a+b':
          A = new Frac(1, a);
          B = form === 'x/a' ? 0 : b;
          if (x0 % a !== 0) return null;
          lhs = sum([{ coef: 1, sym: a < 0 ? `-\\frac{${v}}{${-a}}` : `\\frac{${v}}{${a}}` }, { coef: B }]);
          break;
        default: {
          // b - ax with a > 0: the coefficient is negative
          const aa = Math.abs(a);
          A = new Frac(-aa);
          B = Math.abs(b) + 2;
          lhs = sum([{ coef: B }, { coef: -aa, sym: v }]);
        }
      }
      const C = A.mul(x0).add(B);
      if (!C.isInt() || Math.abs(C.value) > 100 || (!negatives && C.sign < 0)) return null;
      return { form, rel, x0, A, B, lhs, C: C.value };
    });
    const { rel, x0, A, B, lhs, C } = p;
    const finalRel = A.sign > 0 ? rel : FLIP[rel];
    const steps: string[] = [];
    if (B !== 0) steps.push(`${addOrSub(B)} $${absTex(B)}$ ${B > 0 ? 'from' : 'to'} both sides: $${sum([{ coef: A, sym: v }])} ${rel} ${C - B}$`);
    if (!A.eq(1)) {
      const how = A.isInt() ? `Divide both sides by $${num(A)}$` : `Multiply both sides by $${num(A.inv())}$`;
      steps.push(`${how}${A.sign < 0 ? ' and reverse the inequality sign' : ''}: $${v} ${finalRel} ${x0}$`);
    }
    const ineq = (r: Rel, c: number) => m(`${v} ${r} ${c}`);
    const answer = ineq(finalRel, x0);
    const slip = A.isInt() ? new Frac(C + B).div(A) : new Frac(C + B).mul(A.inv());
    const distractors = distinctDistractors(
      answer,
      [ineq(FLIP[finalRel], x0), ineq(STRICT_SWAP[finalRel], x0), slip.isInt() ? ineq(finalRel, slip.value) : null, ineq(finalRel, -x0)],
      (k) => ineq(finalRel, x0 + offset(k)),
    );
    const toRight = finalRel === '>' || finalRel === '\\ge';
    const g = rayGraphs(x0, toRight, isStrict(finalRel));
    return {
      question: m(`${lhs} ${rel} ${C}`),
      answer,
      steps,
      distractors,
      diagram: graph ? g.blank : undefined,
      answerDiagram: graph ? g.solved : undefined,
      check: { kind: 'prealgebra.inequality', variable: v },
    };
  },
});
