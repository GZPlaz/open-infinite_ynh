/**
 * Probability of independent / dependent events, mutually exclusive /
 * overlapping events, and probability with permutations and combinations.
 * Every probability is computed by enumerating the described experiment.
 */
import { Frac } from '../../../fraction';
import { attempt, defineTopic, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import {
  choose,
  combTex,
  FACE,
  itemsOf,
  listing,
  names,
  probability,
  probChoices,
  probForm,
  probFormOption,
  RANKS,
  RED,
  SUITS,
  WORDS,
  type AttrValue,
  type Ev,
  type Experiment,
  type PoolSpec,
} from './common';

const PFX = 'alg2-sequences-probability';

interface Cat {
  /** Short label for `P(\text{…})`. */
  short: string;
  /** Phrase for word problems ("an even number", "a heart"). */
  long: string;
  attr: string;
  in: AttrValue[];
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];

function numberCats(rng: Rng, n: number): Cat[] {
  const all = range(1, n);
  const k = rng.int(2, n - 1);
  const g = rng.int(Math.ceil(n / 2), n - 1);
  const mult = rng.pick([3, 4, 5].filter((x) => x < n));
  const cats: Cat[] = [
    { short: 'even', long: 'an even number', attr: 'value', in: all.filter((x) => x % 2 === 0) },
    { short: 'odd', long: 'an odd number', attr: 'value', in: all.filter((x) => x % 2 === 1) },
    { short: String(k), long: `a ${k}`, attr: 'value', in: [k] },
    { short: `greater than ${g}`, long: `a number greater than ${g}`, attr: 'value', in: all.filter((x) => x > g) },
    { short: `less than ${n - g + 1}`, long: `a number less than ${n - g + 1}`, attr: 'value', in: all.filter((x) => x < n - g + 1) },
    { short: 'prime', long: 'a prime number', attr: 'value', in: all.filter((x) => PRIMES.includes(x)) },
    { short: `a multiple of ${mult}`, long: `a multiple of ${mult}`, attr: 'value', in: all.filter((x) => x % mult === 0) },
  ];
  return cats.filter((c) => c.in.length > 0 && c.in.length < n);
}

function cardCats(rng: Rng): Cat[] {
  const rank = rng.pick(RANKS.filter((r) => r !== '10'));
  const rankName: Record<string, string> = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
  const rn = rankName[rank] ?? rank;
  const article = (w: string) => (/^[aeiou8]/.test(w) ? `an ${w}` : `a ${w}`);
  const suit = rng.pick(SUITS);
  const sname = suit.slice(0, -1);
  return [
    { short: sname, long: article(sname), attr: 'suit', in: [suit] },
    { short: rn, long: article(rn), attr: 'rank', in: [rank] },
    { short: 'face card', long: 'a face card', attr: 'rank', in: FACE },
    { short: 'red card', long: 'a red card', attr: 'suit', in: RED },
    { short: 'black card', long: 'a black card', attr: 'suit', in: ['clubs', 'spades'] },
  ];
}

/** Cards of a category (for overlap tests). */
function cardSet(c: Cat): Set<string> {
  const out = new Set<string>();
  for (const r of RANKS) for (const s of SUITS) if ((c.attr === 'rank' ? c.in.includes(r) : c.in.includes(s))) out.add(`${r}${s}`);
  return out;
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'white', 'black', 'orange'];

// ---------------------------------------------------------------- independent and dependent events

interface Stage {
  pool: string;
  cat: Cat;
}

interface Scenario {
  pools: Record<string, PoolSpec>;
  stages: Stage[];
  replace: boolean;
  question: string;
  mentions: string[];
}

function poolItems(p: PoolSpec): Array<{ count: number; attrs: Record<string, AttrValue> }> {
  if (p.die) return range(1, p.die).map((v) => ({ count: 1, attrs: { value: v } }));
  if (p.coin) return ['H', 'T'].map((s) => ({ count: 1, attrs: { side: s } }));
  if (p.deck) return RANKS.flatMap((r) => SUITS.map((s) => ({ count: 1, attrs: { rank: r, suit: s } })));
  return p.items ?? [];
}

/** Stage-by-stage fractions, valid when categories drawn from one pool are identical or disjoint. */
function stageFractions(sc: Scenario, replace: boolean): Array<[number, number]> | null {
  const out: Array<[number, number]> = [];
  sc.stages.forEach((st, i) => {
    const items = poolItems(sc.pools[st.pool]!);
    const total = items.reduce((s, it) => s + it.count, 0);
    let fav = items.filter((it) => st.cat.in.includes(it.attrs[st.cat.attr]!)).reduce((s, it) => s + it.count, 0);
    const earlier = sc.stages.slice(0, i).filter((e) => e.pool === st.pool);
    if (!replace) fav -= earlier.filter((e) => e.cat.attr === st.cat.attr && e.cat.in.join() === st.cat.in.join()).length;
    out.push([fav, replace ? total : total - earlier.length]);
  });
  return out.every(([f]) => f > 0) ? out : null;
}

const expOf = (sc: Scenario, replace = sc.replace): Experiment => ({
  pools: sc.pools,
  draws: sc.stages.map((s) => s.pool),
  replace,
  event: { and: sc.stages.map((s, i): Ev => ({ at: i, attr: s.cat.attr, in: s.cat.in })) },
});

/** Categories drawn from one pool without replacement must be identical or disjoint. */
function compatible(sc: Scenario): boolean {
  if (sc.replace) return true;
  for (let i = 0; i < sc.stages.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = sc.stages[i]!;
      const b = sc.stages[j]!;
      if (a.pool !== b.pool) continue;
      const same = a.cat.attr === b.cat.attr && a.cat.in.join() === b.cat.in.join();
      if (same) continue;
      if (sc.pools[a.pool]!.deck) {
        const A = cardSet(a.cat);
        if ([...cardSet(b.cat)].some((x) => A.has(x))) return false;
      } else if (a.cat.attr !== b.cat.attr || a.cat.in.some((x) => b.cat.in.includes(x))) return false;
    }
  }
  return true;
}

type Mode = 'independent' | 'dependent';

function plainScenario(rng: Rng, d: Difficulty, mode: Mode): Scenario {
  const three = d === 'hard' && rng.bool(0.4);
  const k = three ? 3 : 2;
  const P = (labels: string[], sep = ', then ') => m(`P(\\text{${labels.join(sep)}})`);
  const bag = (): Scenario => {
    const colors = rng.sample(COLORS, rng.int(2, d === 'easy' ? 3 : 4));
    const counts = colors.map(() => rng.int(1, d === 'easy' ? 6 : 9));
    const cats = colors.map((c) => ({ short: c, long: c, attr: 'kind', in: [c] as AttrValue[] }));
    const stages = Array.from({ length: k }, () => ({ pool: 'bag', cat: rng.pick(cats) }));
    const replace = mode === 'independent';
    return {
      pools: { bag: itemsOf(Object.fromEntries(colors.map((c, i) => [c, counts[i]!]))) },
      stages,
      replace,
      question: `A bag contains ${listing(colors.map((c, i) => [counts[i]!, c]))} marbles. ${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)} marbles are drawn ${replace ? 'with' : 'without'} replacement. Find ${P(stages.map((s) => s.cat.short))}.`,
      mentions: colors.map((c, i) => `${counts[i]} ${c}`),
    };
  };
  const cards = (): Scenario => {
    const cats = cardCats(rng);
    const stages = Array.from({ length: k }, () => ({ pool: 'deck', cat: rng.pick(cats) }));
    const replace = mode === 'independent';
    return {
      pools: { deck: { deck: true } },
      stages,
      replace,
      question: `${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)} cards are drawn from a standard deck ${replace ? 'with' : 'without'} replacement. Find ${P(stages.map((s) => s.cat.short))}.`,
      mentions: [],
    };
  };
  const tiles = (): Scenario => {
    const word = rng.pick(['MATHEMATICS', 'STATISTICS', 'PROBABILITY', 'ALGEBRA', 'GEOMETRY', 'MISSISSIPPI', 'TENNESSEE', 'CALCULUS', 'ARITHMETIC', 'COMMITTEE']);
    const counts: Record<string, number> = {};
    for (const ch of word) counts[ch] = (counts[ch] ?? 0) + 1;
    const letters = Object.keys(counts);
    const cats = letters.map((l) => ({ short: l, long: l, attr: 'letter', in: [l] as AttrValue[] }));
    const stages = Array.from({ length: k }, () => ({ pool: 'tiles', cat: rng.pick(cats) }));
    return {
      pools: { tiles: itemsOf(counts, 'letter') },
      stages,
      replace: false,
      question: `The letter tiles of the word ${word} are placed in a bag. ${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)} tiles are drawn without replacement. Find ${P(stages.map((s) => s.cat.short))}.`,
      mentions: [],
    };
  };
  const dice = (): Scenario => {
    const sides = d === 'easy' ? 6 : rng.pick([6, 6, 8, 10]);
    const cats = numberCats(rng, sides);
    const stages = Array.from({ length: k }, () => ({ pool: 'die', cat: rng.pick(cats) }));
    const what = sides === 6 ? 'A die is' : `A spinner with ${sides} equal sections numbered 1 to ${sides} is`;
    return {
      pools: { die: { die: sides } },
      stages,
      replace: true,
      question: `${what} ${sides === 6 ? 'rolled' : 'spun'} ${k === 2 ? 'twice' : 'three times'}. Find ${P(stages.map((s) => s.cat.short))}.`,
      mentions: sides === 6 ? [] : [`1 to ${sides}`],
    };
  };
  const coinDie = (): Scenario => {
    const c = rng.pick(numberCats(rng, 6));
    const side = rng.pick(['H', 'T']);
    const sideName = side === 'H' ? 'heads' : 'tails';
    return {
      pools: { coin: { coin: true }, die: { die: 6 } },
      stages: [
        { pool: 'coin', cat: { short: sideName, long: sideName, attr: 'side', in: [side] } },
        { pool: 'die', cat: c },
      ],
      replace: true,
      question: `A coin is tossed and a die is rolled. Find ${P([sideName, c.short], ' and ')}.`,
      mentions: [],
    };
  };
  const indep = [bag, cards, dice, dice, coinDie];
  const dep = d === 'easy' ? [bag, bag, cards] : [bag, cards, tiles];
  return rng.pick(mode === 'independent' ? indep : dep)();
}

interface Ctx2 {
  container: string;
  noun: string;
  plural: string;
  kinds: string[];
  keep: string;
}

const BAGS: Ctx2[] = [
  { container: 'a bag', noun: 'marble', plural: 'marbles', kinds: ['red', 'blue', 'green', 'yellow', 'white'], keep: 'sets it aside' },
  { container: 'a jar', noun: 'jelly bean', plural: 'jelly beans', kinds: ['cherry', 'lemon', 'grape', 'lime', 'orange'], keep: 'eats it' },
  { container: 'a drawer', noun: 'sock', plural: 'socks', kinds: ['black', 'white', 'gray', 'blue'], keep: 'keeps it out' },
  { container: 'a box', noun: 'pen', plural: 'pens', kinds: ['blue', 'black', 'red', 'green'], keep: 'keeps it' },
  { container: 'a bowl', noun: 'fruit chew', plural: 'fruit chews', kinds: ['strawberry', 'mango', 'apple', 'banana'], keep: 'eats it' },
  { container: 'a basket', noun: 'ball', plural: 'balls', kinds: ['soccer', 'tennis', 'golf'], keep: 'keeps it' },
];

const GROUPS: Array<[string, string, string, string]> = [
  ['junior', 'juniors', 'senior', 'seniors'],
  ['sixth grader', 'sixth graders', 'seventh grader', 'seventh graders'],
  ['band member', 'band members', 'choir member', 'choir members'],
  ['freshman', 'freshmen', 'sophomore', 'sophomores'],
  ['swimmer', 'swimmers', 'runner', 'runners'],
];

function wordScenario(rng: Rng, d: Difficulty, mode: Mode): Scenario {
  const [name] = names(rng, 1);
  const three = d === 'hard' && rng.bool(0.35);
  const k = three ? 3 : 2;
  const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
  const ask = (labels: string[]) => {
    if (labels.every((l) => l === labels[0])) return `What is the probability that ${k === 2 ? 'both are' : 'all three are'} ${labels[0]}?`;
    const ord = ['first', 'second', 'third'];
    return `What is the probability that ${labels.map((l, i) => `the ${ord[i]} is ${l}`).join(k === 2 ? ' and ' : ', ').replace(/, (the third)/, ' and $1')}?`;
  };
  const bag = (): Scenario => {
    const c = rng.pick(BAGS);
    const kinds = rng.sample(c.kinds, rng.int(2, Math.min(3, c.kinds.length)));
    const counts = kinds.map(() => rng.int(2, d === 'easy' ? 7 : 10));
    const cats = kinds.map((x) => ({ short: x, long: x, attr: 'kind', in: [x] as AttrValue[] }));
    const stages = Array.from({ length: k }, () => ({ pool: 'bag', cat: rng.pick(cats) }));
    const replace = mode === 'independent';
    const how = replace ? `picks one at random, puts it back, and then picks ${k === 2 ? 'another' : 'again, twice more'}` : `picks one at random and ${c.keep}, then picks ${k === 2 ? 'another' : 'two more the same way'}`;
    return {
      pools: { bag: itemsOf(Object.fromEntries(kinds.map((x, i) => [x, counts[i]!]))) },
      stages,
      replace,
      question: `${cap(c.container)} holds ${listing(kinds.map((x, i) => [counts[i]!, x]))} ${c.plural}. ${name} ${how}. ${ask(stages.map((s) => s.cat.long))}`,
      mentions: kinds.map((x, i) => `${counts[i]} ${x}`),
    };
  };
  const people = (): Scenario => {
    const g = rng.pick(GROUPS);
    const a = rng.int(5, 15);
    const b = rng.int(5, 15);
    const cats: Cat[] = [
      { short: g[0], long: `a ${g[0]}`, attr: 'kind', in: [g[0]] },
      { short: g[2], long: `a ${g[2]}`, attr: 'kind', in: [g[2]] },
    ];
    const stages = Array.from({ length: k }, () => ({ pool: 'people', cat: rng.pick(cats) }));
    const same = stages.every((s) => s.cat === stages[0]!.cat);
    const pl = (c: Cat) => (c.in[0] === g[0] ? g[1] : g[3]);
    const q = same
      ? `What is the probability that ${k === 2 ? 'both' : 'all three'} are ${pl(stages[0]!.cat)}?`
      : `What is the probability that the students are chosen in the order ${stages.map((s) => s.cat.short).join(', then ')}?`;
    return {
      pools: { people: itemsOf({ [g[0]]: a, [g[2]]: b }) },
      stages,
      replace: false,
      question: `A group has ${a} ${g[1]} and ${b} ${g[3]}. ${name} chooses ${WORDS[k]} different students at random, one at a time, to help with an event. ${q}`,
      mentions: [`${a} ${g[1]}`, `${b} ${g[3]}`],
    };
  };
  const bulbs = (): Scenario => {
    const item = rng.pick([
      ['light bulbs', 'defective'],
      ['batteries', 'dead'],
      ['phone chargers', 'faulty'],
      ['eggs', 'cracked'],
    ] as const);
    const total = rng.int(10, 24);
    const bad = rng.int(2, Math.min(6, total - 3));
    const none = rng.bool();
    const kind = none ? 'good' : 'bad';
    const stages = Array.from({ length: k }, () => ({ pool: 'box', cat: { short: kind, long: kind, attr: 'kind', in: [kind] as AttrValue[] } }));
    return {
      pools: { box: itemsOf({ bad, good: total - bad }) },
      stages,
      replace: false,
      question: `A box of ${total} ${item[0]} contains ${bad} that are ${item[1]}. ${name} takes ${WORDS[k]} of them at random without replacement. What is the probability that ${none ? `none of them ${k === 2 ? 'is' : 'are'} ${item[1]}` : `${k === 2 ? 'both are' : 'all are'} ${item[1]}`}?`,
      mentions: [`${total} ${item[0]}`, `${bad} that are`],
    };
  };
  const devices = (): Scenario => {
    const sides = rng.pick([4, 5, 6, 8]);
    const a = rng.pick(numberCats(rng, 6));
    const b = rng.pick(numberCats(rng, sides));
    return {
      pools: { die: { die: 6 }, spin: { die: sides } },
      stages: [
        { pool: 'die', cat: a },
        { pool: 'spin', cat: b },
      ],
      replace: true,
      question: `${name} rolls a die and spins a spinner with ${sides} equal sections numbered 1 to ${sides}. What is the probability of rolling ${a.long} and spinning ${b.long}?`,
      mentions: [`1 to ${sides}`],
    };
  };
  const cards = (): Scenario => {
    const cats = cardCats(rng);
    const replace = mode === 'independent';
    const stages = Array.from({ length: 2 }, () => ({ pool: 'deck', cat: rng.pick(cats) }));
    return {
      pools: { deck: { deck: true } },
      stages,
      replace,
      question: `${name} draws a card from a standard deck, ${replace ? 'returns it and shuffles' : 'keeps it'}, then draws a second card. What is the probability that the first card is ${stages[0]!.cat.long} and the second is ${stages[1]!.cat.long}?`,
      mentions: [],
    };
  };
  return rng.pick(mode === 'independent' ? [bag, devices, cards, bag] : [bag, people, bulbs, cards])();
}

function indepDep(style: 'plain' | 'word') {
  return (ctx: Parameters<Parameters<typeof defineTopic>[0]['generate']>[0]): ProblemContent => {
    const { rng, difficulty: d } = ctx;
    const form = probForm(ctx);
    const o = strOpt(ctx, 'events');
    const mode: Mode = o === 'independent' || o === 'dependent' ? o : rng.pick<Mode>(['independent', 'dependent']);
    return attempt('indep-dep', () => {
      const sc = style === 'plain' ? plainScenario(rng, d, mode) : wordScenario(rng, d, mode);
      if (!compatible(sc)) return null;
      const fr = stageFractions(sc, sc.replace);
      if (!fr) return null;
      const p = probability(expOf(sc));
      const prod = fr.reduce((acc, [a, b]) => acc.mul(new Frac(a, b)), Frac.ONE);
      if (!prod.eq(p) || p.value < 0.002) return null;
      const single = sc.stages.length === 1 || new Set(sc.stages.map((s) => s.pool)).size === sc.stages.length;
      const flipped = single ? null : probability(expOf(sc, !sc.replace));
      const sumP = fr.reduce((acc, [a, b]) => acc.add(new Frac(a, b)), Frac.ZERO);
      const noAdjust = stageFractions(sc, true)!.reduce((acc, [a, b]) => acc.mul(new Frac(a, b)), Frac.ONE);
      const halfAdjust = fr.reduce((acc, [a], i) => acc.mul(new Frac(a, stageFractions(sc, true)![i]![1])), Frac.ONE);
      const { answer, distractors } = probChoices(p, [flipped, halfAdjust, sumP, noAdjust, new Frac(fr[0]![0], fr[0]![1]), Frac.ONE.sub(p)], form);
      const steps = [
        `${sc.replace || single ? 'The events are independent' : 'The events are dependent'}: ${m(fr.map(([a, b]) => `\\frac{${a}}{${b}}`).join(' \\cdot '))}`,
        m(`${fr.map(([a, b]) => `\\frac{${a}}{${b}}`).join(' \\cdot ')} = ${num(p)}`),
      ];
      return {
        question: sc.question,
        answer,
        steps,
        distractors,
        check: { kind: `${PFX}.prob`, exp: expOf(sc), mentions: sc.mentions },
      };
    });
  };
}

const eventsOption = {
  type: 'select' as const,
  id: 'events',
  label: 'Events',
  default: 'any',
  choices: [
    { value: 'any', label: 'Independent and dependent' },
    { value: 'independent', label: 'Independent only' },
    { value: 'dependent', label: 'Dependent only' },
  ],
};

export const indepDepWord = defineTopic({
  id: 'alg2.prob.indep-dep-word',
  subject: 'algebra2',
  title: 'Probability of Independent and Dependent Events, Word Problems',
  description: 'Word problems on drawing with and without replacement, choosing people, and combining separate experiments.',
  category: 'Probability and Statistics',
  instruction: 'Find the probability.',
  multipleChoice: true,
  defaultCount: 6,
  options: [eventsOption, probFormOption],
  generate: indepDep('word'),
});

export const indepDep2 = defineTopic({
  id: 'alg2.prob.indep-dep',
  subject: 'algebra2',
  title: 'Probability of Independent and Dependent Events',
  description: 'Probabilities of successive events with dice, spinners, cards, marbles and letter tiles.',
  category: 'Probability and Statistics',
  instruction: 'Find the probability.',
  multipleChoice: true,
  defaultCount: 10,
  options: [eventsOption, probFormOption],
  generate: indepDep('plain'),
});

// ---------------------------------------------------------------- mutually exclusive / overlapping events

interface OrProblem {
  exp: (event: Ev) => Experiment;
  A: Ev;
  B: Ev;
  aLabel: string;
  bLabel: string;
  question: string;
  mentions: string[];
}

function catEv(c: Cat, at = 0): Ev {
  return { at, attr: c.attr, in: c.in };
}

function plainOr(rng: Rng, d: Difficulty): OrProblem {
  const P = (a: string, b: string) => m(`P(\\text{${a} or ${b}})`);
  const die = (): OrProblem => {
    const sides = d === 'easy' ? 6 : rng.pick([6, 8, 10, 12]);
    const [a, b] = rng.sample(numberCats(rng, sides), 2) as [Cat, Cat];
    const what = sides === 6 ? 'A die is rolled.' : `A spinner with ${sides} equal sections numbered 1 to ${sides} is spun.`;
    return { exp: (event) => ({ pools: { die: { die: sides } }, draws: ['die'], replace: true, event }), A: catEv(a), B: catEv(b), aLabel: a.short, bLabel: b.short, question: `${what} Find ${P(a.short, b.short)}.`, mentions: sides === 6 ? [] : [`1 to ${sides}`] };
  };
  const cards = (): OrProblem => {
    const [a, b] = rng.sample(cardCats(rng), 2) as [Cat, Cat];
    return { exp: (event) => ({ pools: { deck: { deck: true } }, draws: ['deck'], replace: true, event }), A: catEv(a), B: catEv(b), aLabel: a.short, bLabel: b.short, question: `A card is drawn from a standard deck. Find ${P(a.short, b.short)}.`, mentions: [] };
  };
  const twoDice = (): OrProblem => {
    const sumCat = (): [Ev, string] => {
      const s = rng.int(3, 11);
      return [{ sum: 'value', op: '=', value: s }, `sum of ${s}`];
    };
    const options: Array<() => [Ev, string]> = [sumCat, sumCat, () => [{ same: 'value' }, 'doubles'], () => {
      const s = rng.int(8, 10);
      return [{ sum: 'value', op: '>', value: s }, `sum greater than ${s}`];
    }, () => {
      const s = rng.int(4, 6);
      return [{ sum: 'value', op: '<', value: s }, `sum less than ${s}`];
    }];
    const [A, aL] = rng.pick(options)();
    const [B, bL] = rng.pick(options)();
    return { exp: (event) => ({ pools: { die: { die: 6 } }, draws: ['die', 'die'], replace: true, event }), A, B, aLabel: aL, bLabel: bL, question: `Two dice are rolled. Find ${P(aL, bL)}.`, mentions: [] };
  };
  const bag = (): OrProblem => {
    const colors = rng.sample(COLORS, rng.int(3, 4));
    const counts = colors.map(() => rng.int(1, 9));
    const [a, b] = rng.sample(colors, 2) as [string, string];
    return {
      exp: (event) => ({ pools: { bag: itemsOf(Object.fromEntries(colors.map((c, i) => [c, counts[i]!]))) }, draws: ['bag'], replace: true, event }),
      A: { at: 0, attr: 'kind', in: [a] },
      B: { at: 0, attr: 'kind', in: [b] },
      aLabel: a,
      bLabel: b,
      question: `A bag contains ${listing(colors.map((c, i) => [counts[i]!, c]))} marbles. One marble is drawn. Find ${P(a, b)}.`,
      mentions: colors.map((c, i) => `${counts[i]} ${c}`),
    };
  };
  return rng.pick(d === 'easy' ? [die, cards, bag] : [die, cards, twoDice, bag])();
}

const VENN: Array<[string, string, string]> = [
  ['students', 'play a sport', 'play an instrument'],
  ['students', 'take Spanish', 'take art'],
  ['families', 'have a dog', 'have a cat'],
  ['customers', 'bought coffee', 'bought a muffin'],
  ['members', 'like hiking', 'like swimming'],
  ['students', 'ride the bus', 'play in the band'],
];

const CLUB: Array<[string, string[]]> = [
  ['A school club', ['freshman', 'sophomore', 'junior', 'senior']],
  ['A sports camp', ['soccer player', 'basketball player', 'tennis player', 'swimmer']],
  ['A music festival lineup', ['rock band', 'jazz group', 'folk duo', 'pop act']],
  ['A science fair', ['biology project', 'chemistry project', 'physics project', 'robotics project']],
];

const plural = (w: string) => (w.endsWith('man') ? `${w.slice(0, -3)}men` : `${w}s`);
const an = (w: string) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);

function wordOr(rng: Rng, d: Difficulty): OrProblem {
  const [name] = names(rng, 1);
  const venn = (): OrProblem => {
    const [who, a, b] = rng.pick(VENN);
    const both = rng.bool(0.25) ? 0 : rng.int(2, 8);
    const aOnly = rng.int(3, 15);
    const bOnly = rng.int(3, 15);
    const neither = rng.int(1, 10);
    const total = both + aOnly + bOnly + neither;
    const pool: PoolSpec = {
      items: [
        { count: both, attrs: { a: 'y', b: 'y' } },
        { count: aOnly, attrs: { a: 'y', b: 'n' } },
        { count: bOnly, attrs: { a: 'n', b: 'y' } },
        { count: neither, attrs: { a: 'n', b: 'n' } },
      ].filter((x) => x.count > 0),
    };
    const one = who.slice(0, -1).replace(/ie$/, 'y');
    return {
      exp: (event) => ({ pools: { g: pool }, draws: ['g'], replace: true, event }),
      A: { at: 0, attr: 'a', in: ['y'] },
      B: { at: 0, attr: 'b', in: ['y'] },
      aLabel: a,
      bLabel: b,
      question: `Of the ${total} ${who} in a survey, ${aOnly + both} ${a}, ${bOnly + both} ${b}, and ${both === 0 ? 'none' : both} ${both === 1 ? 'does' : 'do'} both. One of the ${who} is chosen at random. What is the probability that the ${one} ${a.replace(/^(\w+)/, (w) => w)} or ${b}?`,
      mentions: [`${total} ${who}`, `${aOnly + both} ${a}`, `${bOnly + both} ${b}`],
    };
  };
  const club = (): OrProblem => {
    const [title, kinds] = rng.pick(CLUB);
    const counts = kinds.map(() => rng.int(3, 12));
    const [i, j] = rng.sample(range(0, kinds.length - 1), 2) as [number, number];
    return {
      exp: (event) => ({ pools: { g: itemsOf(Object.fromEntries(kinds.map((k, t) => [k, counts[t]!]))) }, draws: ['g'], replace: true, event }),
      A: { at: 0, attr: 'kind', in: [kinds[i]!] },
      B: { at: 0, attr: 'kind', in: [kinds[j]!] },
      aLabel: kinds[i]!,
      bLabel: kinds[j]!,
      question: `${title} includes ${listing(kinds.map((k, t) => [counts[t]!, plural(k)]))}. One is chosen at random to be featured. What is the probability that it is ${an(kinds[i]!)} or ${an(kinds[j]!)}?`,
      mentions: kinds.map((k, t) => `${counts[t]} ${plural(k)}`),
    };
  };
  const raffle = (): OrProblem => {
    const n = rng.pick([20, 24, 30, 36, 40, 48, 50, 60]);
    const [x, y] = rng.sample([2, 3, 4, 5, 6, 7, 9, 10], 2) as [number, number];
    const all = range(1, n);
    return {
      exp: (event) => ({ pools: { t: { items: all.map((v) => ({ count: 1, attrs: { value: v } })) } }, draws: ['t'], replace: true, event }),
      A: { at: 0, attr: 'value', in: all.filter((v) => v % x === 0) },
      B: { at: 0, attr: 'value', in: all.filter((v) => v % y === 0) },
      aLabel: `a multiple of ${x}`,
      bLabel: `a multiple of ${y}`,
      question: `Raffle tickets are numbered 1 to ${n}, and ${name} draws one at random. What is the probability that the number is a multiple of ${x} or a multiple of ${y}?`,
      mentions: [`1 to ${n}`],
    };
  };
  const cards = (): OrProblem => {
    const [a, b] = rng.sample(cardCats(rng), 2) as [Cat, Cat];
    return {
      exp: (event) => ({ pools: { deck: { deck: true } }, draws: ['deck'], replace: true, event }),
      A: catEv(a),
      B: catEv(b),
      aLabel: a.short,
      bLabel: b.short,
      question: `${name} draws one card from a standard deck. What is the probability that it is ${a.long} or ${b.long}?`,
      mentions: [],
    };
  };
  return rng.pick(d === 'easy' ? [club, cards, raffle] : [venn, club, raffle, cards, venn])();
}

function orTopic(style: 'plain' | 'word') {
  return (ctx: Parameters<Parameters<typeof defineTopic>[0]['generate']>[0]): ProblemContent => {
    const { rng, difficulty: d } = ctx;
    const form = probForm(ctx);
    const o = strOpt(ctx, 'overlap');
    return attempt('or-events', () => {
      const pr = style === 'plain' ? plainOr(rng, d) : wordOr(rng, d);
      if (pr.aLabel === pr.bLabel) return null;
      const pA = probability(pr.exp(pr.A));
      const pB = probability(pr.exp(pr.B));
      const pAB = probability(pr.exp({ and: [pr.A, pr.B] }));
      const p = probability(pr.exp({ or: [pr.A, pr.B] }));
      if (pA.isZero() || pB.isZero() || p.eq(1) || !p.eq(pA.add(pB).sub(pAB))) return null;
      if (pA.eq(pAB) || pB.eq(pAB)) return null; // one event contains the other
      const exclusive = pAB.isZero();
      if ((o === 'exclusive' && !exclusive) || (o === 'overlapping' && exclusive)) return null;
      if (o !== 'exclusive' && o !== 'overlapping' && d !== 'easy' && exclusive && rng.bool(0.4)) return null;
      const lab = (s: string) => `\\text{${s}}`;
      const steps = exclusive
        ? [
            'The events are mutually exclusive.',
            m(`P(${lab(pr.aLabel)}) + P(${lab(pr.bLabel)}) = ${num(pA)} + ${num(pB)} = ${num(p)}`),
          ]
        : [
            `The events overlap: ${m(`P(\\text{both}) = ${num(pAB)}`)}`,
            m(`${num(pA)} + ${num(pB)} - ${num(pAB)} = ${num(p)}`),
          ];
      const sum = pA.add(pB);
      const { answer, distractors } = probChoices(p, [exclusive ? null : sum, pA.mul(pB), exclusive ? sum.sub(pA.mul(pB)) : pAB, pA.cmp(pB) > 0 ? pA : pB, Frac.ONE.sub(p)], form);
      return {
        question: pr.question,
        answer,
        steps,
        distractors,
        check: { kind: `${PFX}.prob`, exp: pr.exp({ or: [pr.A, pr.B] }), mentions: pr.mentions },
      };
    });
  };
}

const overlapOption = {
  type: 'select' as const,
  id: 'overlap',
  label: 'Events',
  default: 'any',
  choices: [
    { value: 'any', label: 'Mutually exclusive and overlapping' },
    { value: 'exclusive', label: 'Mutually exclusive only' },
    { value: 'overlapping', label: 'Overlapping only' },
  ],
};

export const mutexWord = defineTopic({
  id: 'alg2.prob.mutex-word',
  subject: 'algebra2',
  title: 'Probability of Mutually Exclusive Events, Word Problems',
  description: 'Word problems on P(A or B) for mutually exclusive and overlapping events, including survey data.',
  category: 'Probability and Statistics',
  instruction: 'Find the probability.',
  multipleChoice: true,
  defaultCount: 6,
  options: [overlapOption, probFormOption],
  generate: orTopic('word'),
});

export const mutex = defineTopic({
  id: 'alg2.prob.mutex',
  subject: 'algebra2',
  title: 'Probability of Mutually Exclusive Events',
  description: 'Find P(A or B) with dice, spinners, cards and marbles, subtracting the overlap when events are not mutually exclusive.',
  category: 'Probability and Statistics',
  instruction: 'Find the probability.',
  multipleChoice: true,
  defaultCount: 10,
  options: [overlapOption, probFormOption],
  generate: orTopic('plain'),
});

// ---------------------------------------------------------------- probability with permutations and combinations

interface PcProblem {
  exp: Experiment;
  question: string;
  steps: string[];
  p: Frac;
  wrong: Frac[];
  mentions: string[];
}

const frac = (a: number, b: number) => new Frac(a, b);

function pcProblem(rng: Rng, d: Difficulty): PcProblem {
  const people = names(rng, 8);
  const committee = (): PcProblem => {
    const g = rng.pick(GROUPS);
    const a = rng.int(3, d === 'easy' ? 6 : 9);
    const b = rng.int(3, d === 'easy' ? 6 : 9);
    const k = rng.int(2, Math.min(d === 'easy' ? 3 : 5, a + b - 1));
    const atLeast = d === 'hard' && rng.bool(0.4);
    const j = rng.int(Math.max(atLeast ? 1 : 0, k - a), Math.min(b, k));
    const total = choose(a + b, k);
    const fav = atLeast ? total - choose(a, k) : choose(b, j) * choose(a, k - j);
    const ask = atLeast ? `at least one is ${an(g[2])}` : j === k ? `all ${k} are ${g[3]}` : j === 0 ? `all ${k} are ${g[1]}` : `exactly ${j} ${j === 1 ? `is ${an(g[2])}` : `are ${g[3]}`}`;
    const event: Ev = { count: { attr: 'kind', in: [g[2]] }, n: atLeast ? 1 : j, op: atLeast ? '>=' : '=' };
    return {
      exp: { pools: { p: itemsOf({ [g[0]]: a, [g[2]]: b }) }, draws: Array<string>(k).fill('p'), replace: false, event },
      question: `A committee of ${k} is chosen at random from ${a} ${g[1]} and ${b} ${g[3]}. What is the probability that ${ask}?`,
      steps: [
        atLeast
          ? m(`1 - \\frac{${combTex(a, k)}}{${combTex(a + b, k)}} = 1 - \\frac{${choose(a, k)}}{${total}}`)
          : m(`\\frac{${combTex(b, j)} \\cdot ${combTex(a, k - j)}}{${combTex(a + b, k)}} = \\frac{${choose(b, j)} \\cdot ${choose(a, k - j)}}{${total}}`),
        m(num(frac(fav, total))),
      ],
      p: frac(fav, total),
      wrong: [frac(choose(b, j), total), frac(Math.max(1, j) * choose(a + b - 1, k - 1), total * k), frac(j || 1, k + 1), frac(choose(b, Math.max(j, 1)), choose(a + b, Math.max(j, 1)))],
      mentions: [`committee of ${k}`, `${a} ${g[1]}`, `${b} ${g[3]}`],
    };
  };
  const lineup = (): PcProblem => {
    const n = rng.int(4, d === 'easy' ? 5 : 6);
    const who = people.slice(0, n);
    const [x, y] = [who[0]!, who[1]!];
    const kind = rng.pick(['first', 'firstSecond', 'ends'] as const);
    const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
    const event: Ev =
      kind === 'first'
        ? { at: 0, attr: 'name', in: [x] }
        : kind === 'firstSecond'
          ? { and: [{ at: 0, attr: 'name', in: [x] }, { at: 1, attr: 'name', in: [y] }] }
          : { and: [{ at: 0, attr: 'name', in: [x] }, { at: n - 1, attr: 'name', in: [y] }] };
    const favN = kind === 'first' ? fact(n - 1) : fact(n - 2);
    const shuffled = rng.shuffle(who);
    const ask = kind === 'first' ? `${x} is first in line` : kind === 'firstSecond' ? `${x} is first and ${y} is second` : `${x} is first and ${y} is last`;
    return {
      exp: { pools: { p: { items: who.map((w) => ({ count: 1, attrs: { name: w } })) } }, draws: Array<string>(n).fill('p'), replace: false, event },
      question: `${shuffled.slice(0, -1).join(', ')} and ${shuffled.at(-1)} line up in a random order. What is the probability that ${ask}?`,
      steps: [m(`\\frac{${kind === 'first' ? n - 1 : n - 2}!}{${n}!} = \\frac{${favN}}{${fact(n)}}`), m(num(frac(favN, fact(n))))],
      p: frac(favN, fact(n)),
      wrong: [frac(1, n), frac(2, fact(n)), frac(1, n * n), frac(1, choose(n, 2)), frac(1, fact(n))],
      mentions: who,
    };
  };
  const lottery = (): PcProblem => {
    const r = rng.int(3, d === 'easy' ? 3 : d === 'medium' ? 4 : 5);
    const n = rng.int(r + 7, d === 'easy' ? 15 : d === 'medium' ? 25 : 40);
    const exact = d === 'hard' && rng.bool(0.5) ? rng.int(1, r - 1) : r;
    const total = choose(n, r);
    const fav = choose(r, exact) * choose(n - r, r - exact);
    const event: Ev = { count: { attr: 'kind', in: ['mine'] }, n: exact };
    return {
      exp: { pools: { b: itemsOf({ mine: r, other: n - r }) }, draws: Array<string>(r).fill('b'), replace: false, event },
      question: `In a game, ${r} different numbers from 1 to ${n} are drawn at random. ${people[0]} picks ${r} numbers. What is the probability that ${exact === r ? 'all of them are drawn' : `exactly ${exact} of them ${exact === 1 ? 'is' : 'are'} drawn`}?`,
      steps: [exact === r ? m(`\\frac{1}{${combTex(n, r)}} = \\frac{1}{${total}}`) : m(`\\frac{${combTex(r, exact)} \\cdot ${combTex(n - r, r - exact)}}{${combTex(n, r)}} = \\frac{${fav}}{${total}}`), m(num(frac(fav, total)))],
      p: frac(fav, total),
      wrong: [frac(1, n ** r > 1e9 ? total * 2 : n ** r), frac(fav, total * 6 > 9e15 ? total : choose(n, r) * (r > 1 ? r : 2)), frac(r, n), frac(choose(r, exact), total)],
      mentions: [`1 to ${n}`, `picks ${r} numbers`],
    };
  };
  const cards = (): PcProblem => {
    const k = rng.int(2, d === 'easy' ? 2 : 3);
    const c = rng.pick(cardCats(rng).slice(0, 3));
    const size = c.attr === 'rank' ? c.in.length * 4 : 13;
    const total = choose(52, k);
    const fav = choose(size, k);
    const label = c.short === 'face card' ? 'face cards' : `${c.short}s`;
    return {
      exp: { pools: { deck: { deck: true } }, draws: Array<string>(k).fill('deck'), replace: false, event: { count: { attr: c.attr, in: c.in }, n: k } },
      question: `${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)} cards are dealt at random from a standard deck. What is the probability that ${k === 2 ? 'both' : 'all three'} are ${label}?`,
      steps: [m(`\\frac{${combTex(size, k)}}{${combTex(52, k)}} = \\frac{${fav}}{${total}}`), m(num(frac(fav, total)))],
      p: frac(fav, total),
      wrong: [frac(size, 52).pow(k), frac(size * k, 52), frac(fav, choose(52, k - 1) * 52), frac(size, 52)],
      mentions: [],
    };
  };
  const word = (): PcProblem => {
    const w = rng.pick(d === 'easy' ? ['MATH', 'CAT', 'STAR', 'FROG', 'BLUE', 'LION'] : ['TOOTH', 'APPLE', 'BANANA', 'LETTER', 'PEPPER', 'CHEESE', 'GOOSE', 'PUZZLE', 'HAPPY', 'SCHOOL']);
    const counts: Record<string, number> = {};
    for (const ch of w) counts[ch] = (counts[ch] ?? 0) + 1;
    const fact = (k: number): number => (k <= 1 ? 1 : k * fact(k - 1));
    const distinct = Object.values(counts).reduce((acc, k) => acc / fact(k), fact(w.length));
    return {
      exp: {
        pools: { t: itemsOf(counts, 'letter') },
        draws: Array<string>(w.length).fill('t'),
        replace: false,
        event: { and: [...w].map((ch, i): Ev => ({ at: i, attr: 'letter', in: [ch] })) },
      },
      question: `The letter tiles of the word ${w} are shuffled and placed in a row at random. What is the probability that they spell ${w}?`,
      steps: [m(`\\text{arrangements} = ${distinct}`), m(num(frac(1, distinct)))],
      p: frac(1, distinct),
      wrong: [frac(1, fact(w.length)), frac(1, w.length), frac(1, w.length * w.length), frac(2, distinct)],
      mentions: [],
    };
  };
  const pair = (): PcProblem => {
    const n = rng.int(6, d === 'easy' ? 8 : 12);
    const k = rng.int(2, Math.min(4, n - 2));
    const [x, y] = [people[0]!, people[1]!];
    const total = choose(n, k);
    const fav = choose(n - 2, k - 2);
    return {
      exp: { pools: { p: itemsOf({ [x]: 1, [y]: 1, other: n - 2 }, 'name') }, draws: Array<string>(k).fill('p'), replace: false, event: { count: { attr: 'name', in: [x, y] }, n: 2 } },
      question: `A group of ${k} students is chosen at random from a class of ${n}, which includes ${x} and ${y}. What is the probability that both ${x} and ${y} are chosen?`,
      steps: [m(`\\frac{${combTex(n - 2, k - 2)}}{${combTex(n, k)}} = \\frac{${fav}}{${total}}`), m(num(frac(fav, total)))],
      p: frac(fav, total),
      wrong: [frac(k, n).pow(2), frac(1, total), frac(k, n), frac(2, n)],
      mentions: [`${k} students`, `class of ${n}`],
    };
  };
  return rng.pick(d === 'easy' ? [committee, lineup, word, cards] : [committee, lineup, lottery, cards, word, pair])();
}

export const permCombProbability = defineTopic({
  id: 'alg2.prob.perm-comb',
  subject: 'algebra2',
  title: 'Probability with Permutations and Combinations',
  description: 'Use counts of arrangements and selections to find probabilities: committees, line-ups, lotteries, cards and letter tiles.',
  category: 'Probability and Statistics',
  instruction: 'Find the probability.',
  multipleChoice: true,
  defaultCount: 8,
  options: [probFormOption],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const form = probForm(ctx);
    return attempt('perm-comb-prob', () => {
      const pr = pcProblem(rng, d);
      if (pr.p.isZero() || pr.p.eq(1)) return null;
      if (form !== 'fraction' && pr.p.value < 1e-6) return null;
      const { answer, distractors } = probChoices(pr.p, [...pr.wrong, Frac.ONE.sub(pr.p)], form);
      return {
        question: pr.question,
        answer,
        steps: pr.steps,
        distractors,
        check: { kind: `${PFX}.prob`, exp: pr.exp, mentions: pr.mentions },
      };
    });
  },
});
