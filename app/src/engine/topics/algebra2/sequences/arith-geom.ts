/**
 * Arithmetic and geometric sequences: a named term, the explicit formula,
 * the recursive formula, and sequences determined by two given terms.
 */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, strOpt } from '../../../generator';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent, TopicGenerator } from '../../../types';
import { agExplicit, agRecursive, agTerm, baseTex, listTex, nudge, pickAG, recursiveRich, type AG, type SeqKind } from './common';

type Task = 'term' | 'explicit' | 'recursive' | 'twoTerms';

const TASKS: Record<Difficulty, Task[]> = {
  easy: ['term', 'explicit', 'recursive', 'term'],
  medium: ['term', 'explicit', 'recursive', 'twoTerms'],
  hard: ['term', 'explicit', 'recursive', 'twoTerms', 'twoTerms'],
};

/** How the sequence is presented in the question. */
type Given = 'list' | 'first' | 'kth' | 'formula';

const sym = (kind: SeqKind) => (kind === 'arithmetic' ? 'd' : 'r');

const coefD = (c: number, v: string) => (c === 1 ? v : `${c}${v}`);
const rPow = (e: number) => (e === 1 ? 'r' : `r^{${e}}`);

/** Step recovering a_1 from a_k. */
function firstFromKth(s: AG, k: number): string {
  return m(s.kind === 'arithmetic' ? `a_1 = a_{${k}} - ${coefD(k - 1, 'd')} = ${num(s.a1)}` : `a_1 = \\frac{a_{${k}}}{${rPow(k - 1)}} = ${num(s.a1)}`);
}

function givenTex(s: AG, given: Given, kth: number): string {
  switch (given) {
    case 'list':
      return m(listTex([1, 2, 3, 4].map((i) => agTerm(s, i))));
    case 'first':
      return `${m(`a_1 = ${num(s.a1)}`)}, ${m(`${sym(s.kind)} = ${num(s.k)}`)}`;
    case 'kth':
      return `${m(`a_{${kth}} = ${num(agTerm(s, kth))}`)}, ${m(`${sym(s.kind)} = ${num(s.k)}`)}`;
    default:
      return m(`a_n = ${agExplicit(s)}`);
  }
}

function seqDistractorSeqs(s: AG): AG[] {
  if (s.kind === 'arithmetic') {
    return [
      { ...s, a1: s.a1.add(s.k) }, // a_n = a1 + dn
      { ...s, k: s.k.neg() },
      { ...s, a1: s.k, k: s.a1.isZero() ? Frac.ONE : s.a1 }, // swapped roles
      { ...s, a1: s.a1.sub(s.k) },
    ];
  }
  return [
    { ...s, a1: s.a1.mul(s.k) }, // a1·r^n
    { ...s, k: s.k.neg() },
    { ...s, a1: s.k, k: s.a1.abs().eq(1) || !s.a1.isInt() ? s.k.add(1) : s.a1 }, // swapped roles
    { kind: 'arithmetic', a1: s.a1, k: s.k },
  ];
}

function build(kind: SeqKind) {
  return (ctx: Parameters<TopicGenerator['generate']>[0]): ProblemContent => {
    const { rng, difficulty: d } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const fractions = boolOpt(ctx, 'fractions');
    const tOpt = strOpt(ctx, 'task');
    const task: Task = tOpt === 'any' || !tOpt ? rng.pick(TASKS[d]) : (tOpt as Task);
    const s = attempt('ag-seq', () => {
      const c = pickAG(rng, kind, d, negatives, fractions);
      if (c.kind === 'geometric' && c.k.abs().eq(1)) return null;
      return c;
    });
    const L = sym(kind);
    const general = kind === 'arithmetic' ? `a_n = a_1 + (n - 1)d` : `a_n = a_1 \\cdot r^{n - 1}`;
    const maxN = kind === 'arithmetic' ? (d === 'easy' ? 30 : 60) : d === 'easy' ? 7 : d === 'medium' ? 9 : 10;
    const steps: string[] = [];
    let question: string;
    let answer: string;
    let wrong: string[];
    let fallback: (k: number) => string;
    const explicitAns = (q: AG) => m(`a_n = ${agExplicit(q)}`);
    const recursiveAns = (q: AG) => recursiveRich(agRecursive(q), q.a1);

    if (task === 'twoTerms') {
      const gaps = kind === 'arithmetic' ? [2, 3, 4, 5, 6, 7, 8] : d === 'hard' ? [1, 3] : [1, 3];
      const gap = rng.pick(gaps);
      const k1 = rng.int(kind === 'arithmetic' ? 2 : 1, kind === 'arithmetic' ? 15 : 4);
      const k2 = k1 + gap;
      const v1 = agTerm(s, k1);
      const v2 = agTerm(s, k2);
      const facts = `${m(`a_{${k1}} = ${num(v1)}`)} and ${m(`a_{${k2}} = ${num(v2)}`)}`;
      const ask = d === 'hard' ? rng.pick(['explicit', 'recursive', 'term'] as const) : 'explicit';
      if (kind === 'arithmetic') steps.push(m(`d = \\frac{${num(v2)} - ${v1.sign < 0 ? `(${num(v1)})` : num(v1)}}{${k2} - ${k1}} = ${num(s.k)}`));
      else if (gap === 1) steps.push(m(`r = \\frac{${num(v2)}}{${num(v1)}} = ${num(s.k)}`));
      else steps.push(m(`r^{${gap}} = \\frac{${num(v2)}}{${num(v1)}} = ${num(v2.div(v1))} \\Rightarrow r = ${num(s.k)}`));
      if (k1 > 1) steps.push(firstFromKth(s, k1));
      const wrongSeqs: AG[] =
        kind === 'arithmetic'
          ? [
              { ...s, a1: v1.sub(s.k.mul(k1)) },
              { ...s, k: s.k.neg(), a1: v1.add(s.k.mul(k1 - 1)) },
              { ...s, k: v2.sub(v1).div(gap + 1), a1: v1.sub(v2.sub(v1).div(gap + 1).mul(k1 - 1)) },
            ]
          : [
              { ...s, a1: v1.div(s.k.pow(k1)) },
              { ...s, k: s.k.neg(), a1: v1.div(s.k.neg().pow(k1 - 1)) },
              { ...s, a1: v1 },
            ];
      if (ask === 'term') {
        const N = k2 + rng.int(2, kind === 'arithmetic' ? 20 : 3);
        question = `${facts}. Find ${m(`a_{${N}}`)}.`;
        steps.push(m(`a_{${N}} = ${num(agTerm(s, N))}`));
        answer = m(`a_{${N}} = ${num(agTerm(s, N))}`);
        wrong = wrongSeqs.map((w) => m(`a_{${N}} = ${num(agTerm(w, N))}`));
        fallback = (k) => m(`a_{${N}} = ${num(nudge(agTerm(s, N), k))}`);
      } else if (ask === 'recursive') {
        question = `${facts}. Find the recursive formula.`;
        answer = recursiveAns(s);
        wrong = wrongSeqs.map(recursiveAns);
        fallback = (k) => recursiveAns({ ...s, a1: nudge(s.a1, k) });
      } else {
        question = `${facts}. Find the explicit formula.`;
        steps.push(m(general));
        answer = explicitAns(s);
        wrong = wrongSeqs.map(explicitAns);
        fallback = (k) => explicitAns({ ...s, a1: nudge(s.a1, k) });
      }
      return {
        question,
        answer,
        steps,
        distractors: distinctDistractors(answer, wrong, fallback),
        check: { kind: 'alg2-sequences-probability.seq', seq: kind, a1: s.a1.value, k: s.k.value, asked: ask },
      };
    }

    const givens: Given[] =
      task === 'term'
        ? d === 'easy'
          ? ['list', 'first', 'formula']
          : d === 'medium'
            ? ['list', 'first', 'kth']
            : ['kth', 'list', 'kth']
        : d === 'easy'
          ? ['list', 'first']
          : ['list', 'first', 'kth'];
    const given = rng.pick(givens);
    const kth = rng.int(2, kind === 'arithmetic' ? 12 : 4);
    const shown = givenTex(s, given, kth);
    steps.push(m(`${L} = ${num(s.k)}`));
    if (given === 'kth') steps.push(firstFromKth(s, kth));

    if (task === 'term') {
      const N = attempt('ag-index', () => {
        const n = rng.int(kind === 'arithmetic' ? 10 : 5, maxN);
        return given === 'kth' && n <= kth + 1 ? null : n;
      });
      const value = agTerm(s, N);
      question = `${shown}. Find ${m(`a_{${N}}`)}.`;
      if (given !== 'formula') steps.push(m(kind === 'arithmetic' ? `a_{${N}} = ${num(s.a1)} + ${N - 1}${s.k.sign < 0 || !s.k.isInt() ? `\\left(${num(s.k)}\\right)` : ` \\cdot ${num(s.k)}`}` : `a_{${N}} = ${num(s.a1)} \\cdot ${baseTex(s.k)}^{${N - 1}}`));
      else steps.push(m(`a_{${N}} = ${agExplicit(s, `(${N})`).replace(`(${N}) - 1`, String(N - 1))}`));
      steps.push(m(`a_{${N}} = ${num(value)}`));
      answer = m(`a_{${N}} = ${num(value)}`);
      const wrongVals = [agTerm(s, N + 1), agTerm(s, N - 1), ...seqDistractorSeqs(s).slice(1, 2).map((w) => agTerm(w, N))];
      wrong = wrongVals.map((w) => m(`a_{${N}} = ${num(w)}`));
      fallback = (k) => m(`a_{${N}} = ${num(nudge(value, k))}`);
    } else if (task === 'explicit') {
      question = `${shown}. Find the explicit formula.`;
      steps.push(m(general));
      answer = explicitAns(s);
      wrong = seqDistractorSeqs(s).map(explicitAns);
      fallback = (k) => explicitAns({ ...s, a1: nudge(s.a1, k) });
    } else {
      question = `${shown}. Find the recursive formula.`;
      steps.push(m(kind === 'arithmetic' ? `a_n = a_{n-1} + d` : `a_n = r \\cdot a_{n-1}`));
      answer = recursiveAns(s);
      const second = agTerm(s, 2);
      wrong = [
        recursiveAns({ ...s, k: kind === 'arithmetic' ? s.k.neg() : s.k.inv() }),
        recursiveAns({ ...s, a1: second }),
        kind === 'arithmetic'
          ? recursiveRich(agRecursive({ kind: 'geometric', a1: s.a1, k: s.k.abs().eq(1) ? new Frac(2) : s.k }), s.a1)
          : recursiveRich(agRecursive({ kind: 'arithmetic', a1: s.a1, k: s.k }), s.a1),
      ];
      fallback = (k) => recursiveAns({ ...s, a1: nudge(s.a1, k) });
    }
    return {
      question,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong, fallback),
      check: { kind: 'alg2-sequences-probability.seq', seq: kind, a1: s.a1.value, k: s.k.value, asked: task === 'term' ? 'term' : task },
    };
  };
}

const taskOption = {
  type: 'select' as const,
  id: 'task',
  label: 'Find',
  default: 'any',
  choices: [
    { value: 'any', label: 'Mixed' },
    { value: 'term', label: 'A named term' },
    { value: 'explicit', label: 'Explicit formula' },
    { value: 'recursive', label: 'Recursive formula' },
    { value: 'twoTerms', label: 'Formula from two terms' },
  ],
};

export const arithmeticSequences = defineTopic({
  id: 'alg2.seq.arithmetic',
  subject: 'algebra2',
  title: 'Arithmetic Sequences',
  description: 'Find named terms and explicit or recursive formulas of arithmetic sequences, including from two given terms.',
  category: 'Sequences and Series',
  instruction: 'Each sequence is arithmetic. Answer as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [taskOption, opt.negatives(true), { ...opt.fractionAnswers(false), label: 'Allow fractional differences', help: 'Medium and hard only.' }],
  generate: build('arithmetic'),
});

export const geometricSequences = defineTopic({
  id: 'alg2.seq.geometric',
  subject: 'algebra2',
  title: 'Geometric Sequences',
  description: 'Find named terms and explicit or recursive formulas of geometric sequences, including from two given terms.',
  category: 'Sequences and Series',
  instruction: 'Each sequence is geometric. Answer as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [taskOption, opt.negatives(true), { ...opt.fractionAnswers(false), label: 'Allow fractional ratios', help: 'Medium and hard only.' }],
  generate: build('geometric'),
});
