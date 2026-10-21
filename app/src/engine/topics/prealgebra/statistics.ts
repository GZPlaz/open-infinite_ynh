/** Mean, median, mode and range of a data set. */
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { m } from '../../tex';
import type { ProblemContent } from '../../types';
import { CAT, roundDec } from './common';

interface Stats {
  mean: number;
  median: number;
  modes: number[];
  range: number;
}

function stats(xs: number[]): Stats {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const median = n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2;
  const counts = new Map<number, number>();
  for (const x of s) counts.set(x, (counts.get(x) ?? 0) + 1);
  const top = Math.max(...counts.values());
  const modes = top === 1 ? [] : [...counts].filter(([, c]) => c === top).map(([x]) => x);
  return { mean: s.reduce((a, b) => a + b, 0) / n, median, modes, range: s[n - 1]! - s[0]! };
}

type Stat = 'mean' | 'median' | 'mode' | 'range';

function part(stat: Stat, st: Stats): string {
  switch (stat) {
    case 'mean': {
      const r = roundDec(st.mean, 1);
      return m(`\\text{mean} ${Math.abs(r.value - st.mean) < 1e-9 ? '=' : '\\approx'} ${r.toTex()}`);
    }
    case 'median':
      return m(`\\text{median} = ${roundDec(st.median, 1).toTex()}`);
    case 'mode':
      return st.modes.length === 0 ? 'no mode' : m(`\\text{mode${st.modes.length > 1 ? 's' : ''}} = ${st.modes.join(', ')}`);
    default:
      return m(`\\text{range} = ${st.range}`);
  }
}

export const meanMedianMode = defineTopic({
  id: 'prealg.mean-median-mode',
  subject: 'prealgebra',
  category: CAT.statistics,
  title: 'Mean, Median, Mode and Range',
  description: 'Find the measures of center and the range of small data sets.',
  instruction: (o) =>
    o.find === 'all'
      ? 'Find the mean, median, mode and range of each data set. Round to the nearest tenth if necessary.'
      : o.find === 'mean'
        ? 'Find the mean of each data set. Round to the nearest tenth if necessary.'
        : `Find the ${o.find} of each data set.`,
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'find',
      label: 'Find',
      default: 'all',
      choices: [
        { value: 'all', label: 'Mean, median, mode and range' },
        { value: 'mean', label: 'Mean' },
        { value: 'median', label: 'Median' },
        { value: 'mode', label: 'Mode' },
        { value: 'range', label: 'Range' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const find = strOpt(ctx, 'find');
    const which: Stat[] = find === 'all' ? ['mean', 'median', 'mode', 'range'] : [find as Stat];
    const cfg = { easy: { n: [5, 7], lo: 1, hi: 20 }, medium: { n: [6, 9], lo: 1, hi: 50 }, hard: { n: [8, 12], lo: 10, hi: 99 } }[difficulty];
    const xs = attempt('statistics', () => {
      const n = rng.int(cfg.n[0]!, cfg.n[1]!);
      const xs = Array.from({ length: n }, () => rng.int(cfg.lo, cfg.hi));
      // repeat a value most of the time so there is a mode
      if (rng.bool(0.75)) xs[rng.int(0, n - 1)] = xs[rng.int(0, n - 1)]!;
      if (difficulty === 'hard' && rng.bool(0.3)) xs[rng.int(0, n - 1)] = xs[rng.int(0, n - 1)]!;
      const st = stats(xs);
      if (difficulty === 'easy' && !Number.isInteger(st.mean)) return null;
      if (st.modes.length > 2) return null;
      return xs;
    });
    const st = stats(xs);
    const answer = which.map((w) => part(w, st)).join(', ');
    // slips: median of the unsorted list, range = largest value, mean divided by n − 1, mean ↔ median
    const n = xs.length;
    const unsortedMedian = n % 2 ? xs[(n - 1) / 2]! : (xs[n / 2 - 1]! + xs[n / 2]!) / 2;
    const slips: Array<Partial<Stats>> = [
      { median: unsortedMedian },
      { range: Math.max(...xs) },
      { mean: (st.mean * n) / (n - 1) },
      { mean: st.median, median: st.mean },
      { modes: [roundDec(st.median, 0).value] },
      { modes: st.modes.length ? [] : [xs[0]!] },
      { range: Math.max(...xs) + Math.min(...xs) },
    ];
    const relevant = slips.filter((s) => which.some((w) => (w === 'mode' ? 'modes' : w) in s));
    const distractors = distinctDistractors(
      answer,
      relevant.map((s) => which.map((w) => part(w, { ...st, ...s })).join(', ')),
      (k) => which.map((w) => part(w, w === 'mode' ? { ...st, modes: [...st.modes, st.range + k].slice(-1) } : w === 'mean' ? { ...st, mean: st.mean + offset(k) } : w === 'median' ? { ...st, median: st.median + offset(k) } : { ...st, range: st.range + offset(k) })).join(', '),
    );
    const sorted = [...xs].sort((a, b) => a - b);
    const steps = [
      `In order: $${sorted.join(', ')}$`,
      ...(which.includes('mean') ? [`Mean: $\\frac{${xs.reduce((a, b) => a + b, 0)}}{${n}} ${Number.isInteger(st.mean * 10) ? '=' : '\\approx'} ${roundDec(st.mean, 1).toTex()}$`] : []),
      ...(which.includes('median') ? [n % 2 ? `Median: the middle value, $${st.median}$` : `Median: $\\frac{${sorted[n / 2 - 1]} + ${sorted[n / 2]}}{2} = ${roundDec(st.median, 1).toTex()}$`] : []),
      ...(which.includes('mode') ? [st.modes.length ? `Mode: most frequent, $${st.modes.join(', ')}$` : 'Every value appears once: no mode'] : []),
      ...(which.includes('range') ? [`Range: $${sorted[n - 1]} - ${sorted[0]} = ${st.range}$`] : []),
    ];
    return { question: m(xs.join(', ')), answer, steps, distractors, check: { kind: 'prealgebra.stats', find: which } };
  },
});
