/** Counting: sample spaces, the Fundamental Counting Principle, permutations and combinations. */
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { bigNum, choose, combTex, fallingFactorial, names, permTex, WORDS } from './common';

const PFX = 'alg2-sequences-probability';

export type CountMode = 'repeat' | 'perm' | 'comb';
export interface Factor {
  n: number;
  k: number;
  mode: CountMode;
}

export const factorValue = (f: Factor): number => (f.mode === 'repeat' ? f.n ** f.k : f.mode === 'perm' ? fallingFactorial(f.n, f.k) : choose(f.n, f.k));
const product = (fs: readonly Factor[]) => fs.reduce((p, f) => p * factorValue(f), 1);
const numAns = (n: number) => m(bigNum(n));

const fact = (n: number) => fallingFactorial(n, n);

// ---------------------------------------------------------------- sample spaces & FCP

interface Space {
  question: string;
  stages: string[][];
  sep: string;
  mentions: string[];
}

const COLORS: Array<[string, string]> = [
  ['red', 'R'],
  ['blue', 'B'],
  ['green', 'G'],
  ['yellow', 'Y'],
  ['purple', 'P'],
  ['orange', 'O'],
];

function pickSpace(rng: Rng, d: Difficulty): Space {
  const coin = ['H', 'T'];
  const opts: Array<() => Space> = [
    () => {
      const k = d === 'easy' ? 2 : 3;
      return { question: `A coin is tossed ${WORDS[k]} times. Use H for heads and T for tails.`, stages: Array.from({ length: k }, () => coin), sep: '', mentions: [] };
    },
    () => {
      const cs = rng.sample(COLORS, d === 'easy' ? 2 : rng.int(3, 4));
      const listed = cs.map((c) => c[0]);
      return {
        question: `A coin is tossed and a spinner with equal sections colored ${listed.slice(0, -1).join(', ')} and ${listed.at(-1)} is spun. Use H or T, then the first letter of the color.`,
        stages: [coin, cs.map((c) => c[1])],
        sep: '',
        mentions: listed,
      };
    },
    () => {
      const k = d === 'easy' ? 2 : 3;
      return { question: `A family has ${WORDS[k]} children. Use B for a boy and G for a girl, oldest child first.`, stages: Array.from({ length: k }, () => ['B', 'G']), sep: '', mentions: [] };
    },
    () => {
      const top = rng.int(2, d === 'easy' ? 3 : 4);
      const letters = ['A', 'B', 'C', 'D'].slice(0, d === 'easy' ? 2 : rng.int(2, 3));
      return {
        question: `A spinner numbered 1 to ${top} is spun and then a card is drawn from cards labeled ${letters.join(', ')}. Write each outcome as the number followed by the letter.`,
        stages: [Array.from({ length: top }, (_, i) => String(i + 1)), letters],
        sep: '',
        mentions: [`1 to ${top}`, ...letters],
      };
    },
    () => {
      const breads = rng.sample(['wheat', 'rye', 'white', 'sourdough'], d === 'easy' ? 2 : rng.int(2, 3));
      const fills = rng.sample(['ham', 'turkey', 'tuna', 'veggie', 'egg'], d === 'easy' ? 2 : rng.int(2, 3));
      const name = rng.pick(['A deli', 'A cafe', 'A food truck', 'The school cafeteria']);
      return {
        question: `${name} makes sandwiches on ${breads.join(', ')} bread with a ${fills.join(', ')} filling. Write each outcome as bread-filling.`,
        stages: [breads, fills],
        sep: '-',
        mentions: [...breads, ...fills],
      };
    },
  ];
  if (d !== 'easy') {
    opts.push(() => ({ question: 'A coin is tossed and a die is rolled. Write each outcome as H or T followed by the number.', stages: [coin, ['1', '2', '3', '4', '5', '6']], sep: '', mentions: ['die'] }));
  }
  return rng.pick(opts)();
}

function cartesian(stages: string[][], sep: string): string[] {
  return stages.reduce<string[]>((acc, st) => acc.flatMap((a) => st.map((s) => (a === '' ? s : `${a}${sep}${s}`))), ['']);
}

interface FcpProblem {
  question: string;
  factors: Factor[];
  mentions: string[];
}

function pickFcp(rng: Rng, d: Difficulty): FcpProblem {
  const name = names(rng, 1)[0]!;
  const lim = d === 'easy' ? 8 : d === 'medium' ? 10 : 14;
  const sizes = (k: number) => Array.from({ length: k }, () => rng.int(2, lim));
  const menus: Array<() => FcpProblem> = [
    () => {
      const [a, b, c] = sizes(3);
      return {
        question: `A diner offers ${a} appetizers, ${b} main courses and ${c} desserts. How many different meals of one appetizer, one main course and one dessert are possible?`,
        factors: [a!, b!, c!].map((n) => ({ n, k: 1, mode: 'repeat' as const })),
        mentions: [`${a} appetizers`, `${b} main courses`, `${c} desserts`],
      };
    },
    () => {
      const k = d === 'easy' ? 2 : 3;
      const parts = ['shirts', 'pairs of pants', 'pairs of shoes'].slice(0, k);
      const ns = sizes(k);
      return {
        question: `${name} has ${parts.map((p, i) => `${ns[i]} ${p}`).join(k === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1')}. How many different outfits of one of each can ${name} make?`,
        factors: ns.map((n) => ({ n, k: 1, mode: 'repeat' as const })),
        mentions: parts.map((p, i) => `${ns[i]} ${p}`),
      };
    },
    () => {
      const [a, b] = sizes(2);
      const towns = rng.sample(['Ashford', 'Brookline', 'Cedar Falls', 'Dunmore', 'Elmwood', 'Fairview'], 3);
      return {
        question: `There are ${a} roads from ${towns[0]} to ${towns[1]} and ${b} roads from ${towns[1]} to ${towns[2]}. How many different routes go from ${towns[0]} to ${towns[2]} through ${towns[1]}?`,
        factors: [a!, b!].map((n) => ({ n, k: 1, mode: 'repeat' as const })),
        mentions: [`${a} roads`, `${b} roads`],
      };
    },
    () => {
      const [a, b, c] = sizes(3);
      return {
        question: `A new bike comes in ${a} colors, ${b} frame sizes and ${c} styles of seat. How many different bikes can be ordered?`,
        factors: [a!, b!, c!].map((n) => ({ n, k: 1, mode: 'repeat' as const })),
        mentions: [`${a} colors`, `${b} frame sizes`, `${c} styles`],
      };
    },
  ];
  const codes: Array<() => FcpProblem> = [
    () => {
      const k = rng.int(3, d === 'hard' ? 6 : 4);
      const rep = rng.bool();
      return {
        question: `A PIN is made of ${k} digits (0–9). How many PINs are possible if digits ${rep ? 'may' : 'may not'} be repeated?`,
        factors: [{ n: 10, k, mode: rep ? 'repeat' : 'perm' }],
        mentions: [`${k} digits`],
      };
    },
    () => {
      const q = rng.int(5, d === 'hard' ? 12 : 8);
      const tf = rng.bool();
      const c = tf ? 2 : rng.int(3, 5);
      return {
        question: tf
          ? `A quiz has ${q} true-or-false questions. In how many different ways can all the questions be answered?`
          : `A quiz has ${q} multiple-choice questions with ${c} choices each. In how many different ways can all the questions be answered?`,
        factors: [{ n: c, k: q, mode: 'repeat' }],
        mentions: tf ? [`${q} true-or-false`] : [`${q} multiple-choice`, `${c} choices`],
      };
    },
    () => {
      const digits = rng.int(5, 9);
      const k = rng.int(2, 4);
      const rep = rng.bool();
      return {
        question: `How many ${k}-digit numbers can be made from the digits 1 to ${digits} if digits ${rep ? 'can' : 'cannot'} be repeated?`,
        factors: [{ n: digits, k, mode: rep ? 'repeat' : 'perm' }],
        mentions: [`${k}-digit`, `1 to ${digits}`],
      };
    },
  ];
  if (d === 'hard') {
    codes.push(() => {
      const L = rng.int(2, 3);
      const D = rng.int(3, 4);
      const rep = rng.bool();
      return {
        question: `A license plate has ${L} letters followed by ${D} digits. How many plates are possible if letters and digits ${rep ? 'may' : 'may not'} be repeated?`,
        factors: [
          { n: 26, k: L, mode: rep ? 'repeat' : 'perm' },
          { n: 10, k: D, mode: rep ? 'repeat' : 'perm' },
        ],
        mentions: [`${L} letters`, `${D} digits`],
      };
    });
  }
  return d === 'easy' ? rng.pick(menus)() : rng.pick([...menus, ...codes, ...codes])();
}

export const countingPrinciple = defineTopic({
  id: 'alg2.prob.counting',
  subject: 'algebra2',
  title: 'Sample Spaces and the Fundamental Counting Principle',
  description: 'List sample spaces of simple experiments and count outcomes with the Fundamental Counting Principle.',
  category: 'Probability and Statistics',
  instruction: (o) => (o.task === 'list' ? 'List the sample space and give the number of outcomes.' : o.task === 'count' ? 'Use the Fundamental Counting Principle.' : 'Answer each question.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'list', label: 'List the sample space' },
        { value: 'count', label: 'Fundamental Counting Principle' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'list' || tOpt === 'count' ? tOpt : rng.bool(d === 'hard' ? 0.3 : 0.5) ? 'list' : 'count';
    if (task === 'list') {
      const sp = attempt('space', () => {
        const s = pickSpace(rng, d);
        return cartesian(s.stages, s.sep).length > 12 ? null : s;
      });
      const all = cartesian(sp.stages, sp.sep);
      const show = (xs: string[], n = xs.length) => `${xs.join(', ')}; ${m(String(n))} outcomes`;
      const answer = show(all);
      const sizes = sp.stages.map((s) => s.length);
      const additive = sizes.reduce((a, b) => a + b, 0);
      const firstStages = cartesian(sp.stages.slice(0, -1), sp.sep);
      return {
        question: sp.question,
        answer,
        steps: [m(`${sizes.join(' \\cdot ')} = ${all.length}`), answer],
        distractors: distinctDistractors(answer, [show(all.slice(0, -1)), additive < all.length ? show(all.slice(0, additive)) : null, show(firstStages)], (k) => show(all.slice(0, Math.max(1, all.length - 1 - k)))),
        check: { kind: `${PFX}.space`, stages: sp.stages, sep: sp.sep, mentions: sp.mentions },
      };
    }
    const pr = pickFcp(rng, d);
    const total = product(pr.factors);
    const answer = numAns(total);
    const ns = pr.factors.flatMap((f) => (f.mode === 'repeat' ? Array<number>(f.k).fill(f.n) : Array.from({ length: f.k }, (_, i) => f.n - i)));
    const sumWrong = ns.reduce((a, b) => a + b, 0);
    const flipped = pr.factors.reduce((p, f) => p * factorValue({ ...f, mode: f.mode === 'repeat' ? 'perm' : 'repeat' }), 1);
    const nk = pr.factors.reduce((p, f) => p * f.n * f.k, 1);
    return {
      question: pr.question,
      answer,
      steps: [m(`${ns.join(' \\cdot ')} = ${bigNum(total)}`)],
      distractors: distinctDistractors(answer, [numAns(sumWrong), flipped > 0 ? numAns(flipped) : null, numAns(nk)], (k) => numAns(total + offset(k))),
      check: { kind: `${PFX}.count`, factors: pr.factors, mentions: pr.mentions },
    };
  },
});

// ---------------------------------------------------------------- permutations

interface Ctx {
  question: string;
  n: number;
  r: number;
  mode: 'perm' | 'comb';
  mentions: string[];
}

const ROLES = ['president', 'vice president', 'secretary', 'treasurer'];

function permContext(rng: Rng, d: Difficulty): Ctx {
  const [name] = names(rng, 1);
  const N = d === 'easy' ? 8 : d === 'medium' ? 12 : 20;
  const opts: Array<() => Ctx> = [
    () => {
      const n = rng.int(5, N);
      const r = rng.int(2, 3);
      const places = r === 2 ? 'first and second place' : 'first, second and third place';
      return { question: `${n} runners compete in a race. In how many different ways can ${places} be awarded?`, n, r, mode: 'perm', mentions: [`${n} runners`] };
    },
    () => {
      const n = rng.int(6, N + 4);
      const r = rng.int(2, 4);
      const roles = ROLES.slice(0, r);
      return { question: `A club with ${n} members elects a ${roles.slice(0, -1).join(', ')} and ${roles.at(-1)}. In how many different ways can the offices be filled?`, n, r, mode: 'perm', mentions: [`${n} members`] };
    },
    () => {
      const n = rng.int(3, d === 'easy' ? 6 : 9);
      return { question: `In how many different ways can ${n} different books be arranged on a shelf?`, n, r: n, mode: 'perm', mentions: [`${n} different books`] };
    },
    () => {
      const n = rng.int(5, N);
      const r = rng.int(2, Math.min(5, n - 1));
      return { question: `${name} has ${n} favorite songs and makes a playlist of ${r} of them in a particular order. How many different playlists are possible?`, n, r, mode: 'perm', mentions: [`${n} favorite songs`, `${r} of them`] };
    },
    () => {
      const n = rng.int(6, N + 2);
      const r = rng.int(3, Math.min(6, n - 1));
      return { question: `A photographer lines up ${r} of ${n} students in a row for a picture. How many different arrangements are possible?`, n, r, mode: 'perm', mentions: [`${r} of ${n} students`] };
    },
    () => {
      const n = rng.int(6, N + 2);
      const r = rng.int(2, Math.min(5, n - 1));
      return { question: `A coach chooses a batting order for ${r} of the ${n} players on a team. How many batting orders are possible?`, n, r, mode: 'perm', mentions: [`${r} of the ${n} players`] };
    },
  ];
  return rng.pick(opts)();
}

function combContext(rng: Rng, d: Difficulty): Ctx {
  const [name] = names(rng, 1);
  const N = d === 'easy' ? 9 : d === 'medium' ? 15 : 30;
  const opts: Array<() => Ctx> = [
    () => {
      const n = rng.int(5, N);
      const r = rng.int(2, Math.min(5, n - 1));
      return { question: `In how many ways can a committee of ${r} be chosen from ${n} people?`, n, r, mode: 'comb', mentions: [`committee of ${r}`, `${n} people`] };
    },
    () => {
      const n = rng.int(6, Math.min(N, 16));
      const r = rng.int(2, 4);
      return { question: `A pizzeria offers ${n} toppings. How many different pizzas with ${r} different toppings are possible?`, n, r, mode: 'comb', mentions: [`${n} toppings`, `${r} different toppings`] };
    },
    () => {
      const n = rng.int(5, Math.min(N, 14));
      const r = rng.int(2, Math.min(5, n - 1));
      return { question: `${name} wants to take ${r} of ${n} books on vacation. How many different groups of books can ${name} take?`, n, r, mode: 'comb', mentions: [`${r} of ${n} books`] };
    },
    () => {
      const n = rng.int(4, Math.min(N, 25));
      return { question: `${n} people meet, and each person shakes hands once with each other person. How many handshakes take place?`, n, r: 2, mode: 'comb', mentions: [`${n} people`] };
    },
    () => {
      const n = rng.int(6, Math.min(N, 12));
      const r = rng.int(2, n - 2);
      return { question: `A test has ${n} essay questions and students must answer ${r} of them. How many different sets of questions can a student choose?`, n, r, mode: 'comb', mentions: [`${n} essay questions`, `${r} of them`] };
    },
    () => {
      const n = rng.int(10, Math.max(12, N + 10));
      const r = rng.int(3, d === 'easy' ? 3 : 5);
      return { question: `A lottery draws ${r} numbers from 1 to ${n}, in any order. How many different draws are possible?`, n, r, mode: 'comb', mentions: [`${r} numbers`, `1 to ${n}`] };
    },
  ];
  return rng.pick(opts)();
}

export const permutations = defineTopic({
  id: 'alg2.prob.permutations',
  subject: 'algebra2',
  title: 'Permutations',
  description: 'Evaluate nPr, count ordered arrangements, and count arrangements of letters (with repeated letters on hard).',
  category: 'Probability and Statistics',
  instruction: (o) => (o.task === 'evaluate' ? 'Evaluate each expression.' : 'Answer each question.'),
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
        { value: 'evaluate', label: 'Evaluate nPr' },
        { value: 'word', label: 'Word problems' },
        { value: 'letters', label: 'Arrangements of letters' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'evaluate' || tOpt === 'word' || tOpt === 'letters' ? tOpt : rng.pick(['evaluate', 'word', 'letters'] as const);
    if (task === 'evaluate') {
      const pick = () => {
        const n = rng.int(d === 'easy' ? 3 : 5, d === 'easy' ? 7 : d === 'medium' ? 10 : 14);
        return [n, rng.int(1, Math.min(n, d === 'easy' ? 4 : 5))] as const;
      };
      const [n, r] = pick();
      const two = d === 'hard' && rng.bool(0.4);
      const [n2, r2] = two ? ([rng.int(3, 7), rng.int(1, 3)] as const) : [0, 0];
      const value = fallingFactorial(n, r) * (two ? fallingFactorial(n2, r2) : 1);
      const qTex = two ? `${permTex(n, r)} \\cdot ${permTex(n2, r2)}` : permTex(n, r);
      const answer = numAns(value);
      const factors = (a: number, b: number) => Array.from({ length: b }, (_, i) => a - i).join(' \\cdot ');
      return {
        question: m(qTex),
        answer,
        steps: [m(`${permTex(n, r)} = \\frac{${n}!}{${n - r}!} = ${factors(n, r)} = ${bigNum(fallingFactorial(n, r))}`), ...(two ? [m(`${permTex(n2, r2)} = ${bigNum(fallingFactorial(n2, r2))}`)] : []), answer],
        distractors: distinctDistractors(
          answer,
          [numAns(choose(n, r) * (two ? choose(n2, r2) : 1)), numAns(n ** r * (two ? n2 ** r2 : 1)), numAns(Math.round(fact(n) / fact(r)) * (two ? fallingFactorial(n2, r2) : 1)), numAns(fallingFactorial(n, r - 1))],
          (k) => numAns(value + offset(k)),
        ),
        check: { kind: `${PFX}.countExpr` },
      };
    }
    if (task === 'word') {
      const c = permContext(rng, d);
      const value = fallingFactorial(c.n, c.r);
      const answer = numAns(value);
      return {
        question: c.question,
        answer,
        steps: [m(c.r === c.n ? `${c.n}! = ${bigNum(value)}` : `${permTex(c.n, c.r)} = ${Array.from({ length: c.r }, (_, i) => c.n - i).join(' \\cdot ')} = ${bigNum(value)}`)],
        distractors: distinctDistractors(answer, [numAns(choose(c.n, c.r)), numAns(c.n ** c.r), numAns(c.n * c.r), numAns(fallingFactorial(c.n, c.r - 1))], (k) => numAns(value + offset(k))),
        check: { kind: `${PFX}.count`, factors: [{ n: c.n, k: c.r, mode: 'perm' }], mentions: c.mentions },
      };
    }
    return lettersProblem(rng, d);
  },
});

const DISTINCT_WORDS = ['MATH', 'GRAPH', 'PLANET', 'FRIEND', 'CHAIR', 'TIGER', 'LEMON', 'WATER', 'BRICK', 'CLOUD', 'HORSE', 'JUMP', 'PIANO', 'MOUSE', 'QUEST', 'FLOWER', 'GARDEN', 'SILVER', 'PRISM', 'ANGLE', 'OCEAN', 'TRAIN', 'ZEBRA', 'DANCE', 'NUMBER', 'POCKET', 'MARKET', 'CANDY', 'SHAPE', 'FROG', 'BLUE', 'STAR'];
const ONE_REPEAT = ['APPLE', 'COOKIE', 'SCHOOL', 'ALGEBRA', 'PUZZLE', 'CIRCLE', 'RABBIT', 'HAPPY', 'CHEESE', 'KITTEN', 'BUTTER', 'SUMMER', 'DOLLAR', 'GALAXY', 'BANNER', 'PARROT', 'HELLO', 'CANYON', 'LETTUCE', 'BALLET', 'GEOMETRY', 'ELEVEN', 'PEPPY', 'GOOSE', 'COFFEE', 'ARRAY', 'SPEED', 'TOOTH'];
const MANY_REPEATS = ['BANANA', 'PEPPER', 'LETTER', 'BALLOON', 'TOMATO', 'LLAMA', 'MISSISSIPPI', 'TENNESSEE', 'STATISTICS', 'COMMITTEE', 'BOOKKEEPER', 'ASSESS', 'CALCULUS', 'ADDRESS', 'PARALLEL', 'MAMMAL', 'ACCESSES', 'NINETEEN', 'REFEREE', 'DIVIDED', 'COCOON', 'GOOGOL', 'BOOKSHOP', 'POSSESSES', 'TATTOO', 'CINCINNATI', 'ALABAMA', 'HAWAII', 'BEEKEEPER'];

function letterCounts(word: string): Map<string, number> {
  const c = new Map<string, number>();
  for (const ch of word) c.set(ch, (c.get(ch) ?? 0) + 1);
  return c;
}

export function arrangements(word: string): number {
  const counts = [...letterCounts(word).values()];
  return Math.round(counts.reduce((acc, k) => acc / fact(k), fact(word.length)));
}

function lettersProblem(rng: Rng, d: Difficulty): ProblemContent {
  const pool = d === 'easy' ? DISTINCT_WORDS : d === 'medium' ? (rng.bool(0.25) ? DISTINCT_WORDS : ONE_REPEAT) : rng.bool(0.25) ? ONE_REPEAT : MANY_REPEATS;
  const word = rng.pick(pool);
  const counts = [...letterCounts(word).entries()].filter(([, k]) => k > 1);
  const n = word.length;
  if (counts.length === 0 && rng.bool(0.5)) {
    const r = rng.int(2, Math.min(4, n - 1));
    const value = fallingFactorial(n, r);
    const answer = numAns(value);
    return {
      question: `How many different ${r}-letter arrangements can be made from the letters of the word ${word} if no letter is used more than once?`,
      answer,
      steps: [m(`${permTex(n, r)} = ${Array.from({ length: r }, (_, i) => n - i).join(' \\cdot ')} = ${value}`)],
      distractors: distinctDistractors(answer, [numAns(choose(n, r)), numAns(n ** r), numAns(fact(n))], (k) => numAns(value + offset(k))),
      check: { kind: `${PFX}.letters`, r },
    };
  }
  const value = arrangements(word);
  const answer = numAns(value);
  const denom = counts.map(([, k]) => `${k}!`).join(' \\cdot ');
  const partial = counts.length > 1 ? Math.round(fact(n) / fact(counts[0]![1])) : fact(n) / 2;
  return {
    question: `How many different arrangements of the letters in the word ${word} are possible?`,
    answer,
    steps: counts.length ? [m(`\\frac{${n}!}{${denom}} = ${bigNum(value)}`)] : [m(`${n}! = ${bigNum(value)}`)],
    distractors: distinctDistractors(answer, [numAns(fact(n)), Number.isInteger(partial) ? numAns(partial) : null, numAns(fact(n - 1)), numAns(n * n)], (k) => numAns(value + offset(k))),
    check: { kind: `${PFX}.letters`, r: n },
  };
}

// ---------------------------------------------------------------- combinations

export const combinations = defineTopic({
  id: 'alg2.prob.combinations',
  subject: 'algebra2',
  title: 'Combinations',
  description: 'Evaluate nCr and count unordered selections such as committees, toppings and hands of cards.',
  category: 'Probability and Statistics',
  instruction: (o) => (o.task === 'evaluate' ? 'Evaluate each expression.' : 'Answer each question.'),
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
        { value: 'evaluate', label: 'Evaluate nCr' },
        { value: 'word', label: 'Word problems' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'evaluate' || tOpt === 'word' ? tOpt : rng.pick(['evaluate', 'word'] as const);
    if (task === 'evaluate') {
      const n = rng.int(d === 'easy' ? 3 : 6, d === 'easy' ? 8 : d === 'medium' ? 12 : 16);
      const r = rng.int(1, Math.min(n - 1, d === 'easy' ? 4 : 7));
      const two = d === 'hard' && rng.bool(0.4);
      const n2 = two ? rng.int(4, 8) : 0;
      const r2 = two ? rng.int(1, 3) : 0;
      const value = choose(n, r) * (two ? choose(n2, r2) : 1);
      const binom = d !== 'easy' && rng.bool(0.25);
      const cTex = (a: number, b: number) => (binom ? `\\binom{${a}}{${b}}` : combTex(a, b));
      const answer = numAns(value);
      return {
        question: m(two ? `${cTex(n, r)} \\cdot ${cTex(n2, r2)}` : cTex(n, r)),
        answer,
        steps: [m(`${cTex(n, r)} = \\frac{${n}!}{${r}! \\cdot ${n - r}!} = ${bigNum(choose(n, r))}`), ...(two ? [m(`${cTex(n2, r2)} = ${choose(n2, r2)}`)] : []), answer],
        distractors: distinctDistractors(
          answer,
          [numAns(fallingFactorial(n, r) * (two ? fallingFactorial(n2, r2) : 1)), numAns(choose(n, r - 1) * (two ? choose(n2, r2) : 1)), numAns(choose(n, r + 1) * (two ? choose(n2, r2) : 1)), two ? numAns(choose(n, r) + choose(n2, r2)) : numAns(n * r)],
          (k) => numAns(value + offset(k)),
        ),
        check: { kind: `${PFX}.countExpr` },
      };
    }
    if (d === 'hard' && rng.bool(0.4)) {
      const groups = rng.pick([
        ['teachers', 'students'],
        ['juniors', 'seniors'],
        ['engineers', 'designers'],
        ['sopranos', 'altos'],
      ]);
      const n1 = rng.int(5, 12);
      const n2 = rng.int(5, 12);
      const r1 = rng.int(2, 4);
      const r2 = rng.int(2, 4);
      const value = choose(n1, r1) * choose(n2, r2);
      const answer = numAns(value);
      return {
        question: `A committee of ${r1} ${groups[0]} and ${r2} ${groups[1]} is chosen from ${n1} ${groups[0]} and ${n2} ${groups[1]}. How many different committees are possible?`,
        answer,
        steps: [m(`${combTex(n1, r1)} \\cdot ${combTex(n2, r2)} = ${choose(n1, r1)} \\cdot ${choose(n2, r2)} = ${bigNum(value)}`)],
        distractors: distinctDistractors(answer, [numAns(choose(n1, r1) + choose(n2, r2)), numAns(choose(n1 + n2, r1 + r2)), numAns(fallingFactorial(n1, r1) * fallingFactorial(n2, r2))], (k) => numAns(value + offset(k))),
        check: {
          kind: `${PFX}.count`,
          factors: [
            { n: n1, k: r1, mode: 'comb' },
            { n: n2, k: r2, mode: 'comb' },
          ],
          mentions: [`${n1} ${groups[0]}`, `${n2} ${groups[1]}`, `${r1} ${groups[0]}`, `${r2} ${groups[1]}`],
        },
      };
    }
    if (d === 'hard' && rng.bool(0.25)) {
      const r = rng.int(2, 5);
      const value = choose(52, r);
      const answer = numAns(value);
      return {
        question: `How many different ${r}-card hands can be dealt from a standard 52-card deck?`,
        answer,
        steps: [m(`${combTex(52, r)} = ${bigNum(value)}`)],
        distractors: distinctDistractors(answer, [numAns(fallingFactorial(52, r)), numAns(52 * r), numAns(choose(52, r - 1))], (k) => numAns(value + offset(k))),
        check: { kind: `${PFX}.count`, factors: [{ n: 52, k: r, mode: 'comb' }], mentions: [`${r}-card`, '52-card'] },
      };
    }
    const c = combContext(rng, d);
    const value = choose(c.n, c.r);
    const answer = numAns(value);
    return {
      question: c.question,
      answer,
      steps: [m(`${combTex(c.n, c.r)} = \\frac{${c.n}!}{${c.r}! \\cdot ${c.n - c.r}!} = ${bigNum(value)}`)],
      distractors: distinctDistractors(answer, [numAns(fallingFactorial(c.n, c.r)), numAns(choose(c.n, c.r - 1)), numAns(c.n * c.r), numAns(c.n ** 2)], (k) => numAns(value + offset(k))),
      check: { kind: `${PFX}.count`, factors: [{ n: c.n, k: c.r, mode: 'comb' }], mentions: c.mentions },
    };
  },
});

// ---------------------------------------------------------------- permutations vs combinations

export const permVsComb = defineTopic({
  id: 'alg2.prob.perm-vs-comb',
  subject: 'algebra2',
  title: 'Permutations vs. Combinations',
  description: 'Decide whether order matters (permutation) or not (combination), then count.',
  category: 'Probability and Statistics',
  instruction: 'State whether each situation is a permutation or a combination, then answer the question.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty: d } = ctx;
    const c = attempt('pvc', () => {
      const x = rng.bool() ? permContext(rng, d) : combContext(rng, d);
      return x.r >= 2 && x.r < x.n && fallingFactorial(x.n, x.r) < 1e9 ? x : null;
    });
    const P = fallingFactorial(c.n, c.r);
    const C = choose(c.n, c.r);
    const show = (label: string, v: number) => `${label}; ${numAns(v)}`;
    const answer = show(c.mode === 'perm' ? 'Permutation' : 'Combination', c.mode === 'perm' ? P : C);
    return {
      question: c.question,
      answer,
      steps: [c.mode === 'perm' ? 'Order matters, so this is a permutation.' : 'Order does not matter, so this is a combination.', m(c.mode === 'perm' ? `${permTex(c.n, c.r)} = ${bigNum(P)}` : `${combTex(c.n, c.r)} = ${bigNum(C)}`)],
      distractors: distinctDistractors(answer, [show('Combination', C), show('Permutation', P), show(c.mode === 'perm' ? 'Combination' : 'Permutation', c.mode === 'perm' ? P : C), show(c.mode === 'perm' ? 'Permutation' : 'Combination', c.mode === 'perm' ? C : P)], (k) => show(c.mode === 'perm' ? 'Combination' : 'Permutation', (c.mode === 'perm' ? C : P) + k)),
      check: { kind: `${PFX}.count`, factors: [{ n: c.n, k: c.r, mode: c.mode }], mentions: c.mentions, label: c.mode === 'perm' ? 'Permutation' : 'Combination' },
    };
  },
});
