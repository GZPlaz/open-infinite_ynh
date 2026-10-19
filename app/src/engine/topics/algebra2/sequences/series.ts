/** General, arithmetic and geometric series: sigma notation, partial sums, number of terms, infinite sums. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, parenNeg } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { agExplicit, agPartial, agTerm, baseTex, pickAG, seriesBody, seriesTex, type AG } from './common';
import { patternDistractors, pattern, type Fm, type Pattern } from './general';

const CHECK = 'alg2-sequences-probability.seq';

/** True when a top-level + or − separates terms (so a summand needs brackets). */
function hasTopLevelSum(tex: string): boolean {
  let depth = 0;
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i]!;
    if (ch === '{' || ch === '(') depth++;
    else if (ch === '}' || ch === ')') depth--;
    else if (depth === 0 && i > 0 && (ch === '+' || ch === '-')) return true;
  }
  return false;
}

/** `\sum_{k=1}^{5} (2k + 1)` with the summand in the index variable `k`. */
export function sigmaTex(bodyN: string, lo: number, hi: number | 'inf', v = 'k'): string {
  const body = bodyN.replace(/n/g, v);
  const top = hi === 'inf' ? '\\infty' : String(hi);
  return `\\sum_{${v}=${lo}}^{${top}} ${hasTopLevelSum(body) || body.startsWith('-') ? `\\left(${body}\\right)` : body}`;
}

const D = (s: string) => `\\displaystyle ${s}`;

// ---------------------------------------------------------------- general series

function evalPattern(rng: Rng, d: Difficulty): Pattern {
  const nz = (lo: number, hi: number) => rng.intExcept(lo, hi, [0]);
  if (d === 'easy') {
    return rng.pick<() => Pattern>([
      () => pattern('lin', [rng.int(2, 6), nz(-5, 8)]),
      () => pattern('quad', [1, 0, rng.int(-3, 4)]),
      () => pattern('lin', [rng.signedInt(2, 9, true), rng.int(-10, 10)]),
      () => pattern('quad', [rng.int(2, 3), 0, 0]),
    ])();
  }
  if (d === 'medium') {
    return rng.pick<() => Pattern>([
      () => pattern('quad', [1, nz(-4, 4), rng.int(-5, 5)]),
      () => pattern('exps', [1, rng.pick([2, 3]), rng.int(-3, 3)]),
      () => pattern('alt', [rng.int(1, 4), 0, rng.int(0, 1)]),
      () => pattern('cube', [1, rng.int(-4, 4)]),
      () => pattern('geo', [rng.signedInt(1, 5, true), rng.pick([2, -2, 3])]),
    ])();
  }
  return rng.pick<() => Pattern>([
    () => pattern('rat', [1, 0, 1, rng.int(1, 3)]),
    () => pattern('rat', [0, rng.int(1, 6), 1, 0]),
    () => pattern('powFrac', [rng.int(1, 3), rng.pick([2, 3])]),
    () => pattern('alt', [rng.int(2, 4), rng.int(1, 4), rng.int(0, 1)]),
    () => pattern('quad', [rng.signedInt(2, 3, true), nz(-5, 5), rng.int(-6, 6)]),
    () => pattern('prod', [nz(-3, 4)]),
  ])();
}

const sumRange = (f: Fm, lo: number, hi: number) => {
  let acc = Frac.ZERO;
  for (let i = lo; i <= hi; i++) acc = acc.add(f.f(i));
  return acc;
};

export const generalSeries = defineTopic({
  id: 'alg2.seq.series',
  subject: 'algebra2',
  title: 'General Series',
  description: 'Evaluate sums written in sigma notation, and rewrite series in sigma notation.',
  category: 'Sequences and Series',
  instruction: (o) => (o.task === 'sigma' ? 'Rewrite each series using sigma notation.' : o.task === 'evaluate' ? 'Evaluate each series.' : 'Answer as indicated.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'evaluate', label: 'Evaluate sigma notation' },
        { value: 'sigma', label: 'Write in sigma notation' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'evaluate' || tOpt === 'sigma' ? tOpt : rng.pick(['evaluate', 'sigma'] as const);
    return attempt('general-series', () => {
      const pt = evalPattern(rng, d);
      const fm = pt.make(pt.p);
      if (!fm) return null;
      if (task === 'evaluate') {
        const lo = d === 'easy' ? 1 : rng.pick([0, 1, 1, 2, 3]);
        const len = d === 'easy' ? rng.int(3, 5) : rng.int(4, 6);
        const hi = lo + len - 1;
        let value: Frac;
        try {
          value = sumRange(fm, lo, hi);
        } catch {
          return null;
        }
        if (Math.abs(value.value) > 20000 || value.d > 1000) return null;
        const answer = m(num(value));
        const termsTex = Array.from({ length: len }, (_, i) => fm.f(lo + i));
        const wrongs = [sumRange(fm, lo, hi - 1), sumRange(fm, lo + 1, hi), fm.f(hi), sumRange(fm, lo, hi + 1)].map((w) => m(num(w)));
        return {
          question: `Evaluate ${m(D(sigmaTex(fm.tex, lo, hi)))}`,
          answer,
          steps: [m(seriesBody(termsTex)), answer],
          distractors: distinctDistractors(answer, wrongs, (k) => m(num(value.add(offset(k))))),
          check: { kind: CHECK, seq: 'question', asked: 'sum' },
        };
      }
      const len = rng.int(4, d === 'easy' ? 5 : 6);
      const vals = Array.from({ length: len }, (_, i) => fm.f(i + 1));
      if (vals.some((v) => Math.abs(v.value) > 5000)) return null;
      const answer = m(sigmaTex(fm.tex, 1, len));
      const wrongs = [m(sigmaTex(fm.tex, 1, len - 1)), m(sigmaTex(fm.tex, 0, len)), ...patternDistractors(pt, 2, vals).map((g) => m(sigmaTex(g.tex, 1, len)))];
      return {
        question: `Write ${m(seriesBody(vals))} in sigma notation.`,
        answer,
        steps: [m(`a_k = ${fm.tex.replace(/n/g, 'k')}`), m(`${len}\\text{ terms}`), answer],
        distractors: distinctDistractors(answer, wrongs, (k) => m(sigmaTex(fm.tex, 1, len + k))),
        check: { kind: CHECK, seq: 'question', asked: 'sigma' },
      };
    });
  },
});

// ---------------------------------------------------------------- arithmetic series

type ATask = 'sum' | 'sigma' | 'findN';

export const arithmeticSeries = defineTopic({
  id: 'alg2.seq.arith-series',
  subject: 'algebra2',
  title: 'Arithmetic Series',
  description: 'Sum the first n terms of an arithmetic series, evaluate sigma notation, and find the number of terms.',
  category: 'Sequences and Series',
  instruction: 'Each series is arithmetic. Answer as indicated.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'sum', label: 'Sum of n terms' },
        { value: 'sigma', label: 'Sigma notation' },
        { value: 'findN', label: 'Find the number of terms' },
      ],
    },
    opt.negatives(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const tOpt = strOpt(ctx, 'task');
    const task: ATask = tOpt === 'any' || !tOpt ? rng.pick<ATask>(d === 'easy' ? ['sum', 'sigma'] : ['sum', 'sigma', 'findN']) : (tOpt as ATask);
    const s: AG = pickAG(rng, 'arithmetic', d, negatives, false);
    const n = rng.int(d === 'easy' ? 6 : 8, d === 'easy' ? 15 : d === 'medium' ? 25 : 40);
    const an = agTerm(s, n);
    const S = agPartial(s, n);
    const formula = m(`S_{${n}} = \\frac{${n}\\left(${num(s.a1)} + ${parenNeg(an)}\\right)}{2} = ${num(S)}`);
    const wrongSums = [agPartial(s, n - 1), agPartial(s, n + 1), S.mul(2), an];

    if (task === 'findN') {
      // positive terms so that S_n determines n uniquely
      const t: AG = { ...s, a1: s.a1.abs(), k: s.k.abs() };
      const Sn = agPartial(t, n);
      const answer = m(`n = ${n}`);
      return {
        question: `${m(`a_1 = ${num(t.a1)}`)}, ${m(`d = ${num(t.k)}`)}, ${m(`S_n = ${num(Sn)}`)}. Find ${m('n')}.`,
        answer,
        steps: [m(`${num(Sn)} = \\frac{n}{2}\\left(2 \\cdot ${num(t.a1)} + (n - 1)${parenNeg(t.k)}\\right)`), answer],
        distractors: distinctDistractors(answer, [m(`n = ${n + 1}`), m(`n = ${n - 1}`), m(`n = ${2 * n}`)], (k) => m(`n = ${n + 1 + k}`)),
        check: { kind: CHECK, seq: 'arithmetic', a1: t.a1.value, k: t.k.value, asked: 'n' },
      };
    }
    if (task === 'sigma') {
      const v = rng.pick(['k', 'k', 'n', 'i']);
      const lo = d === 'hard' && rng.bool(0.4) ? rng.int(2, 5) : 1;
      const hi = lo + n - 1;
      // a_k written in terms of the index starting at lo
      const shifted: AG = { ...s, a1: s.a1.sub(s.k.mul(lo - 1)) };
      const value = agPartial(s, n);
      const answer = m(num(value));
      return {
        question: `Evaluate ${m(D(sigmaTex(agExplicit(shifted), lo, hi, v)))}`,
        answer,
        steps: [m(`a_{${lo}} = ${num(s.a1)}, \\; a_{${hi}} = ${num(an)}, \\; ${n}\\text{ terms}`), m(`\\frac{${n}\\left(${num(s.a1)} + ${parenNeg(an)}\\right)}{2} = ${num(value)}`)],
        distractors: distinctDistractors(answer, wrongSums.map((w) => m(num(w))), (k) => m(num(value.add(offset(k))))),
        check: { kind: CHECK, seq: 'question', asked: 'sum' },
      };
    }
    const withLast = d !== 'easy' && rng.bool(0.5);
    const shown = [1, 2, 3].map((i) => agTerm(s, i));
    const answer = m(num(S));
    return {
      question: withLast ? `Evaluate ${m(seriesTex(shown, an))}` : `Find ${m(`S_{${n}}`)} for ${m(seriesTex(shown))}`,
      answer,
      steps: withLast ? [m(`${num(an)} = ${num(s.a1)} + (n - 1)${parenNeg(s.k)} \\Rightarrow n = ${n}`), formula] : [m(`a_{${n}} = ${num(an)}`), formula],
      distractors: distinctDistractors(answer, wrongSums.map((w) => m(num(w))), (k) => m(num(S.add(offset(k))))),
      check: { kind: CHECK, seq: 'arithmetic', a1: s.a1.value, k: s.k.value, asked: 'sum' },
    };
  },
});

// ---------------------------------------------------------------- geometric series

type GTask = 'finite' | 'infinite';

export const geometricSeries = defineTopic({
  id: 'alg2.seq.geom-series',
  subject: 'algebra2',
  title: 'Geometric Series',
  description: 'Finite geometric sums, and infinite geometric series that converge (|r| < 1) or diverge.',
  category: 'Sequences and Series',
  instruction: (o) => (o.task === 'finite' ? 'Evaluate each geometric series.' : 'Evaluate each geometric series, or state that it diverges.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'finite', label: 'Finite sums' },
        { value: 'infinite', label: 'Infinite series' },
      ],
    },
    { type: 'boolean', id: 'sigma', label: 'Include sigma notation', default: true },
    { type: 'boolean', id: 'diverge', label: 'Include divergent infinite series', default: true, help: 'Medium and hard only.' },
    opt.negatives(true),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const negatives = boolOpt(ctx, 'negatives');
    const useSigma = boolOpt(ctx, 'sigma') && rng.bool(0.4);
    const tOpt = strOpt(ctx, 'task');
    const task: GTask = tOpt === 'finite' || tOpt === 'infinite' ? tOpt : rng.pick<GTask>(['finite', 'infinite']);
    const v = rng.pick(['k', 'k', 'n', 'i']);

    if (task === 'finite') {
      return attempt('geom-finite', () => {
        const s = pickAG(rng, 'geometric', d, negatives, d === 'hard');
        const n = rng.int(d === 'easy' ? 4 : 5, d === 'easy' ? 6 : 8);
        const S = agPartial(s, n);
        if (Math.abs(S.value) > 1e6 || Math.abs(s.k.value) === 1) return null;
        const answer = m(num(S));
        const kTex = baseTex(s.k);
        const steps = [m(`S_{${n}} = \\frac{${num(s.a1)}\\left(1 - ${kTex}^{${n}}\\right)}{1 - ${parenNeg(s.k)}} = ${num(S)}`)];
        const wrongs = [agPartial(s, n - 1), agPartial(s, n + 1), agTerm(s, n), agTerm(s, n + 1)].map((w) => m(num(w)));
        const question = useSigma ? `Evaluate ${m(D(sigmaTex(agExplicit(s), 1, n, v)))}` : `Find ${m(`S_{${n}}`)} for ${m(seriesTex([1, 2, 3].map((i) => agTerm(s, i))))}`;
        return {
          question,
          answer,
          steps,
          distractors: distinctDistractors(answer, wrongs, (k) => m(num(S.add(offset(k))))),
          check: { kind: CHECK, seq: useSigma ? 'question' : 'geometric', a1: s.a1.value, k: s.k.value, asked: 'sum' },
        };
      });
    }

    const diverge = boolOpt(ctx, 'diverge') && d !== 'easy' && rng.bool(0.3);
    return attempt('geom-infinite', () => {
      let r: Frac;
      if (diverge) r = new Frac(rng.pick(negatives ? [2, 3, -2, -3, 3, 5] : [2, 3, 5]), rng.pick([1, 1, 2]));
      else {
        const den = d === 'easy' ? rng.pick([2, 3, 4]) : rng.pick([2, 3, 4, 5]);
        const numer = d === 'easy' ? 1 : rng.int(1, den - 1);
        r = new Frac(numer * (negatives && d !== 'easy' && rng.bool(0.4) ? -1 : 1), den);
      }
      if (Math.abs(r.value) === 1 || r.isZero()) return null;
      if (diverge && Math.abs(r.value) < 1) return null;
      const a1 = new Frac(rng.signedInt(1, d === 'easy' ? 5 : 9, negatives && d !== 'easy') * r.d ** 3);
      const s: AG = { kind: 'geometric', a1, k: r };
      const terms = [1, 2, 3, 4].map((i) => agTerm(s, i));
      const question = useSigma ? `Evaluate ${m(D(sigmaTex(agExplicit(s), 1, 'inf', v)))}` : `Evaluate ${m(seriesTex(terms.slice(0, d === 'easy' ? 4 : 3)))}`;
      const formal = a1.div(Frac.ONE.sub(r));
      const steps = [m(`r = ${num(r)}`)];
      let answer: string;
      let wrongs: string[];
      if (diverge) {
        steps.push(`${m(`|r| = ${num(r.abs())} \\ge 1`)}, so the series diverges.`);
        answer = 'Diverges';
        wrongs = [m(num(formal)), m(num(a1.div(Frac.ONE.add(r)))), m(num(agPartial(s, 4)))];
      } else {
        steps.push(m(`S = \\frac{a_1}{1 - r} = \\frac{${num(a1)}}{1 - ${parenNeg(r)}} = ${num(formal)}`));
        answer = m(num(formal));
        wrongs = [m(num(a1.div(Frac.ONE.add(r)))), 'Diverges', m(num(agPartial(s, 4))), m(num(a1.div(r)))];
      }
      return {
        question,
        answer,
        steps,
        distractors: distinctDistractors(answer, wrongs, (k) => m(num(formal.add(offset(k))))),
        check: { kind: CHECK, seq: useSigma ? 'question' : 'geometric', a1: a1.value, k: r.value, asked: 'infinite' },
      };
    });
  },
});
