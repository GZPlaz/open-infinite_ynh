/**
 * Word problems: work, distance-rate-time, mixtures, and two-variable systems.
 *
 * Every given quantity appears in the question either as a `$number$` math
 * segment or as a `\$price`, in a fixed order per problem mode, so the tests can
 * re-derive the answer from the rendered text.
 */
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { roundTo } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { NAMES, twoNames } from './helpers';

/** `12`, `2.4`, `0.75` — at most two decimals. */
export function fmt(x: number): string {
  return String(roundTo(x, 2));
}
const mm = (x: number) => `$${fmt(x)}$`;
const money = (x: number) => `\\$${Number.isInteger(roundTo(x, 2)) ? String(roundTo(x, 2)) : roundTo(x, 2).toFixed(2)}`;
const isNice = (x: number, places: number) => Math.abs(x * 10 ** places - Math.round(x * 10 ** places)) < 1e-9;

function wordProblem(question: string, answer: string, steps: string[], wrong: string[], fallback: (k: number) => string, mode: string): ProblemContent {
  return {
    question,
    answer,
    steps,
    distractors: distinctDistractors(answer, wrong, fallback),
    check: { kind: 'algebra1.word', mode },
  };
}

const modeOpt = (choices: Array<[string, string]>) => ({
  type: 'select' as const,
  id: 'type',
  label: 'Problem type',
  default: 'mixed',
  choices: [{ value: 'mixed', label: 'Mixed' }, ...choices.map(([value, label]) => ({ value, label }))],
});

function chooseMode(rng: Rng, chosen: string, byDiff: string[]): string {
  return chosen && chosen !== 'mixed' ? chosen : rng.pick(byDiff);
}

// ================================================================ work

const JOBS: ReadonlyArray<{ task: string; unit: 'hours' | 'minutes' }> = [
  { task: 'paint a fence', unit: 'hours' },
  { task: 'mow the lawn', unit: 'minutes' },
  { task: 'clean the gym', unit: 'hours' },
  { task: 'wash the cars in the lot', unit: 'hours' },
  { task: 'sort a box of mail', unit: 'minutes' },
  { task: 'tile a kitchen floor', unit: 'hours' },
  { task: 'shovel the driveway', unit: 'minutes' },
  { task: 'build a garden shed', unit: 'hours' },
  { task: 'stack the chairs in the hall', unit: 'minutes' },
  { task: 'pick the apples in an orchard row', unit: 'hours' },
];

const TANKS = ['a swimming pool', 'a water tank', 'a fish pond', 'a rain barrel', 'a hot tub'];

/** (a, b) with a ≤ b and a·b/(a + b) having at most `places` decimals. */
function workPairs(max: number, places: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let a = 2; a <= max; a++) for (let b = a; b <= max; b++) if (isNice((a * b) / (a + b), places)) out.push([a, b]);
  return out;
}
const WORK_EASY = workPairs(30, 0);
const WORK_MED = workPairs(30, 1);
const DRAIN: Array<[number, number]> = [];
for (let a = 2; a <= 20; a++) for (let b = a + 1; b <= 40; b++) if (isNice((a * b) / (b - a), 1) && (a * b) / (b - a) <= 60) DRAIN.push([a, b]);

export const workWordProblems = defineTopic({
  id: 'alg1.word.work',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Work Word Problems',
  description: 'Combined work rates: 1/a + 1/b = 1/t, including finding one worker’s time and fill-and-drain problems.',
  instruction: 'Solve each word problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    modeOpt([
      ['together', 'Working together'],
      ['alone', 'Find one worker’s time'],
      ['drain', 'Filling and draining'],
    ]),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const mode = chooseMode(rng, strOpt(ctx, 'type'), d === 'easy' ? ['together'] : d === 'medium' ? ['together', 'alone'] : ['alone', 'drain', 'together']);
    const [p, q] = twoNames(rng);
    if (mode === 'drain') {
      const [a, b] = rng.pick(DRAIN);
      const t = (a * b) / (b - a);
      const tank = rng.pick(TANKS);
      const question = `An inlet pipe can fill ${tank} in ${mm(a)} hours. A drain can empty it in ${mm(b)} hours. If the tank starts empty and both are open, how long will it take to fill?`;
      const answer = `${mm(t)} hours`;
      const steps = [`Rates: the pipe fills $\\frac{1}{${a}}$ per hour, the drain empties $\\frac{1}{${b}}$ per hour.`, `$\\frac{1}{${a}} - \\frac{1}{${b}} = \\frac{1}{t}$, so $t = \\frac{${a} \\cdot ${b}}{${b} - ${a}} = ${fmt(t)}$`];
      const wrong = [(a * b) / (a + b), b - a, (a + b) / 2].map((x) => `${mm(x)} hours`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(t + k)} hours`, 'work.drain');
    }
    const [a, b] = rng.pick(d === 'easy' ? WORK_EASY : WORK_MED);
    const job = rng.pick(JOBS);
    const unit = job.unit;
    const scale = unit === 'minutes' && d !== 'hard' ? 1 : 1;
    const A = a * scale;
    const B = b * scale;
    const t = (A * B) / (A + B);
    const [ta, tb] = rng.bool() ? [A, B] : [B, A];
    if (mode === 'together') {
      const question = `${p} can ${job.task} in ${mm(ta)} ${unit}. ${q} can do the same job in ${mm(tb)} ${unit}. How long would it take them working together?`;
      const answer = `${mm(t)} ${unit}`;
      const steps = [`$\\frac{1}{${ta}} + \\frac{1}{${tb}} = \\frac{1}{t}$`, `$t = \\frac{${ta} \\cdot ${tb}}{${ta} + ${tb}} = ${fmt(t)}$`];
      const wrong = [(A + B) / 2, A + B, Math.abs(A - B) || A / 2, Math.min(A, B)].map((x) => `${mm(x)} ${unit}`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(t + k)} ${unit}`, 'work.together');
    }
    // alone: given ta and the joint time t, find tb
    const question = `Working alone, ${p} can ${job.task} in ${mm(ta)} ${unit}. Working together, ${p} and ${q} can do it in ${mm(t)} ${unit}. How long would it take ${q} working alone?`;
    const answer = `${mm(tb)} ${unit}`;
    const steps = [`$\\frac{1}{${ta}} + \\frac{1}{x} = \\frac{1}{${fmt(t)}}$`, `$x = \\frac{${ta} \\cdot ${fmt(t)}}{${ta} - ${fmt(t)}} = ${fmt(tb)}$`];
    const wrong = [ta - t, ta + t, 2 * t, (ta * t) / (ta + t)].map((x) => `${mm(x)} ${unit}`);
    return wordProblem(question, answer, steps, wrong, (k) => `${mm(tb + k)} ${unit}`, 'work.alone');
  },
});

// ================================================================ distance, rate, time

const VEHICLES: ReadonlyArray<{ thing: string; lo: number; hi: number }> = [
  { thing: 'car', lo: 30, hi: 70 },
  { thing: 'train', lo: 40, hi: 90 },
  { thing: 'bus', lo: 30, hi: 60 },
  { thing: 'cyclist', lo: 8, hi: 20 },
  { thing: 'truck', lo: 35, hi: 65 },
  { thing: 'boat', lo: 10, hi: 30 },
];

export const distanceWordProblems = defineTopic({
  id: 'alg1.word.distance',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Distance-Rate-Time Word Problems',
  description: 'Use d = rt for opposite directions, meeting, catching up and round trips.',
  instruction: 'Solve each word problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    modeOpt([
      ['opposite', 'Opposite directions'],
      ['toward', 'Toward each other'],
      ['catchup', 'Catching up'],
      ['roundtrip', 'Round trip'],
      ['speeds', 'Find both speeds'],
    ]),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const mode = chooseMode(
      rng,
      strOpt(ctx, 'type'),
      d === 'easy' ? ['opposite', 'toward'] : d === 'medium' ? ['opposite', 'toward', 'catchup', 'roundtrip'] : ['catchup', 'roundtrip', 'speeds'],
    );
    const veh = rng.pick(VEHICLES);
    const step = veh.lo >= 30 ? 5 : 1;
    const speed = () => step * rng.int(Math.ceil(veh.lo / step), Math.floor(veh.hi / step));
    const unit = veh.lo >= 30 ? 'mph' : 'mph';
    const [p, q] = twoNames(rng);
    const things = `${veh.thing}s`;
    if (mode === 'opposite' || mode === 'toward') {
      const { r1, r2, t } = attempt('drt', () => {
        const r1 = speed();
        const r2 = speed();
        const t = d === 'easy' ? rng.int(1, 6) : rng.int(2, 12) / 2;
        if (r1 === r2 && rng.bool(0.7)) return null;
        return { r1, r2, t };
      });
      const D = (r1 + r2) * t;
      const question =
        mode === 'opposite'
          ? `Two ${things} leave the same place at the same time, traveling in opposite directions. One goes ${mm(r1)} ${unit} and the other goes ${mm(r2)} ${unit}. In how many hours will they be ${mm(D)} miles apart?`
          : `${p} and ${q} are ${mm(D)} miles apart and drive toward each other, ${p} at ${mm(r1)} ${unit} and ${q} at ${mm(r2)} ${unit}. In how many hours will they meet?`;
      const answer = `${mm(t)} hours`;
      const steps = [`Their distances add up: $${r1}t + ${r2}t = ${D}$`, `$${r1 + r2}t = ${D}$, so $t = ${fmt(t)}$`];
      const wrong = [r1 === r2 ? D / r1 : D / Math.abs(r1 - r2), D / r1, D / r2, (D / (r1 + r2)) * 2].map((x) => `${mm(x)} hours`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(t + k / 2)} hours`, `drt.${mode === 'opposite' ? 'opposite' : 'toward'}`);
    }
    if (mode === 'catchup') {
      const { r1, r2, h, t } = attempt('catchup', () => {
        const r1 = speed();
        const r2 = r1 + step * rng.int(1, 4);
        const h = rng.int(1, 4);
        const t = (r1 * h) / (r2 - r1);
        if (!isNice(t, 1) || t > 12) return null;
        return { r1, r2, h, t };
      });
      const question = `A ${veh.thing} leaves a station traveling at ${mm(r1)} ${unit}. ${mm(h)} ${h === 1 ? 'hour' : 'hours'} later, a second ${veh.thing} leaves the same station on the same route at ${mm(r2)} ${unit}. How many hours after it leaves will the second ${veh.thing} catch up?`;
      const answer = `${mm(t)} hours`;
      const steps = [`Equal distances: $${r2}t = ${r1}(t + ${h})$`, `$${r2 - r1}t = ${r1 * h}$, so $t = ${fmt(t)}$`];
      const wrong = [t + h, (r2 * h) / (r2 - r1), (r1 * h) / (r1 + r2), (r1 * h) / r2].map((x) => `${mm(x)} hours`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(t + k)} hours`, 'drt.catchup');
    }
    if (mode === 'roundtrip') {
      const { r1, r2, T, dist } = attempt('roundtrip', () => {
        const r1 = speed();
        const r2 = speed();
        if (r1 === r2) return null;
        const dist = step * rng.int(2, 30);
        const T = dist / r1 + dist / r2;
        if (!isNice(T, 1) || T > 15) return null;
        return { r1, r2, T, dist };
      });
      const question = `${p} rode a ${veh.thing} to a nearby town at an average speed of ${mm(r1)} ${unit} and returned along the same route at ${mm(r2)} ${unit}. The whole trip took ${mm(T)} hours. How far away is the town?`;
      const answer = `${mm(dist)} miles`;
      const steps = [`$\\frac{d}{${r1}} + \\frac{d}{${r2}} = ${fmt(T)}$`, `$d = ${fmt(dist)}$`];
      const wrong = [((r1 + r2) / 2) * T, ((r1 + r2) / 2) * (T / 2), r1 * T, dist * 2].map((x) => `${mm(x)} miles`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(dist + k * step)} miles`, 'drt.roundtrip');
    }
    // speeds: opposite directions, one k faster
    const { s, k, t } = attempt('speeds', () => {
      const s = speed();
      const k = step * rng.int(1, 4);
      const t = rng.int(2, 6);
      return { s, k, t };
    });
    const D = (2 * s + k) * t;
    const question = `Two ${things} leave the same place at the same time and travel in opposite directions. One travels ${mm(k)} ${unit} faster than the other. After ${mm(t)} hours they are ${mm(D)} miles apart. Find the speed of each.`;
    const answer = `${mm(s)} ${unit} and ${mm(s + k)} ${unit}`;
    const steps = [`$${t}r + ${t}(r + ${k}) = ${D}$`, `$${2 * t}r + ${t * k} = ${D}$, so $r = ${s}$ and $r + ${k} = ${s + k}$`];
    const both = (x: number) => `${mm(x)} ${unit} and ${mm(x + k)} ${unit}`;
    const wrong = [both(D / t / 2), both(s - k), both((D - k) / t / 2), both(s + k)];
    return wordProblem(question, answer, steps, wrong, (j) => both(s + j * step), 'drt.speeds');
  },
});

// ================================================================ mixtures

const SOLUTIONS = ['acid', 'saline', 'alcohol', 'antifreeze', 'juice concentrate', 'fertilizer'];
const DRY: ReadonlyArray<[string, string]> = [
  ['cashews', 'peanuts'],
  ['dark roast coffee', 'mild roast coffee'],
  ['green tea', 'black tea'],
  ['dried cherries', 'raisins'],
  ['almonds', 'sunflower seeds'],
  ['premium birdseed', 'regular birdseed'],
];

export const mixtureWordProblems = defineTopic({
  id: 'alg1.word.mixture',
  subject: 'algebra1',
  category: 'Equations and Inequalities',
  title: 'Mixture Word Problems',
  description: 'Percent solutions and value mixtures: amount × rate stays balanced.',
  instruction: 'Solve each word problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    modeOpt([
      ['solution', 'Percent solutions'],
      ['water', 'Diluting with water'],
      ['value', 'Value mixtures'],
    ]),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const mode = chooseMode(rng, strOpt(ctx, 'type'), d === 'easy' ? ['water', 'solution'] : d === 'medium' ? ['solution', 'value', 'water'] : ['solution', 'value']);
    if (mode === 'water') {
      const { V, qp, rp, x } = attempt('dilute', () => {
        const qp = 5 * rng.int(4, 16);
        const rp = 5 * rng.int(1, qp / 5 - 1);
        const V = rng.int(2, 20);
        const x = (V * (qp - rp)) / rp;
        if (!isNice(x, 1) || x > 60) return null;
        return { V, qp, rp, x };
      });
      const sol = rng.pick(SOLUTIONS);
      const question = `How many liters of water must be added to ${mm(V)} liters of a $${qp}\\%$ ${sol} solution to make a $${rp}\\%$ solution?`;
      const answer = `${mm(x)} liters`;
      const steps = [`The amount of ${sol} stays the same: $${qp / 100}(${V}) = ${rp / 100}(${V} + x)$`, `$x = ${fmt(x)}$`];
      const wrong = [(V * qp) / rp, (V * rp) / qp, (V * (qp - rp)) / qp, V * (qp / rp - 1) * 2].map((y) => `${mm(y)} liters`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(x + k)} liters`, 'mix.water');
    }
    if (mode === 'solution') {
      const { pp, V, qp, rp, x } = attempt('solution', () => {
        const pp = 5 * rng.int(1, 18);
        const qp = 5 * rng.int(1, 18);
        const rp = 5 * rng.int(1, 18);
        if (!((pp < rp && rp < qp) || (qp < rp && rp < pp))) return null;
        const V = rng.int(2, d === 'hard' ? 40 : 20);
        const x = (V * (qp - rp)) / (rp - pp);
        if (!isNice(x, d === 'hard' ? 1 : 0) || x > 80 || x < 1) return null;
        return { pp, V, qp, rp, x };
      });
      const sol = rng.pick(SOLUTIONS);
      const question = `How many liters of a $${pp}\\%$ ${sol} solution must be added to ${mm(V)} liters of a $${qp}\\%$ ${sol} solution to make a $${rp}\\%$ solution?`;
      const answer = `${mm(x)} liters`;
      const steps = [`$${pp / 100}x + ${qp / 100}(${V}) = ${rp / 100}(x + ${V})$`, `$${fmt((rp - pp) / 100)}x = ${fmt((V * (qp - rp)) / 100)}$, so $x = ${fmt(x)}$`];
      const wrong = [(V * (rp - pp)) / (qp - rp), V, (V * qp) / rp, x + V].map((y) => `${mm(Math.abs(y))} liters`);
      return wordProblem(question, answer, steps, wrong, (k) => `${mm(x + k)} liters`, 'mix.solution');
    }
    // value mixture: a + b = W, pa·a + pb·b = pm·W
    const [hiName, loName] = rng.pick(DRY);
    const { pa, pb, W, pm, a, b } = attempt('value', () => {
      const pb = rng.int(4, 16) / 2;
      const pa = pb + rng.int(1, 10) / 2;
      const W = rng.int(4, 30);
      const a = d === 'hard' ? rng.int(1, 2 * W - 1) / 2 : rng.int(1, W - 1);
      const b = W - a;
      const pm = (pa * a + pb * b) / W;
      if (!isNice(pm, 2)) return null;
      return { pa, pb, W, pm, a, b };
    });
    const question = `A store mixes ${hiName} that cost ${money(pa)} per pound with ${loName} that cost ${money(pb)} per pound to make ${mm(W)} pounds of a mix that costs ${money(pm)} per pound. How many pounds of each are used?`;
    const answer = `${mm(a)} pounds of ${hiName} and ${mm(b)} pounds of ${loName}`;
    const steps = [`Let $x$ be the pounds of ${hiName}: $${fmt(pa)}x + ${fmt(pb)}(${W} - x) = ${fmt(pm)}(${W})$`, `$${fmt(pa - pb)}x = ${fmt(pm * W - pb * W)}$, so $x = ${fmt(a)}$ and the rest is ${mm(b)} pounds`];
    const pair = (x: number, y: number) => `${mm(x)} pounds of ${hiName} and ${mm(y)} pounds of ${loName}`;
    const wrong = [pair(b, a), pair(W / 2, W / 2), pair(a + 1, b - 1), pair(roundTo((W * (pm - pb)) / pa, 2), roundTo(W - (W * (pm - pb)) / pa, 2))];
    return wordProblem(question, answer, steps, wrong, (k) => pair(a + k + 1, b - k - 1), 'mix.value');
  },
});

// ================================================================ systems word problems

const EVENTS = ['a school play', 'a concert', 'a basketball game', 'a museum exhibit', 'a science fair', 'a talent show'];
const ITEMS: ReadonlyArray<[string, string]> = [
  ['notebooks', 'pens'],
  ['apples', 'oranges'],
  ['sandwiches', 'drinks'],
  ['bagels', 'muffins'],
  ['tacos', 'burritos'],
  ['posters', 'stickers'],
];

export const systemsWordProblems = defineTopic({
  id: 'alg1.word.systems',
  subject: 'algebra1',
  category: 'Systems of Equations and Inequalities',
  title: 'Systems of Equations Word Problems',
  description: 'Write and solve a system of two linear equations in two variables from a real situation.',
  instruction: 'Write a system of equations and solve each problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    modeOpt([
      ['tickets', 'Tickets'],
      ['purchases', 'Two purchases'],
      ['numbers', 'Sum and difference'],
      ['coins', 'Coins'],
      ['current', 'Current / wind'],
    ]),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const mode = chooseMode(
      rng,
      strOpt(ctx, 'type'),
      d === 'easy' ? ['numbers', 'tickets'] : d === 'medium' ? ['tickets', 'purchases', 'coins'] : ['purchases', 'coins', 'current'],
    );
    return SYSTEM_MODES[mode]!(rng, d);
  },
});

type Maker = (rng: Rng, d: Difficulty) => ProblemContent;

const SYSTEM_MODES: Record<string, Maker> = {
  numbers(rng, d) {
    const big = rng.int(d === 'easy' ? 5 : 10, d === 'easy' ? 30 : 80);
    const small = rng.int(d === 'easy' ? 1 : -20, big - 1);
    const S = big + small;
    const D = big - small;
    const question = `The sum of two numbers is ${mm(S)} and their difference is ${mm(D)}. Find the two numbers.`;
    const answer = `${mm(big)} and ${mm(small)}`;
    const steps = [`$x + y = ${S}$ and $x - y = ${D}$`, `Add: $2x = ${S + D}$, so $x = ${big}$ and $y = ${small}$`];
    const pair = (x: number, y: number) => `${mm(x)} and ${mm(y)}`;
    return wordProblem(question, answer, steps, [pair(S, D), pair(big + 1, small - 1), pair(D, small), pair(big, -small)], (k) => pair(big + k, small + k), 'sys.numbers');
  },
  tickets(rng, d) {
    const event = rng.pick(EVENTS);
    const { pa, pc, a, c } = attempt('tickets', () => {
      const pc = d === 'easy' ? rng.int(2, 8) : rng.int(4, 16) / 2;
      const pa = pc + (d === 'easy' ? rng.int(1, 6) : rng.int(2, 12) / 2);
      const a = rng.int(5, d === 'easy' ? 40 : 150);
      const c = rng.int(5, d === 'easy' ? 40 : 150);
      return { pa, pc, a, c };
    });
    const N = a + c;
    const R = pa * a + pc * c;
    const question = `${mm(N)} tickets were sold for ${event}, for a total of ${money(R)}. Adult tickets cost ${money(pa)} each and student tickets cost ${money(pc)} each. How many of each kind were sold?`;
    const answer = `${mm(a)} adult tickets and ${mm(c)} student tickets`;
    const steps = [`$a + s = ${N}$ and $${fmt(pa)}a + ${fmt(pc)}s = ${fmt(R)}$`, `Substitute $s = ${N} - a$: $${fmt(pa - pc)}a = ${fmt(R - pc * N)}$, so $a = ${a}$ and $s = ${c}$`];
    const pair = (x: number, y: number) => `${mm(x)} adult tickets and ${mm(y)} student tickets`;
    return wordProblem(question, answer, steps, [pair(c, a), pair(Math.floor(N / 2), Math.ceil(N / 2)), pair(a + 2, c - 2)], (k) => pair(a - k, c + k), 'sys.tickets');
  },
  purchases(rng, d) {
    const [p, q] = twoNames(rng);
    const [i1, i2] = rng.pick(ITEMS);
    const { a1, b1, a2, b2, u, v } = attempt('purchases', () => {
      const u = rng.int(2, d === 'hard' ? 24 : 12) / (d === 'hard' ? 4 : 2);
      const v = rng.int(2, d === 'hard' ? 24 : 12) / (d === 'hard' ? 4 : 2);
      const a1 = rng.int(1, 8);
      const b1 = rng.int(1, 8);
      const a2 = rng.int(1, 8);
      const b2 = rng.int(1, 8);
      if (a1 * b2 - a2 * b1 === 0 || u === v) return null;
      return { a1, b1, a2, b2, u, v };
    });
    const c1 = a1 * u + b1 * v;
    const c2 = a2 * u + b2 * v;
    const qty = (n: number, item: string) => `${mm(n)} ${n === 1 ? item.replace(/(?:es|s)$/, (s) => (item.endsWith('ches') || item.endsWith('oes') ? 'es' : s).slice(0, s.length === 2 && (item.endsWith('ches') || item.endsWith('oes')) ? 0 : 0)).replace(/s$/, '') : item}`;
    const question = `${p} bought ${qty(a1, i1)} and ${qty(b1, i2)} for ${money(c1)}. ${q} bought ${qty(a2, i1)} and ${qty(b2, i2)} for ${money(c2)}. What is the price of one of each item?`;
    const one = (item: string) => item.replace(/(ches|oes)$/, (s) => s.slice(0, -2)).replace(/s$/, '');
    const answer = `${money(u)} per ${one(i1)} and ${money(v)} per ${one(i2)}`;
    const steps = [`$${a1}x + ${b1}y = ${fmt(c1)}$ and $${a2}x + ${b2}y = ${fmt(c2)}$`, `Eliminate one variable: $x = ${fmt(u)}$, $y = ${fmt(v)}$`];
    const pair = (x: number, y: number) => `${money(x)} per ${one(i1)} and ${money(y)} per ${one(i2)}`;
    return wordProblem(question, answer, steps, [pair(v, u), pair(u + 0.5, v - 0.25), pair(u - 0.25, v + 0.5)], (k) => pair(u + k / 4, v + k / 2), 'sys.purchases');
  },
  coins(rng, d) {
    const name = rng.pick(NAMES);
    const { n1, n2, v1, v2, c1, c2 } = attempt('coins', () => {
      const kinds: Array<[string, number]> = [
        ['nickels', 0.05],
        ['dimes', 0.1],
        ['quarters', 0.25],
      ];
      const [k1, k2] = rng.sample(kinds, 2).sort((x, y) => x[1] - y[1]);
      const n1 = rng.int(3, d === 'hard' ? 40 : 25);
      const n2 = rng.int(3, d === 'hard' ? 40 : 25);
      return { n1, n2, c1: k1![0], v1: k1![1], c2: k2![0], v2: k2![1] };
    });
    const N = n1 + n2;
    const V = roundTo(n1 * v1 + n2 * v2, 2);
    const question = `${name} has ${mm(N)} coins, all ${c1} and ${c2}, worth ${money(V)} in total. How many of each coin are there?`;
    const answer = `${mm(n1)} ${c1} and ${mm(n2)} ${c2}`;
    const steps = [`$x + y = ${N}$ and $${v1}x + ${v2}y = ${fmt(V)}$`, `Substitute $x = ${N} - y$: $${fmt(v2 - v1)}y = ${fmt(V - v1 * N)}$, so $y = ${n2}$ and $x = ${n1}$`];
    const pair = (x: number, y: number) => `${mm(x)} ${c1} and ${mm(y)} ${c2}`;
    return wordProblem(question, answer, steps, [pair(n2, n1), pair(n1 + 1, n2 - 1), pair(n1 - 2, n2 + 2)], (k) => pair(n1 + k + 2, n2 - k - 2), 'sys.coins');
  },
  current(rng) {
    const air = rng.bool(0.4);
    const { b, c, t1, t2 } = attempt('current', () => {
      const b = air ? 10 * rng.int(15, 50) : rng.int(8, 30);
      const c = air ? 10 * rng.int(1, 8) : rng.int(1, 6);
      if (c >= b / 2) return null;
      const t1 = rng.int(2, 6);
      const dist = (b + c) * t1;
      const t2 = dist / (b - c);
      if (!isNice(t2, 1) || t2 > 15) return null;
      return { b, c, t1, t2 };
    });
    const dist = (b + c) * t1;
    const question = air
      ? `A plane flies ${mm(dist)} miles with the wind in ${mm(t1)} hours. The return trip against the wind takes ${mm(t2)} hours. Find the speed of the plane in still air and the speed of the wind.`
      : `A boat travels ${mm(dist)} miles downstream in ${mm(t1)} hours. The return trip upstream takes ${mm(t2)} hours. Find the speed of the boat in still water and the speed of the current.`;
    const what = air ? 'wind' : 'current';
    const answer = `${air ? 'Plane' : 'Boat'}: ${mm(b)} mph; ${what}: ${mm(c)} mph`;
    const steps = [`$${t1}(b + c) = ${dist}$ and $${fmt(t2)}(b - c) = ${dist}$`, `$b + c = ${b + c}$ and $b - c = ${b - c}$, so $b = ${b}$ and $c = ${c}$`];
    const pair = (x: number, y: number) => `${air ? 'Plane' : 'Boat'}: ${mm(x)} mph; ${what}: ${mm(y)} mph`;
    return wordProblem(question, answer, steps, [pair(b + c, b - c), pair(b + c, c), pair(b - c, c)], (k) => pair(b + k, c + k), 'sys.current');
  },
};
