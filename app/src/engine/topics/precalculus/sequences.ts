/** Arithmetic and geometric sequences and series. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m, num, parenNeg, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Kind = 'arithmetic' | 'geometric';
type Task = 'term' | 'formula' | 'sum' | 'sigma' | 'infinite';

interface Seq {
  kind: Kind;
  a1: Frac;
  /** common difference or ratio */
  k: Frac;
}

const term = (s: Seq, n: number): Frac => (s.kind === 'arithmetic' ? s.a1.add(s.k.mul(n - 1)) : s.a1.mul(s.k.pow(n - 1)));
const partial = (s: Seq, n: number): Frac => {
  let acc = Frac.ZERO;
  for (let i = 1; i <= n; i++) acc = acc.add(term(s, i));
  return acc;
};

function formulaTex(s: Seq): string {
  if (s.kind === 'arithmetic') return sum([{ coef: s.k, sym: 'n' }, { coef: s.a1.sub(s.k) }]);
  const base = s.k.sign < 0 || !s.k.isInt() ? `\\left(${num(s.k)}\\right)` : num(s.k);
  const power = `${base}^{n - 1}`;
  if (s.a1.eq(1)) return power;
  if (s.a1.eq(-1)) return `-${power}`;
  return s.k.sign < 0 || !s.k.isInt() ? `${num(s.a1)}${power}` : `${num(s.a1)} \\cdot ${power}`;
}

function pickSeq(rng: Rng, kind: Kind, d: Difficulty): Seq {
  if (kind === 'arithmetic') {
    return { kind, a1: new Frac(rng.int(-20, 20)), k: new Frac(rng.signedInt(1, d === 'easy' ? 6 : 12, true)) };
  }
  return attempt('geometric', () => {
    const options = d === 'easy' ? [2, 3] : d === 'medium' ? [2, 3, -2, -3, 4] : [2, -2, 3, -3];
    const fractional = d !== 'easy' && rng.bool(0.3);
    const k = fractional ? new Frac(rng.pick([1, -1]), rng.pick([2, 3])) : new Frac(rng.pick(options));
    const a1 = fractional ? new Frac(rng.signedInt(1, 3, true) * k.d ** 4) : new Frac(rng.signedInt(1, 6, true));
    return { kind, a1, k };
  });
}

export const sequencesSeries = defineTopic({
  id: 'precalc.sequences',
  subject: 'precalculus',
  title: 'Arithmetic & Geometric Sequences',
  description: 'nth terms, explicit formulas, partial sums, sigma notation and infinite geometric series.',
  instruction: 'Each sequence or series is arithmetic or geometric. Answer as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'kind',
      label: 'Sequences',
      default: 'any',
      choices: [
        { value: 'any', label: 'Arithmetic and geometric' },
        { value: 'arithmetic', label: 'Arithmetic only' },
        { value: 'geometric', label: 'Geometric only' },
      ],
    },
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed (by difficulty)' },
        { value: 'term', label: 'A specific term' },
        { value: 'formula', label: 'Explicit formula' },
        { value: 'sum', label: 'Sums / series' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kOpt = strOpt(ctx, 'kind');
    const kind: Kind = kOpt === 'any' ? rng.pick<Kind>(['arithmetic', 'geometric']) : (kOpt as Kind);
    const tOpt = strOpt(ctx, 'task');
    let task: Task;
    if (tOpt === 'term' || tOpt === 'formula') task = tOpt;
    else if (tOpt === 'sum') task = difficulty === 'hard' ? rng.pick<Task>(['sum', 'sigma', 'infinite']) : 'sum';
    else task = difficulty === 'easy' ? rng.pick<Task>(['term', 'formula']) : difficulty === 'medium' ? rng.pick<Task>(['term', 'formula', 'sum']) : rng.pick<Task>(['sum', 'sigma', 'infinite', 'formula']);
    if (task === 'infinite' && kind === 'arithmetic') task = 'sigma';

    let s = pickSeq(rng, kind, difficulty);
    if (task === 'infinite') {
      // |r| < 1
      s = { kind: 'geometric', k: new Frac(rng.pick([1, -1, 2, -2]), rng.pick([3, 4, 5])), a1: Frac.ZERO };
      if (Math.abs(s.k.value) >= 1) s = { ...s, k: new Frac(1, 2) };
      s = { ...s, a1: new Frac(rng.signedInt(1, 4, true) * s.k.d ** 3) };
    }
    const shown = [1, 2, 3, 4].map((i) => num(term(s, i)));
    const list = `${shown.join(', ')}, \\ldots`;
    const name = s.kind === 'arithmetic' ? 'd' : 'r';
    const kTex = num(s.k);
    const steps: string[] = [m(`${name} = ${kTex}`)];
    let question: string;
    let answer: string;
    let wrongs: Frac[] = [];
    let wrongTex: string[] = [];
    let fallback: (k: number) => string;
    const general = s.kind === 'arithmetic' ? `a_n = ${num(s.a1)} + (n - 1)(${kTex})` : `a_n = ${num(s.a1)}\\left(${kTex}\\right)^{n - 1}`;

    switch (task) {
      case 'term': {
        const n = s.kind === 'arithmetic' ? rng.int(10, 40) : rng.int(6, difficulty === 'easy' ? 8 : 10);
        const value = term(s, n);
        question = `Find $a_{${n}}$ for $${list}$`;
        steps.push(m(general));
        steps.push(m(`a_{${n}} = ${num(value)}`));
        answer = m(`a_{${n}} = ${num(value)}`);
        wrongs = [term(s, n + 1), term(s, n - 1), s.kind === 'arithmetic' ? s.a1.add(s.k.mul(n)) : s.a1.mul(s.k.pow(n))];
        wrongTex = wrongs.map((w) => m(`a_{${n}} = ${num(w)}`));
        fallback = (k) => m(`a_{${n}} = ${num(value.add(offset(k)))}`);
        break;
      }
      case 'formula': {
        question = `Write an explicit formula for $${list}$`;
        steps.push(m(general));
        if (s.kind === 'arithmetic') steps.push(m(`a_n = ${formulaTex(s)}`));
        answer = m(`a_n = ${formulaTex(s)}`);
        const alts: Seq[] = [
          { ...s, k: s.k.neg() },
          s.kind === 'arithmetic' ? { ...s, a1: s.a1.add(s.k) } : { ...s, a1: s.a1.mul(s.k) },
          s.kind === 'arithmetic' ? { kind: 'geometric', a1: s.a1.isZero() ? Frac.ONE : s.a1, k: s.k.abs().add(1) } : { kind: 'arithmetic', a1: s.a1, k: term(s, 2).sub(s.a1) },
        ];
        wrongTex = alts.map((a) => m(`a_n = ${formulaTex(a)}`));
        fallback = (k) => m(`a_n = ${formulaTex({ ...s, a1: s.a1.add(offset(k)) })}`);
        break;
      }
      case 'sum':
      case 'sigma': {
        const n = s.kind === 'arithmetic' ? rng.int(8, 30) : rng.int(5, 8);
        const value = partial(s, n);
        if (task === 'sigma') {
          const summand = s.kind === 'arithmetic' ? `\\left(${formulaTex(s).replace(/n/g, 'k')}\\right)` : formulaTex(s).replace(/n/g, 'k');
          question = `Evaluate $\\displaystyle \\sum_{k=1}^{${n}} ${summand}$`;
        } else question = `Find $S_{${n}}$ for $${list}$`;
        if (s.kind === 'arithmetic') {
          steps.push(m(`a_{${n}} = ${num(term(s, n))}`));
          steps.push(m(`S_{${n}} = \\frac{${n}(${num(s.a1)} + ${parenNeg(term(s, n))})}{2} = ${num(value)}`));
        } else {
          steps.push(m(`S_{${n}} = \\frac{${num(s.a1)}\\left(1 - ${s.k.sign < 0 || !s.k.isInt() ? `\\left(${kTex}\\right)` : kTex}^{${n}}\\right)}{1 - ${s.k.sign < 0 ? `(${kTex})` : kTex}} = ${num(value)}`));
        }
        answer = m(num(value));
        wrongs = [partial(s, n - 1), partial(s, n + 1), term(s, n)];
        wrongTex = wrongs.map((w) => m(num(w)));
        fallback = (k) => m(num(value.add(offset(k))));
        break;
      }
      case 'infinite':
      default: {
        const value = s.a1.div(Frac.ONE.sub(s.k));
        const terms = [1, 2, 3, 4].map((i) => term(s, i));
        question = `Find the sum: $${terms.map((t, i) => (i === 0 ? num(t) : t.sign < 0 ? `- ${num(t.abs())}` : `+ ${num(t)}`)).join(' ')} + \\cdots$`;
        steps.push(m(`S = \\frac{a_1}{1 - r} = \\frac{${num(s.a1)}}{1 - ${s.k.sign < 0 ? `\\left(${kTex}\\right)` : kTex}} = ${num(value)}`));
        answer = m(num(value));
        wrongs = [s.a1.div(Frac.ONE.add(s.k)), s.a1.div(s.k), partial(s, 4)];
        wrongTex = wrongs.map((w) => m(num(w)));
        fallback = (k) => m(num(value.add(offset(k))));
        break;
      }
    }
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongTex, fallback),
      check: { kind: 'sequence', task, seqKind: s.kind, a1: s.a1.value, k: s.k.value },
    };
  },
});
