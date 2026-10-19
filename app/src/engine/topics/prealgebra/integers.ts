/** Integer arithmetic: adding/subtracting, multiplying/dividing, absolute value. */
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, parenNeg } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT } from './common';

const signed = (rng: Rng, max: number) => rng.signedInt(1, max, true);

/** `a + (-b)` style rendering of a chain of integers joined by + / −. */
function chainTex(xs: number[], ops: Array<'+' | '-'>): string {
  return xs.reduce((acc, x, i) => (i === 0 ? String(x) : `${acc} ${ops[i - 1]} ${parenNeg(x)}`), '');
}

export const addSubIntegers = defineTopic({
  id: 'prealg.integers.add-sub',
  subject: 'prealgebra',
  category: CAT.integers,
  title: 'Adding and Subtracting Integers',
  description: 'Find sums and differences of positive and negative integers.',
  instruction: (o) => (o.operation === 'add' ? 'Find each sum.' : o.operation === 'sub' ? 'Find each difference.' : 'Find each sum or difference.'),
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operations',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Addition and subtraction' },
        { value: 'add', label: 'Addition only' },
        { value: 'sub', label: 'Subtraction only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const which = strOpt(ctx, 'operation');
    const count = difficulty === 'easy' ? 2 : difficulty === 'medium' ? rng.pick([2, 3]) : rng.pick([3, 4]);
    const max = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 25 : 60;
    const { xs, ops } = attempt('add-sub', () => {
      const xs = Array.from({ length: count }, () => signed(rng, max));
      const ops = Array.from({ length: count - 1 }, () => (which === 'add' ? '+' : which === 'sub' ? '-' : rng.pick(['+', '-'] as const)));
      if (!xs.some((x) => x < 0)) return null;
      return { xs, ops };
    });
    const terms = xs.map((x, i) => (i === 0 || ops[i - 1] === '+' ? x : -x));
    const value = terms.reduce((s, t) => s + t, 0);
    const steps: string[] = [];
    if (ops.includes('-')) steps.push(`Add the opposite: $${terms.reduce((acc, t, i) => (i === 0 ? String(t) : `${acc} + ${parenNeg(t)}`), '')}$`);
    let acc = terms[0]!;
    for (let i = 1; i < terms.length; i++) {
      acc += terms[i]!;
      const rest = terms.slice(i + 1).map((t) => ` + ${parenNeg(t)}`).join('');
      steps.push(m(`= ${acc}${rest}`));
    }
    const answer = m(String(value));
    // common mistakes: ignoring the subtraction sign, adding absolute values, sign of the result
    const ignoreSub = xs.reduce((s, x) => s + x, 0);
    const absSum = Math.sign(value || 1) * terms.reduce((s, t) => s + Math.abs(t), 0);
    const distractors = distinctDistractors(answer, [m(String(-value)), m(String(ignoreSub)), m(String(absSum)), m(String(-ignoreSub))], (k) => m(String(value + 2 * offset(k))));
    return { question: m(chainTex(xs, ops)), answer, steps, distractors, check: { kind: 'value', value } };
  },
});

type MOp = '\\times' | '\\div';

export const mulDivIntegers = defineTopic({
  id: 'prealg.integers.mul-div',
  subject: 'prealgebra',
  category: CAT.integers,
  title: 'Multiplying and Dividing Integers',
  description: 'Find products and quotients of positive and negative integers.',
  instruction: (o) => (o.operation === 'mul' ? 'Find each product.' : o.operation === 'div' ? 'Find each quotient.' : 'Find each product or quotient.'),
  multipleChoice: true,
  defaultCount: 16,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operations',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Multiplication and division' },
        { value: 'mul', label: 'Multiplication only' },
        { value: 'div', label: 'Division only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const which = strOpt(ctx, 'operation');
    const count = difficulty === 'hard' ? 3 : 2;
    const max = difficulty === 'easy' ? 9 : difficulty === 'medium' ? 12 : 10;
    const p = attempt('mul-div', () => {
      const ops: MOp[] = Array.from({ length: count - 1 }, () => (which === 'mul' ? '\\times' : which === 'div' ? '\\div' : rng.pick(['\\times', '\\div'] as const)));
      // build left to right; a division's dividend is made a multiple of the divisor
      const factors = Array.from({ length: count }, () => rng.signedInt(difficulty === 'easy' ? 1 : 2, max, true));
      if (difficulty === 'medium' && rng.bool(0.4)) factors[0] = factors[0]! * rng.int(2, 4);
      let acc = factors[0]!;
      const xs = [acc];
      for (let i = 0; i < ops.length; i++) {
        const b = factors[i + 1]!;
        if (ops[i] === '\\div') {
          // replace the running value by a multiple of b: only possible for the first operand
          if (i === 0) {
            acc = acc * b;
            xs[0] = acc;
          } else if (acc % b !== 0) return null;
          acc = acc / b;
        } else acc = acc * b;
        xs.push(b);
      }
      if (!xs.some((x) => x < 0) || Math.abs(xs[0]!) > 150 || Math.abs(acc) > 400 || Math.abs(xs[0]!) === 1) return null;
      return { xs, ops, value: acc };
    });
    const { xs, ops, value } = p;
    const question = xs.reduce((s, x, i) => (i === 0 ? String(x) : `${s} ${ops[i - 1]} ${parenNeg(x)}`), '');
    const negCount = xs.filter((x) => x < 0).length;
    const steps: string[] = [
      `${negCount === 1 ? 'One negative number' : `${negCount} negative numbers`}: the result is ${negCount % 2 === 0 ? 'positive' : 'negative'}.`,
    ];
    if (xs.length > 2) {
      const first = ops[0] === '\\times' ? xs[0]! * xs[1]! : xs[0]! / xs[1]!;
      steps.push(m(`= ${first} ${ops[1]} ${parenNeg(xs[2]!)}`));
    }
    steps.push(m(`= ${value}`));
    const answer = m(String(value));
    const absVal = Math.abs(value);
    const wrongOp = ops.length === 1 ? (ops[0] === '\\times' ? xs[0]! / xs[1]! : xs[0]! * xs[1]!) : null;
    const distractors = distinctDistractors(
      answer,
      [m(String(-value)), wrongOp !== null && Number.isInteger(wrongOp) ? m(String(wrongOp)) : null, m(String(value < 0 ? absVal + xs.length : -(absVal + xs.length)))],
      (k) => m(String(value + offset(k) * Math.max(1, Math.abs(xs[xs.length - 1]!)))),
    );
    return { question: m(question), answer, steps, distractors, check: { kind: 'value', value } };
  },
});

// ---------------------------------------------------------------- absolute value

interface AbsExpr {
  tex: string;
  value: number;
  /** Value when every |…| is read as ordinary parentheses (the classic mistake). */
  noAbs: number;
  steps: string[];
}

function absTemplates(rng: Rng, d: Difficulty): AbsExpr | null {
  const n = (max: number) => signed(rng, max);
  const pos = (lo: number, hi: number) => rng.int(lo, hi);
  const easy = (): AbsExpr => {
    const k = rng.int(0, 3);
    const a = n(15);
    const b = n(15);
    switch (k) {
      case 0:
        return { tex: `|${a}|`, value: Math.abs(a), noAbs: a, steps: [] };
      case 1:
        return { tex: `-|${a}|`, value: -Math.abs(a), noAbs: -a, steps: [] };
      case 2:
        return { tex: `|${a}| + |${b}|`, value: Math.abs(a) + Math.abs(b), noAbs: a + b, steps: [m(`= ${Math.abs(a)} + ${Math.abs(b)}`)] };
      default:
        return { tex: `|${a}| - |${b}|`, value: Math.abs(a) - Math.abs(b), noAbs: a - b, steps: [m(`= ${Math.abs(a)} - ${Math.abs(b)}`)] };
    }
  };
  if (d === 'easy') return easy();
  if (d === 'medium') {
    const k = rng.int(0, 4);
    const a = n(12);
    const b = n(12);
    const c = pos(2, 6);
    switch (k) {
      case 0: {
        const v = a - b;
        return { tex: `|${a} - ${parenNeg(b)}|`, value: Math.abs(v), noAbs: v, steps: [m(`= |${v}|`)] };
      }
      case 1: {
        const v = a + b;
        return { tex: `-|${a} + ${parenNeg(b)}|`, value: -Math.abs(v), noAbs: -v, steps: [m(`= -|${v}|`)] };
      }
      case 2: {
        const s = pos(1, 9);
        return { tex: `${c}|${a}| - ${s}`, value: c * Math.abs(a) - s, noAbs: c * a - s, steps: [m(`= ${c} \\cdot ${Math.abs(a)} - ${s}`)] };
      }
      case 3:
        return { tex: `|${a}| \\cdot |${b}|`, value: Math.abs(a * b), noAbs: a * b, steps: [m(`= ${Math.abs(a)} \\cdot ${Math.abs(b)}`)] };
      default: {
        const q = n(9);
        const dvs = n(6);
        if (Math.abs(dvs) === 1) return null;
        const top = q * dvs;
        return { tex: `|${top}| \\div |${dvs}|`, value: Math.abs(q), noAbs: q, steps: [m(`= ${Math.abs(top)} \\div ${Math.abs(dvs)}`)] };
      }
    }
  }
  const k = rng.int(0, 3);
  const a = n(15);
  const b = n(15);
  const c = pos(2, 5);
  switch (k) {
    case 0: {
      const inner = a - b;
      const extra = n(12);
      const v = -c * Math.abs(inner) + Math.abs(extra);
      return {
        tex: `-${c}|${a} - ${parenNeg(b)}| + |${extra}|`,
        value: v,
        noAbs: -c * inner + extra,
        steps: [m(`= -${c}|${inner}| + ${Math.abs(extra)}`), m(`= -${c} \\cdot ${Math.abs(inner)} + ${Math.abs(extra)}`)],
      };
    }
    case 1: {
      const x = n(6);
      const y = n(6);
      const z = n(12);
      const w = n(12);
      const v = Math.abs(x * y) - Math.abs(z - w);
      return {
        tex: `|${x} \\cdot ${parenNeg(y)}| - |${z} - ${parenNeg(w)}|`,
        value: v,
        noAbs: x * y - (z - w),
        steps: [m(`= |${x * y}| - |${z - w}|`), m(`= ${Math.abs(x * y)} - ${Math.abs(z - w)}`)],
      };
    }
    case 2: {
      const q = n(8);
      const den = rng.int(2, 6) * rng.sign();
      const p = rng.int(-9, 9);
      const r = p - den; // p - r = den
      const top = q * den;
      if (r === 0) return null;
      return {
        tex: `\\frac{|${top}|}{|${p} - ${parenNeg(r)}|}`,
        value: Math.abs(q),
        noAbs: q,
        steps: [m(`= \\frac{${Math.abs(top)}}{|${den}|}`), m(`= \\frac{${Math.abs(top)}}{${Math.abs(den)}}`)],
      };
    }
    default: {
      const v1 = a + b;
      const t = n(10);
      const v = Math.abs(v1) * c - Math.abs(t);
      return {
        tex: `${c}|${a} + ${parenNeg(b)}| - |${t}|`,
        value: v,
        noAbs: c * v1 - t,
        steps: [m(`= ${c}|${v1}| - ${Math.abs(t)}`), m(`= ${c} \\cdot ${Math.abs(v1)} - ${Math.abs(t)}`)],
      };
    }
  }
}

export const absoluteValue = defineTopic({
  id: 'prealg.integers.absolute-value',
  subject: 'prealgebra',
  category: CAT.integers,
  title: 'Absolute Value',
  description: 'Evaluate expressions containing absolute values of integers.',
  instruction: 'Evaluate each expression.',
  multipleChoice: true,
  defaultCount: 12,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const e = attempt('absolute-value', () => {
      const r = absTemplates(rng, difficulty);
      if (!r || Math.abs(r.value) > 200) return null;
      return r;
    });
    const answer = m(String(e.value));
    const steps = [...e.steps, m(`= ${e.value}`)];
    const distractors = distinctDistractors(answer, [m(String(e.noAbs)), m(String(-e.value)), m(String(-e.noAbs))], (k) => m(String(e.value + offset(k))));
    return { question: m(e.tex), answer, steps, distractors, check: { kind: 'value', value: e.value } };
  },
});
