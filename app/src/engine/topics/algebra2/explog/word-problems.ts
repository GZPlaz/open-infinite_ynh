/** Exponential growth and decay word problems: discrete (compounding, percent change, half-life) and continuous. */
import { defineTopic, distinctDistractors, offset } from '../../../generator';
import type { Rng } from '../../../rng';
import { decimal, m, roundTo } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, NAMES, grouped } from './common';

type Unknown = 'A' | 't' | 'r' | 'P';
type Fmt = 'money' | 'count' | 'mass' | 'years' | 'hours' | 'days' | 'minutes' | 'percent';

const PLACES: Record<Fmt, number> = { money: 2, count: 0, mass: 1, years: 1, hours: 1, days: 1, minutes: 1, percent: 1 };

/** Displayed answer for a value in a given format. */
function show(v: number, f: Fmt, noun = ''): string {
  switch (f) {
    case 'money':
      return `\\$${m(grouped(v, 2, true))}`;
    case 'count':
      return `${m(`\\approx ${grouped(v, 0)}`)}${noun ? ` ${noun}` : ''}`;
    case 'mass':
      return `${m(`\\approx ${grouped(v, 1)}`)} mg`;
    case 'percent':
      return m(`\\approx ${decimal(v * 100, 1)}\\%`);
    default:
      return `${m(`\\approx ${decimal(v, 1)}`)} ${f}`;
  }
}

const money = (v: number) => `\\$${grouped(v, v % 1 === 0 ? 0 : 2, v % 1 !== 0, false)}`;
const count = (v: number) => grouped(v, 0, false, false);
const pct = (r: number) => `${decimal(r * 100, 2)}%`;

interface Built {
  question: string;
  answer: string;
  steps: string[];
  wrong: number[];
  fmt: Fmt;
  noun?: string;
  check: Record<string, unknown>;
}

const COMPOUND: Array<[number, string]> = [
  [1, 'annually'],
  [2, 'semiannually'],
  [4, 'quarterly'],
  [12, 'monthly'],
  [365, 'daily'],
];
const TOWNS = ['Maple Grove', 'Riverton', 'Cedar Falls', 'Port Ellis', 'Lakeview', 'Brookhaven', 'Sun Valley', 'Fairmont'];
const ITEMS = ['car', 'delivery van', 'laptop', 'tractor', 'boat', 'printer', 'motorcycle'];
const SUBSTANCES: Array<[string, string]> = [
  ['Iodine-131', 'days'],
  ['A radioactive isotope', 'years'],
  ['A medication in the bloodstream', 'hours'],
  ['Carbon-11', 'minutes'],
  ['A lab sample of radon-222', 'days'],
];

// ------------------------------------------------------------ discrete

function discrete(rng: Rng, d: Difficulty): Built {
  const who = rng.pick(NAMES);
  const ctxKind = rng.pick(d === 'easy' ? ['interest', 'population', 'depreciation', 'doubling'] : ['interest', 'population', 'depreciation', 'halflife', 'doubling']);
  const unknown: Unknown = d === 'easy' ? 'A' : d === 'medium' ? rng.pick(['A', 'A', 't']) : rng.pick(['t', 'P', 'r', 'A']);
  const roundNote = (u: string) => ` Round to the nearest tenth of ${u === 'minutes' ? 'a minute' : `a${u === 'hours' ? 'n' : ''} ${u.replace(/s$/, '')}`}.`;
  if (ctxKind === 'interest') {
    const P = rng.int(10, 200) * 50;
    const r = rng.int(6, 36) / 400;
    const [n, nName] = d === 'easy' ? COMPOUND[0]! : rng.pick(COMPOUND);
    const t = rng.int(3, 25);
    const g = 1 + r / n;
    const A = P * g ** (n * t);
    const formula = `A = P\\left(1 + \\frac{r}{n}\\right)^{nt}`;
    const sub = (a: string, p: string, tt: string) => `${a} = ${p}\\left(1 + \\frac{${decimal(r, 4)}}{${n}}\\right)^{${n}${tt === 't' ? 't' : ` \\cdot ${tt}`}}`;
    if (unknown === 'A' || unknown === 'r') {
      return {
        question: `${who} invests ${money(P)} in an account that pays ${pct(r)} interest compounded ${nName}. How much is in the account after ${t} years?`,
        answer: show(A, 'money'),
        steps: [m(formula), m(sub('A', String(P), String(t))), m(`A \\approx ${grouped(A, 2, true)}`)],
        wrong: [P * (1 + r * t), P * g ** t, P * (1 + r) ** t, P * g ** (n * (t - 1))],
        fmt: 'money',
        check: { model: 'discrete', P, g, period: 1 / n, t, unknown: 'A', given: [money(P), pct(r)] },
      };
    }
    if (unknown === 't') {
      const target = roundTo(P * rng.int(13, 30) / 10, -2);
      const tt = (Math.log(target / P) / Math.log(g)) / n;
      return {
        question: `${who} invests ${money(P)} at ${pct(r)} interest compounded ${nName}. How long will it take for the account to reach ${money(target)}?${roundNote('years')}`,
        answer: show(tt, 'years'),
        steps: [m(sub(String(target), String(P), 't')), m(`\\left(1 + \\frac{${decimal(r, 4)}}{${n}}\\right)^{${n}t} = \\frac{${target}}{${P}}`), m(`t = \\frac{\\ln \\frac{${target}}{${P}}}{${n}\\ln\\left(1 + \\frac{${decimal(r, 4)}}{${n}}\\right)} \\approx ${decimal(tt, 1)}`)],
        wrong: [(target / P - 1) / r, Math.log(target / P) / Math.log(g), Math.log(target / P) / r, tt + 1],
        fmt: 'years',
        check: { model: 'discrete', P, g, period: 1 / n, A: target, unknown: 't', given: [money(P), money(target), pct(r)] },
      };
    }
    const goal = rng.int(20, 300) * 100;
    const PV = goal / g ** (n * t);
    return {
      question: `How much must ${who} invest now at ${pct(r)} interest compounded ${nName} to have ${money(goal)} after ${t} years?`,
      answer: show(PV, 'money'),
      steps: [m(sub(String(goal), 'P', String(t))), m(`P = \\frac{${goal}}{\\left(1 + \\frac{${decimal(r, 4)}}{${n}}\\right)^{${n * t}}} \\approx ${grouped(PV, 2, true)}`)],
      wrong: [goal / (1 + r * t), goal / g ** t, goal * (1 - r) ** t, goal / (1 + r) ** (t + 1)],
      fmt: 'money',
      check: { model: 'discrete', g, period: 1 / n, t, A: goal, unknown: 'P', given: [money(goal), pct(r)] },
    };
  }
  if (ctxKind === 'population' || ctxKind === 'depreciation') {
    const pop = ctxKind === 'population';
    const town = rng.pick(TOWNS);
    const item = rng.pick(ITEMS);
    const P = pop ? rng.int(30, 900) * 100 : rng.int(8, 90) * 500;
    const r = pop ? rng.int(4, 60) / 1000 : rng.int(6, 25) / 100;
    const g = pop ? 1 + r : 1 - r;
    const t = rng.int(3, pop ? 25 : 10);
    const A = P * g ** t;
    const fmt: Fmt = pop ? 'count' : 'money';
    const opening = pop
      ? `The population of ${town} is ${count(P)} and grows by ${pct(r)} each year.`
      : `${who} buys a ${item} for ${money(P)}. Its value decreases by ${pct(r)} each year.`;
    const gT = decimal(g, 4);
    if (unknown === 'A' || (unknown === 'P' && pop)) {
      return {
        question: `${opening} ${pop ? `What will the population be in ${t} years?` : `What is the ${item} worth after ${t} years?`}`,
        answer: show(A, fmt, pop ? 'people' : ''),
        steps: [m(`A = P(1 ${pop ? '+' : '-'} r)^{t}`), m(`A = ${P}(${gT})^{${t}}`), m(`A \\approx ${grouped(A, PLACES[fmt], !pop)}`)],
        wrong: [P * (1 + (g - 1) * t), P * g ** (t - 1), P * (2 - g) ** t, P * g ** (t + 1)],
        fmt,
        noun: pop ? 'people' : '',
        check: { model: 'discrete', P, g, period: 1, t, unknown: 'A', given: [pop ? count(P) : money(P), pct(r)] },
      };
    }
    if (unknown === 'r' && pop) {
      const P1 = roundTo(A, -2);
      const rate = (P1 / P) ** (1 / t) - 1;
      if (rate <= 0) return discrete(rng, d);
      return {
        question: `The population of ${town} grew from ${count(P)} to ${count(P1)} in ${t} years. Assuming it grew by the same percent each year, find the annual growth rate. Round to the nearest tenth of a percent.`,
        answer: show(rate, 'percent'),
        steps: [m(`${P1} = ${P}(1 + r)^{${t}}`), m(`1 + r = \\left(\\frac{${P1}}{${P}}\\right)^{\\frac{1}{${t}}}`), m(`r \\approx ${decimal(rate, 4)} \\approx ${decimal(rate * 100, 1)}\\%`)],
        wrong: [(P1 / P - 1) / t, (P1 / P) ** (1 / t) - 1 + 0.01, Math.log(P1 / P) / t / 2.302585, (P1 - P) / P],
        fmt: 'percent',
        check: { model: 'discrete', P, A: P1, t, period: 1, unknown: 'r', given: [count(P), count(P1)] },
      };
    }
    const target = pop ? roundTo(P * rng.int(13, 30) / 10, -2) : roundTo(P * rng.int(15, 60) / 100, -2);
    const tt = Math.log(target / P) / Math.log(g);
    return {
      question: `${opening} ${pop ? `How long until the population reaches ${count(target)}?` : `After how long will the ${item} be worth ${money(target)}?`}${roundNote('years')}`,
      answer: show(tt, 'years'),
      steps: [m(`${target} = ${P}(${gT})^{t}`), m(`t = \\frac{\\ln \\frac{${target}}{${P}}}{\\ln ${gT}} \\approx ${decimal(tt, 1)}`)],
      wrong: [Math.abs((target / P - 1) / (g - 1)), Math.abs(Math.log(target / P) / (g - 1)), tt + 1, tt / 2],
      fmt: 'years',
      check: { model: 'discrete', P, g, period: 1, A: target, unknown: 't', given: [pop ? count(P) : money(P), pct(r)] },
    };
  }
  const half = ctxKind === 'halflife';
  const [subst, unit] = half ? rng.pick(SUBSTANCES) : ['', 'hours'];
  const P = half ? rng.int(4, 80) * 10 : rng.int(2, 60) * 50;
  const period = half ? rng.int(2, 30) : rng.int(2, 8);
  const g = half ? 0.5 : 2;
  const fmt: Fmt = half ? 'mass' : 'count';
  const opening = half
    ? `${subst} has a half-life of ${period} ${unit}. A sample contains ${P} mg.`
    : `A culture starts with ${count(P)} bacteria and doubles every ${period} hours.`;
  const word = half ? '\\frac{1}{2}' : '2';
  if (unknown === 'A' || unknown === 'P' || unknown === 'r') {
    const t = d === 'easy' ? period * rng.int(2, 5) : rng.int(period + 1, period * 6);
    const A = P * g ** (t / period);
    return {
      question: `${opening} ${half ? `How much remains after ${t} ${unit}?` : `How many bacteria are there after ${t} hours?`}`,
      answer: show(A, fmt, half ? '' : 'bacteria'),
      steps: [m(`A = A_0 \\left(${word}\\right)^{\\frac{t}{${half ? 'h' : 'd'}}}`), m(`A = ${P}\\left(${word}\\right)^{\\frac{${t}}{${period}}}`), m(`A \\approx ${grouped(A, PLACES[fmt])}`)],
      wrong: half ? [P * 0.5 ** (period / t) , P / (2 * (t / period)), P * 0.5 ** (t / period + 1), P * (1 - t / period / 10)] : [P * 2 * (t / period), P * 2 ** (t / period + 1), P * 2 ** (period / t) * 3, P * 3 ** (t / period)],
      fmt,
      noun: half ? '' : 'bacteria',
      check: { model: 'discrete', P, g, period, t, unknown: 'A', given: [half ? `${P} mg` : count(P), String(period)] },
    };
  }
  const target = half ? roundTo(P / rng.int(3, 20), 1) : P * rng.int(5, 60);
  const tt = (period * Math.log(target / P)) / Math.log(g);
  return {
    question: `${opening} ${half ? `How long until only ${grouped(target, 1, false, false)} mg remain?` : `How long until there are ${count(target)} bacteria?`}${roundNote(unit)}`,
    answer: show(tt, unit as Fmt),
    steps: [m(`${target} = ${P}\\left(${word}\\right)^{\\frac{t}{${period}}}`), m(`t = \\frac{${period}\\ln \\frac{${target}}{${P}}}{\\ln ${word}} \\approx ${decimal(tt, 1)}`)],
    wrong: [half ? (P / target / 2) * period : (target / P / 2) * period, Math.abs(Math.log(target / P) / Math.log(g)), tt + period, tt / 2],
    fmt: unit as Fmt,
    check: { model: 'discrete', P, g, period, A: target, unknown: 't', given: [half ? `${P} mg` : count(P), String(period)] },
  };
}

// ------------------------------------------------------------ continuous

function continuous(rng: Rng, d: Difficulty): Built {
  const who = rng.pick(NAMES);
  const kind = rng.pick(['interest', 'population', 'decay', 'bacteria', 'drug']);
  const unknown: Unknown = d === 'easy' ? 'A' : d === 'medium' ? rng.pick(['A', 't']) : rng.pick(['t', 'r', 'P', 't']);
  const decay = kind === 'decay' || kind === 'drug';
  const P = kind === 'interest' ? rng.int(10, 200) * 50 : kind === 'population' ? rng.int(30, 900) * 100 : kind === 'bacteria' ? rng.int(2, 60) * 50 : rng.int(5, 80) * 10;
  const k = kind === 'interest' ? rng.int(8, 32) / 400 : kind === 'population' ? rng.int(5, 45) / 1000 : kind === 'bacteria' ? rng.int(5, 40) / 100 : rng.int(3, 25) / 100;
  const r = decay ? -k : k;
  const unit = kind === 'bacteria' || kind === 'drug' ? 'hours' : kind === 'decay' ? 'days' : 'years';
  const t = rng.int(2, kind === 'bacteria' || kind === 'drug' ? 12 : 20);
  const A = P * Math.exp(r * t);
  const fmt: Fmt = kind === 'interest' ? 'money' : kind === 'population' || kind === 'bacteria' ? 'count' : 'mass';
  const noun = kind === 'population' ? 'people' : kind === 'bacteria' ? 'bacteria' : '';
  const startText =
    kind === 'interest'
      ? `${who} deposits ${money(P)} in an account that pays ${pct(k)} interest compounded continuously.`
      : kind === 'population'
        ? `The population of ${rng.pick(TOWNS)} is ${count(P)} and grows continuously at ${pct(k)} per year.`
        : kind === 'bacteria'
          ? `A culture of ${count(P)} bacteria grows continuously at a rate of ${pct(k)} per hour.`
          : kind === 'decay'
            ? `A ${P} mg sample of a radioactive substance decays continuously at a rate of ${pct(k)} per day.`
            : `A patient receives ${P} mg of a medication, which leaves the body continuously at a rate of ${pct(k)} per hour.`;
  const startNoRate =
    kind === 'interest'
      ? `${who} deposits ${money(P)} in an account with interest compounded continuously.`
      : kind === 'population'
        ? `The population of ${rng.pick(TOWNS)} is ${count(P)} and grows continuously.`
        : kind === 'bacteria'
          ? `A culture of ${count(P)} bacteria grows continuously.`
          : kind === 'decay'
            ? `A ${P} mg sample of a radioactive substance decays continuously.`
            : `A patient receives ${P} mg of a medication, which leaves the body continuously.`;
  const startNoAmount =
    kind === 'population'
      ? `The population of ${rng.pick(TOWNS)} grows continuously at ${pct(k)} per year.`
      : kind === 'bacteria'
        ? `A culture of bacteria grows continuously at a rate of ${pct(k)} per hour.`
        : kind === 'decay'
          ? `A sample of a radioactive substance decays continuously at a rate of ${pct(k)} per day.`
          : `A medication leaves the body continuously at a rate of ${pct(k)} per hour.`;
  const what = kind === 'interest' ? 'the balance' : kind === 'population' ? 'the population' : kind === 'bacteria' ? 'the number of bacteria' : 'the amount remaining';
  const rT = decimal(r, 4);
  const shown = (v: number) => (fmt === 'money' ? money(roundTo(v, 2)) : fmt === 'mass' ? `${grouped(v, 1, false, false)} mg` : count(v));
  const roundNote = ` Round to the nearest tenth of a${unit === 'hours' ? 'n' : ''} ${unit.replace(/s$/, '')}.`;
  if (unknown === 'A') {
    return {
      question: `${startText} Find ${what} after ${t} ${unit}.`,
      answer: show(A, fmt, noun),
      steps: [m(`A = Pe^{rt}`), m(`A = ${P}e^{${rT} \\cdot ${t}}`), m(`A \\approx ${grouped(A, PLACES[fmt], fmt === 'money')}`)],
      wrong: [P * (1 + r) ** t, P * (1 + r * t), P * Math.exp(-r * t), P * Math.exp(r * (t + 1))],
      fmt,
      noun,
      check: { model: 'continuous', P, r, t, unknown: 'A', given: [shown(P).replace(' mg', ''), pct(k)] },
    };
  }
  if (unknown === 't') {
    const target = decay ? roundTo(P * rng.int(10, 80) / 100, fmt === 'money' ? 0 : 1) : roundTo(P * rng.int(13, 40) / 10, 0);
    const tt = Math.log(target / P) / r;
    return {
      question: `${startText} How long until ${what} ${decay ? 'drops to' : 'reaches'} ${shown(target)}?${roundNote}`,
      answer: show(tt, unit as Fmt),
      steps: [m(`${target} = ${P}e^{${rT}t}`), m(`t = \\frac{\\ln \\frac{${target}}{${P}}}{${rT}} \\approx ${decimal(tt, 1)}`)],
      wrong: [Math.abs((target / P - 1) / r), Math.abs(Math.log10(target / P) / r), Math.abs(Math.log(target / P) / Math.log(1 + Math.abs(r))) * 1.07, tt + 1],
      fmt: unit as Fmt,
      check: { model: 'continuous', P, r, A: target, unknown: 't', given: [shown(target).replace(' mg', ''), pct(k)] },
    };
  }
  if (unknown === 'r') {
    const target = roundTo(A, fmt === 'money' ? 0 : fmt === 'mass' ? 1 : 0);
    const rate = Math.log(target / P) / t;
    return {
      question: `${startNoRate} After ${t} ${unit}, ${what} is ${shown(target)}. Find the continuous ${decay ? 'decay' : 'growth'} rate. Round to the nearest tenth of a percent.`,
      answer: show(Math.abs(rate), 'percent'),
      steps: [m(`${target} = ${P}e^{${t}r}`), m(`r = \\frac{\\ln \\frac{${target}}{${P}}}{${t}} \\approx ${decimal(rate, 4)}`), `The ${decay ? 'decay' : 'growth'} rate is about ${m(`${decimal(Math.abs(rate) * 100, 1)}\\%`)}.`],
      wrong: [Math.abs((target / P - 1) / t), Math.abs(Math.log10(target / P) / t), Math.abs((target / P) ** (1 / t) - 1) * 1.15, Math.abs(rate) * 2],
      fmt: 'percent',
      check: { model: 'continuous', P, A: target, t, unknown: 'r', absolute: true, given: [shown(target).replace(' mg', '')] },
    };
  }
  const goal = fmt === 'money' ? rng.int(20, 300) * 100 : roundTo(A, 0);
  const PV = goal / Math.exp(r * t);
  const fmtP: Fmt = fmt === 'mass' ? 'mass' : fmt === 'money' ? 'money' : 'count';
  return {
    question:
      kind === 'interest'
        ? `How much must ${who} deposit now in an account paying ${pct(k)} interest compounded continuously to have ${money(goal)} after ${t} years?`
        : `${startNoAmount} After ${t} ${unit}, ${what} is ${shown(goal)}. ${kind === 'population' ? 'What was the initial population?' : kind === 'bacteria' ? 'How many bacteria were there at the start?' : 'How much was there at the start?'}`,
    answer: show(PV, fmtP, noun),
    steps: [m(`${goal} = Pe^{${rT} \\cdot ${t}}`), m(`P = \\frac{${goal}}{${decimal(r * t, 4) === '1' ? 'e' : `e^{${decimal(r * t, 4)}}`}} \\approx ${grouped(PV, PLACES[fmtP], fmtP === 'money')}`)],
    wrong: [goal / (1 + r * t), goal * Math.exp(r * t), goal / (1 + r) ** t, goal / Math.exp(r * (t + 1))],
    fmt: fmtP,
    noun,
    check: { model: 'continuous', A: goal, r, t, unknown: 'P', given: [shown(goal).replace(' mg', '')] },
  };
}

function finish(b: Built): ProblemContent {
  const unitStep = 10 ** -PLACES[b.fmt];
  const fmtv = (v: number) => show(b.fmt === 'percent' ? Math.abs(v) : v, b.fmt, b.noun);
  const distractors = distinctDistractors(
    b.answer,
    b.wrong.filter((v) => Number.isFinite(v) && v > 0).map(fmtv),
    (k) => {
      const base = Number(onlyNumber(b.answer));
      const step = b.fmt === 'percent' ? 0.005 : Math.max(unitStep, Math.abs(base) * 0.04);
      const v = (b.fmt === 'percent' ? base / 100 : base) + offset(k) * step;
      return v > 0 ? fmtv(v) : null;
    },
  );
  return { question: b.question, answer: b.answer, steps: b.steps, distractors, check: { kind: 'alg2-explog.word', places: PLACES[b.fmt], percent: b.fmt === 'percent', ...b.check } };
}

function onlyNumber(rich: string): string {
  const seg = /\$([^$]*)\$/.exec(rich.replace(/^\\\$/, ''))![1]!;
  return seg.replace(/\\approx|\{,\}|\\%/g, '').trim();
}

export const discreteGrowth = defineTopic({
  id: 'alg2.explog.discrete-growth',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Discrete Exponential Growth and Decay Word Problems',
  description: 'Compound interest, growth and decay by a percent per period, doubling time and half-life.',
  instruction: 'Solve each problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [],
  generate(ctx): ProblemContent {
    return finish(discrete(ctx.rng, ctx.difficulty));
  },
});

export const continuousGrowth = defineTopic({
  id: 'alg2.explog.continuous-growth',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Continuous Exponential Growth and Decay Word Problems',
  description: 'Use A = Pe^(rt) to find a final amount, a time, a rate or an initial amount.',
  instruction: 'Solve each problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [],
  generate(ctx): ProblemContent {
    return finish(continuous(ctx.rng, ctx.difficulty));
  },
});
