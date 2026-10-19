/** Ratios, unit rates and proportions. */
import { Frac, gcd } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { linear, m, num } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT, Dec, pickName } from './common';

// ---------------------------------------------------------------- ratios and unit rates

const RATIO_CONTEXTS: Array<{ a: string; b: string; all: string; lead: string }> = [
  { a: 'red marbles', b: 'blue marbles', all: 'marbles', lead: 'A bag holds' },
  { a: 'cats', b: 'dogs', all: 'animals', lead: 'An animal shelter has' },
  { a: 'fiction books', b: 'nonfiction books', all: 'books', lead: 'A shelf holds' },
  { a: 'wins', b: 'losses', all: 'games', lead: 'A soccer team has' },
  { a: 'sixth graders', b: 'seventh graders', all: 'students', lead: 'The chess club has' },
  { a: 'apples', b: 'oranges', all: 'pieces of fruit', lead: 'A basket holds' },
  { a: 'cars', b: 'trucks', all: 'vehicles', lead: 'A parking lot has' },
  { a: 'tulips', b: 'roses', all: 'flowers', lead: 'A garden has' },
  { a: 'pencils', b: 'pens', all: 'writing tools', lead: 'A desk drawer holds' },
];

interface RateContext {
  text: (name: string, total: string, count: string) => string;
  unit: string;
  money: boolean;
}

const RATE_CONTEXTS: RateContext[] = [
  { text: (n, t, c) => `${n} drives ${t} miles in ${c} hours.`, unit: 'miles per hour', money: false },
  { text: (n, t, c) => `${n} types ${t} words in ${c} minutes.`, unit: 'words per minute', money: false },
  { text: (_n, t, c) => `A pump moves ${t} gallons of water in ${c} minutes.`, unit: 'gallons per minute', money: false },
  { text: (n, t, c) => `${n} reads ${t} pages in ${c} days.`, unit: 'pages per day', money: false },
  { text: (_n, t, c) => `A printer prints ${t} pages in ${c} minutes.`, unit: 'pages per minute', money: false },
  { text: (_n, t, c) => `A recipe uses ${t} cups of flour for ${c} batches of bread.`, unit: 'cups per batch', money: false },
  { text: (n, t, c) => `${n} earns ${t} for ${c} hours of work.`, unit: 'per hour', money: true },
  { text: (_n, t, c) => `${c} pounds of apples cost ${t}.`, unit: 'per pound', money: true },
  { text: (_n, t, c) => `A pack of ${c} batteries costs ${t}.`, unit: 'per battery', money: true },
  { text: (_n, t, c) => `${c} tickets to a show cost ${t}.`, unit: 'per ticket', money: true },
];

function ratioProblem(rng: Rng, d: Difficulty): ProblemContent {
  const ctx = rng.pick(RATIO_CONTEXTS);
  const p = attempt('ratio', () => {
    const g = rng.int(2, d === 'easy' ? 6 : 12);
    const x = rng.int(1, d === 'easy' ? 5 : 9);
    const y = rng.int(1, d === 'easy' ? 5 : 9);
    if (x === y || gcd(x, y) !== 1) return null;
    return { A: g * x, B: g * y };
  });
  const { A, B } = p;
  const kind = d === 'hard' ? rng.pick(['ab', 'ba', 'a-all', 'b-all'] as const) : rng.pick(['ab', 'ba'] as const);
  const [first, second, x, y] =
    kind === 'ab'
      ? [ctx.a, ctx.b, A, B]
      : kind === 'ba'
        ? [ctx.b, ctx.a, B, A]
        : kind === 'a-all'
          ? [ctx.a, `the total number of ${ctx.all}`, A, A + B]
          : [ctx.b, `the total number of ${ctx.all}`, B, A + B];
  const g = gcd(x, y);
  const ratio = (u: number, v: number) => m(`${u} : ${v}`);
  const answer = ratio(x / g, y / g);
  const half = [2, 3, 5].find((q) => g % q === 0 && q !== g);
  const distractors = distinctDistractors(
    answer,
    [ratio(x, y), ratio(y / g, x / g), half ? ratio(x / half, y / half) : null, ratio(x / g, (x + y) / g)],
    (k) => ratio(x / g + k, y / g),
  );
  return {
    question: `${ctx.lead} $${A}$ ${ctx.a} and $${B}$ ${ctx.b}. Write the ratio of ${first} to ${second} in simplest form.`,
    answer,
    steps: [`The ratio is $${x} : ${y}$.`, `Divide both terms by the GCF, $${g}$: $${x / g} : ${y / g}$`],
    distractors,
    check: { kind: 'prealgebra.ratio' },
  };
}

function rateProblem(rng: Rng, d: Difficulty): ProblemContent {
  const ctx = rng.pick(RATE_CONTEXTS);
  const p = attempt('unit-rate', () => {
    const count = rng.int(d === 'easy' ? 2 : 3, d === 'easy' ? 6 : d === 'medium' ? 12 : 16);
    // rate in hundredths
    let rate: number;
    if (ctx.money) rate = d === 'easy' ? rng.int(2, 15) * 100 : d === 'medium' ? rng.int(4, 60) * 25 : rng.int(50, 2500);
    else rate = d === 'easy' ? rng.int(2, 60) * 100 : d === 'medium' ? rng.int(10, 120) * 50 : rng.int(10, 300) * 25;
    if (rate % 100 === 0 && d === 'hard') return null;
    return { count, rate, total: rate * count };
  });
  const { count, rate, total } = p;
  const show = (hundredths: number) => new Dec(hundredths, 2).toTex(ctx.money ? 2 : 0);
  const disp = (h: number) => (ctx.money ? `\\$${m(show(h))}` : m(show(h)));
  const name = pickName(rng);
  const question = `${ctx.text(name, disp(total), m(String(count)))} Find the unit rate.`;
  const answer = `${disp(rate)} ${ctx.unit}`;
  const distractors = distinctDistractors(
    answer,
    [`${disp(total - count * 100)} ${ctx.unit}`, `${disp(rate + 1000)} ${ctx.unit}`, `${disp(rate * 2)} ${ctx.unit}`, `${disp(Math.round(rate / 2))} ${ctx.unit}`],
    (k) => `${disp(rate + offset(k) * 100)} ${ctx.unit}`,
  );
  return {
    question: question.charAt(0).toUpperCase() + question.slice(1),
    answer,
    steps: [`Divide by $${count}$: $${show(total)} \\div ${count} = ${show(rate)}$`],
    distractors,
    check: { kind: 'prealgebra.unitRate' },
  };
}

export const ratiosRates = defineTopic({
  id: 'prealg.ratios-rates',
  subject: 'prealgebra',
  category: CAT.ratios,
  title: 'Ratios and Unit Rates',
  description: 'Write ratios in simplest form and find unit rates from word problems.',
  instruction: 'Solve each problem.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Ratios and unit rates' },
        { value: 'ratio', label: 'Ratios in simplest form' },
        { value: 'rate', label: 'Unit rates' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const t = strOpt(ctx, 'task');
    const task = t === 'mixed' ? ctx.rng.pick(['ratio', 'rate']) : t;
    return task === 'ratio' ? ratioProblem(ctx.rng, ctx.difficulty) : rateProblem(ctx.rng, ctx.difficulty);
  },
});

// ---------------------------------------------------------------- proportions

type PForm = 'x/a=b/c' | 'a/x=b/c' | 'a/b=x/c' | 'a/b=c/x' | '(x+k)/a=b/c' | 'a/b=(x-k)/c' | 'a/(x+k)=b/c';

const P_FORMS: Record<Difficulty, PForm[]> = {
  easy: ['x/a=b/c', 'a/b=x/c'],
  medium: ['x/a=b/c', 'a/x=b/c', 'a/b=x/c', 'a/b=c/x'],
  hard: ['(x+k)/a=b/c', 'a/b=(x-k)/c', 'a/(x+k)=b/c', 'a/x=b/c'],
};

const WORD: Array<{ text: (n: string, a: string, b: string, c: string) => string; unit: string; money: boolean }> = [
  { text: (_n, a, b, c) => `On a map, ${a} cm represents ${b} km. How many kilometers do ${c} cm represent?`, unit: 'km', money: false },
  { text: (n, a, b, c) => `${n} buys ${a} notebooks for ${b}. At that price, how much would ${c} notebooks cost?`, unit: '', money: true },
  { text: (_n, a, b, c) => `A car uses ${a} gallons of gas to travel ${b} miles. How far can it travel on ${c} gallons?`, unit: 'miles', money: false },
  { text: (_n, a, b, c) => `A recipe uses ${a} cups of oats to make ${b} cookies. How many cookies can be made with ${c} cups of oats?`, unit: 'cookies', money: false },
  { text: (n, a, b, c) => `In ${a} minutes, ${n} can type ${b} words. How many words can ${n} type in ${c} minutes?`, unit: 'words', money: false },
  { text: (_n, a, b, c) => `${a} tickets to a museum cost ${b}. How much do ${c} tickets cost?`, unit: '', money: true },
  { text: (_n, a, b, c) => `A machine fills ${a} bottles every ${b} seconds. How many seconds does it take to fill ${c} bottles?`, unit: 'seconds', money: false },
  { text: (_n, a, b, c) => `${a} gallons of paint cover ${b} square feet. How many square feet will ${c} gallons cover?`, unit: 'square feet', money: false },
];

function proportionWord(rng: Rng, d: Difficulty): ProblemContent {
  const w = rng.pick(WORD);
  const p = attempt('proportion-word', () => {
    const a = rng.int(2, d === 'easy' ? 5 : 9);
    const c = rng.int(2, d === 'easy' ? 12 : 25);
    if (c === a) return null;
    // per-unit amount in hundredths
    const unit = w.money ? rng.int(d === 'easy' ? 2 : 1, 12) * (d === 'easy' ? 100 : 25) : d === 'easy' ? rng.int(2, 20) * 100 : rng.int(3, 60) * 50;
    return { a, c, b: a * unit, x: c * unit };
  });
  const show = (h: number) => new Dec(h, 2).toTex(w.money ? 2 : 0);
  const disp = (h: number) => (w.money ? `\\$${m(show(h))}` : m(show(h)));
  const unitText = w.unit ? ` ${w.unit}` : '';
  const ans = (h: number) => `${disp(h)}${unitText}`;
  const name = pickName(rng);
  const question = w.text(name, m(String(p.a)), disp(p.b), m(String(p.c)));
  const wrongInverse = Math.round((p.a * p.b) / p.c);
  return {
    question: question.charAt(0).toUpperCase() + question.slice(1),
    answer: ans(p.x),
    steps: [`Set up a proportion: $\\frac{${p.a}}{${show(p.b)}} = \\frac{${p.c}}{x}$`, `Cross multiply: $${p.a}x = ${show(p.b)} \\cdot ${p.c}$`, `$x = ${show(p.x)}$`],
    distractors: distinctDistractors(ans(p.x), [ans(wrongInverse), ans(p.b + (p.c - p.a) * 100), ans(p.b * p.c)], (k) => ans(p.x + offset(k) * 100)),
    check: { kind: 'prealgebra.proportionWord' },
  };
}

export const proportions = defineTopic({
  id: 'prealg.proportions',
  subject: 'prealgebra',
  category: CAT.ratios,
  title: 'Solving Proportions',
  description: 'Solve proportions by cross multiplying, with optional proportion word problems.',
  instruction: (o) => (o.word ? 'Solve each problem using a proportion.' : 'Solve each proportion.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [{ type: 'boolean', id: 'word', label: 'Word problems', default: false }, opt.fractionAnswers(false), opt.variedVariables(true)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    if (boolOpt(ctx, 'word')) return proportionWord(rng, difficulty);
    const fractions = boolOpt(ctx, 'fractions');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const form = rng.pick(P_FORMS[difficulty]);
    const p = attempt('proportion', () => {
      // a/b = c/d with one of the four replaced by the unknown (shifted by k in the hard forms)
      const P = rng.int(1, difficulty === 'easy' ? 6 : 9);
      const Q = rng.int(2, difficulty === 'easy' ? 6 : 9);
      if (P === Q) return null;
      const s = rng.int(1, difficulty === 'easy' ? 4 : 6);
      const t = rng.int(1, difficulty === 'easy' ? 6 : 9);
      if (s === t) return null;
      // fractional answers: four independent known values; otherwise two equal ratios P/Q
      const r = () => rng.int(2, difficulty === 'easy' ? 9 : 12);
      const a = fractions ? r() : P * s;
      const b = fractions ? r() : Q * s;
      const c = fractions ? r() : P * t;
      const dd = fractions ? r() : Q * t;
      const k = rng.int(1, 9);
      let x: Frac;
      let wrong: Frac;
      let lhs: string;
      let rhs: string;
      const fr = (n: string | number, d: string | number) => `\\frac{${n}}{${d}}`;
      switch (form) {
        case 'x/a=b/c': // x/b = c/d → x = b c / d
          x = new Frac(b * c, dd);
          wrong = new Frac(b * dd, c);
          lhs = fr(v, b);
          rhs = fr(c, dd);
          break;
        case 'a/x=b/c': // a/x = c/d → x = a d / c
          x = new Frac(a * dd, c);
          wrong = new Frac(a * c, dd);
          lhs = fr(a, v);
          rhs = fr(c, dd);
          break;
        case 'a/b=x/c':
          x = new Frac(a * dd, b);
          wrong = new Frac(b * dd, a);
          lhs = fr(a, b);
          rhs = fr(v, dd);
          break;
        case 'a/b=c/x':
          x = new Frac(b * c, a);
          wrong = new Frac(a * c, b);
          lhs = fr(a, b);
          rhs = fr(c, v);
          break;
        case '(x+k)/a=b/c': {
          const y = new Frac(b * c, dd);
          x = y.sub(k);
          wrong = new Frac(b * dd, c).sub(k);
          lhs = fr(linear(1, k, v), b);
          rhs = fr(c, dd);
          break;
        }
        case 'a/b=(x-k)/c': {
          const y = new Frac(a * dd, b);
          x = y.add(k);
          wrong = new Frac(b * dd, a).add(k);
          lhs = fr(a, b);
          rhs = fr(linear(1, -k, v), dd);
          break;
        }
        case 'a/(x+k)=b/c': {
          const y = new Frac(a * dd, c);
          x = y.sub(k);
          wrong = new Frac(a * c, dd).sub(k);
          lhs = fr(a, linear(1, k, v));
          rhs = fr(c, dd);
          break;
        }
      }
      if (fractions ? x.isInt() : !x.isInt()) return null;
      if (x.isZero() || Math.abs(x.value) > 150) return null;
      if (fractions && x.d > 12) return null;
      return { x, lhs, rhs, wrong };
    });
    const { x, lhs, rhs, wrong } = p;
    const answer = m(`${v} = ${num(x)}`);
    const parts = (f: string) => /^\\frac\{([^{}]*)\}\{([^{}]*)\}$/.exec(f)!.slice(1).map((t) => (t.includes(' ') ? `(${t})` : t));
    const [ln, ld] = parts(lhs);
    const [rn, rd] = parts(rhs);
    const steps = [`Cross multiply: $${ln} \\cdot ${rd} = ${ld} \\cdot ${rn}$`, `Solve: $${v} = ${num(x)}$`];
    const distractors = distinctDistractors(
      answer,
      [m(`${v} = ${num(wrong)}`), m(`${v} = ${num(x.mul(2))}`), m(`${v} = ${num(x.neg())}`)],
      (k) => m(`${v} = ${num(x.add(offset(k)))}`),
    );
    return { question: m(`${lhs} = ${rhs}`), answer, steps, distractors, check: { kind: 'linear', variable: v, solution: x.value } };
  },
});
