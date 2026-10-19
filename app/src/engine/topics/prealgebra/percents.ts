/** Percent problems, percent of change and its applications, simple interest. */
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT, Dec, money, moneyNum, moneyShort, pickName, roundDec } from './common';

const pct = (x: Dec | number) => `${typeof x === 'number' ? new Dec(Math.round(x * 1e6), 6).toTex() : x.toTex()}\\%`;

/** A percent rate by difficulty, as an exact decimal. */
function pickRate(rng: Rng, d: Difficulty): Dec {
  if (d === 'easy') return new Dec(rng.pick([10, 20, 25, 30, 40, 50, 60, 75, 5, 15]));
  if (d === 'medium') return new Dec(rng.int(1, 99));
  return rng.pick([new Dec(rng.int(1, 19) * 10 + 5, 1), new Dec(rng.int(101, 250)), new Dec(rng.int(1, 9), 1), new Dec(rng.int(3, 99))]);
}

// ---------------------------------------------------------------- percent of a number, what percent, percent of what

type PType = 'of' | 'what' | 'base';

export const percentProblems = defineTopic({
  id: 'prealg.percent-problems',
  subject: 'prealgebra',
  category: CAT.ratios,
  title: 'Percent Problems',
  description: 'Find a percent of a number, what percent one number is of another, and the whole from a part.',
  instruction: 'Solve each problem.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Find',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'All three types' },
        { value: 'of', label: 'Percent of a number' },
        { value: 'what', label: 'What percent' },
        { value: 'base', label: 'Percent of what number' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'type');
    const type: PType = t === 'mixed' ? rng.pick(['of', 'what', 'base'] as const) : (t as PType);
    const p = attempt('percent', () => {
      const rate = pickRate(rng, difficulty);
      const whole = difficulty === 'easy' ? new Dec(rng.int(1, 20) * 20) : difficulty === 'medium' ? new Dec(rng.int(2, 60) * 5) : new Dec(rng.int(4, 400));
      const part = rate.mul(whole).times10(-2);
      if (part.s > 2 || part.isZero()) return null;
      if (type === 'what' && rate.s > 1) return null;
      return { rate, whole, part };
    });
    const { rate, whole, part } = p;
    const R = m(pct(rate));
    const W = m(whole.toTex());
    const P = m(part.toTex());
    const alt = rng.bool();
    let question: string;
    let answer: string;
    let wrong: string[];
    let steps: string[];
    const r100 = rate.times10(-2);
    if (type === 'of') {
      question = alt ? `What is ${R} of ${W}?` : `Find ${R} of ${W}.`;
      answer = P;
      const div = whole.times10(2).div(rate, 4);
      wrong = [div ? m(div.toTex()) : null, m(part.times10(1).toTex()), m(whole.sub(part).toTex())].filter((x): x is string => !!x);
      steps = [`Write the percent as a decimal: $${pct(rate)} = ${r100.toTex()}$`, m(`${r100.toTex()} \\times ${whole.toTex()} = ${part.toTex()}`)];
    } else if (type === 'what') {
      question = alt ? `${P} is what percent of ${W}?` : `What percent of ${W} is ${P}?`;
      answer = R;
      const inv = whole.times10(2).div(part, 2);
      wrong = [inv ? m(pct(inv)) : m(pct(rate.times10(1))), m(pct(r100)), m(pct(rate.times10(1)))];
      steps = [m(`\\frac{${part.toTex()}}{${whole.toTex()}} = ${r100.toTex()}`), `Move the decimal point two places right: $${pct(rate)}$`];
    } else {
      question = alt ? `${P} is ${R} of what number?` : `${R} of what number is ${P}?`;
      answer = W;
      wrong = [m(part.mul(r100).toTex()), m(whole.times10(1).toTex()), m(whole.add(part).toTex())];
      steps = [`Write the percent as a decimal: $${pct(rate)} = ${r100.toTex()}$`, m(`${part.toTex()} \\div ${r100.toTex()} = ${whole.toTex()}`)];
    }
    const ansNum = type === 'of' ? part : type === 'what' ? rate : whole;
    const distractors = distinctDistractors(answer, wrong, (k) => (type === 'what' ? m(pct(rate.add(new Dec(offset(k) * 5)))) : m(ansNum.add(new Dec(offset(k) * 2)).toTex())));
    return { question: question.charAt(0).toUpperCase() + question.slice(1), answer, steps, distractors, check: { kind: 'prealgebra.percent' } };
  },
});

// ---------------------------------------------------------------- percent of change and applications

type CType = 'change' | 'markup' | 'discount' | 'tax' | 'tip';

const ITEMS = {
  markup: ['jacket', 'bicycle', 'lamp', 'backpack', 'video game', 'pair of headphones', 'skateboard', 'watch'],
  discount: ['pair of shoes', 'sweater', 'tablet', 'board game', 'tent', 'guitar', 'coat', 'printer'],
  tax: ['shirt', 'book', 'phone case', 'basketball', 'set of paints', 'pair of jeans', 'toaster'],
};

export const percentChange = defineTopic({
  id: 'prealg.percent-change',
  subject: 'prealgebra',
  category: CAT.ratios,
  title: 'Percent of Change, Markups, Discounts, Tax and Tips',
  description: 'Percent increase and decrease, markups, discounts, sales tax and tips in word problems.',
  instruction: (o) => (o.type === 'change' || o.type === 'mixed' ? 'Solve each problem. Round percents to the nearest tenth of a percent if necessary.' : 'Solve each problem. Round money to the nearest cent.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'type',
      label: 'Problems',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'All types' },
        { value: 'change', label: 'Percent of change' },
        { value: 'markup-discount', label: 'Markups and discounts' },
        { value: 'tax-tip', label: 'Sales tax and tips' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'type');
    const type: CType =
      t === 'change' ? 'change' : t === 'markup-discount' ? rng.pick(['markup', 'discount'] as const) : t === 'tax-tip' ? rng.pick(['tax', 'tip'] as const) : rng.pick(['change', 'markup', 'discount', 'tax', 'tip'] as const);
    if (type === 'change') return changeProblem(rng, difficulty);
    const name = pickName(rng);
    const p = attempt('percent-applied', () => {
      const rate = type === 'tax' && difficulty === 'hard' ? new Dec(rng.int(40, 99), 1) : type === 'tip' ? new Dec(rng.pick([10, 15, 18, 20, 25])) : pickRate(rng, difficulty);
      if ((rate.value >= 100 && type === 'discount') || rate.value < 1) return null;
      if (type === 'tax' && rate.value > 12) return null;
      const priceCents = difficulty === 'easy' ? rng.int(2, 40) * 500 : difficulty === 'medium' ? rng.int(10, 200) * 100 + rng.pick([0, 50]) : rng.int(500, 30000) + rng.pick([0, 0, 99]);
      const exact = (priceCents * rate.value) / 100;
      if (difficulty === 'easy' && Math.abs(exact - Math.round(exact)) > 1e-9) return null;
      return { rate, priceCents };
    });
    const { rate, priceCents } = p;
    const amount = Math.round((priceCents * rate.n) / 10 ** rate.s / 100 + 1e-9);
    const askAmount = rng.bool(type === 'tip' ? 0.5 : 0.3);
    const total = type === 'discount' ? priceCents - amount : priceCents + amount;
    const R = m(pct(rate));
    const price = moneyShort(priceCents);
    let question: string;
    let what: string;
    switch (type) {
      case 'markup': {
        const item = rng.pick(ITEMS.markup);
        question = `A store buys a ${item} for ${price} and marks it up ${R}.`;
        what = askAmount ? 'Find the amount of the markup.' : 'Find the selling price.';
        break;
      }
      case 'discount': {
        const item = rng.pick(ITEMS.discount);
        question = `A ${item} regularly sells for ${price}. It is on sale for ${R} off.`;
        what = askAmount ? 'Find the amount of the discount.' : 'Find the sale price.';
        break;
      }
      case 'tax': {
        const item = rng.pick(ITEMS.tax);
        question = `${name} buys a ${item} for ${price}. The sales tax rate is ${R}.`;
        what = askAmount ? 'Find the amount of the tax.' : 'Find the total cost.';
        break;
      }
      default:
        question = `The bill at a restaurant is ${price}. ${name} leaves a ${R} tip.`;
        what = askAmount ? 'Find the amount of the tip.' : 'Find the total amount paid.';
    }
    const result = askAmount ? amount : total;
    const answer = money(result);
    const label = type === 'discount' ? 'discount' : type === 'markup' ? 'markup' : type;
    const steps = [
      `Amount of the ${label}: $${rate.times10(-2).toTex()} \\times ${moneyNum(priceCents)} \\approx ${moneyNum(amount)}$`.replace('\\approx', Math.abs((priceCents * rate.value) / 100 - amount) < 1e-9 ? '=' : '\\approx'),
    ];
    if (!askAmount) steps.push(`${type === 'discount' ? 'Subtract' : 'Add'}: $${moneyNum(priceCents)} ${type === 'discount' ? '-' : '+'} ${moneyNum(amount)} = ${moneyNum(total)}$`);
    const otherTotal = type === 'discount' ? priceCents + amount : priceCents - amount;
    const tenth = Math.round((priceCents * rate.value) / 1000);
    const wrong = askAmount ? [total, tenth, amount * 10] : [amount, otherTotal, type === 'discount' ? priceCents - tenth : priceCents + tenth];
    const distractors = distinctDistractors(
      answer,
      wrong.filter((c) => c > 0).map(money),
      (k) => money(result + offset(k) * 100),
    );
    return { question: `${question} ${what}`, answer, steps, distractors, check: { kind: 'prealgebra.percentApplied' } };
  },
});

function changeProblem(rng: Rng, d: Difficulty): ProblemContent {
  const contexts = [
    (a: string, b: string) => `A town's population grew from ${a} to ${b}.`,
    (a: string, b: string) => `The price of a ticket changed from ${a} dollars to ${b} dollars.`,
    (a: string, b: string) => `A plant was ${a} cm tall last month and is ${b} cm tall now.`,
    (a: string, b: string) => `A club had ${a} members last year and has ${b} members this year.`,
    (a: string, b: string) => `The number of visitors to a park went from ${a} to ${b}.`,
  ];
  const p = attempt('percent-change', () => {
    const from = d === 'easy' ? rng.int(1, 20) * 10 : d === 'medium' ? rng.int(8, 200) : rng.int(30, 2000);
    const to = d === 'easy' ? from + (rng.pick([10, 20, 25, 50, -10, -20, -25, -50, 100]) * from) / 100 : rng.int(Math.ceil(from * 0.3), from * 2);
    if (!Number.isInteger(to) || to === from || to <= 0) return null;
    const change = ((to - from) / from) * 100;
    if (d !== 'hard' && Math.abs(change * 10 - Math.round(change * 10)) > 1e-9) return null;
    return { from, to, change };
  });
  const { from, to, change } = p;
  const useText = rng.bool(0.5);
  const sentence = useText ? rng.pick(contexts)(m(String(from)), m(String(to))) : '';
  const question = useText ? `${sentence} Find the percent of change.` : `Find the percent of change from ${m(String(from))} to ${m(String(to))}.`;
  const dir = change > 0 ? 'increase' : 'decrease';
  const r = roundDec(Math.abs(change), 1);
  const ans = (v: Dec, dd: string) => `${m(pct(v))} ${dd}`;
  const answer = ans(r, dir);
  const wrongBase = roundDec((Math.abs(to - from) / to) * 100, 1);
  const distractors = distinctDistractors(
    answer,
    [ans(r, change > 0 ? 'decrease' : 'increase'), ans(wrongBase, dir), ans(roundDec(Math.abs(to - from), 1), dir)],
    (k) => ans(r.add(new Dec(offset(k) * 5)), dir),
  );
  const exact = Math.abs(change * 10 - Math.round(change * 10)) < 1e-9;
  return {
    question: question.charAt(0).toUpperCase() + question.slice(1),
    answer,
    steps: [`Amount of change: $${to} - ${from} = ${to - from}$`, `$\\frac{${Math.abs(to - from)}}{${from}} ${exact ? '=' : '\\approx'} ${roundDec(Math.abs(change) / 100, 4).toTex()}$, so $${pct(r)}$ ${dir}`],
    distractors,
    check: { kind: 'prealgebra.percentChange' },
  };
}

// ---------------------------------------------------------------- simple interest

type IType = 'interest' | 'balance' | 'rate' | 'time' | 'principal';

export const simpleInterest = defineTopic({
  id: 'prealg.simple-interest',
  subject: 'prealgebra',
  category: CAT.ratios,
  title: 'Simple Interest',
  description: 'Use I = Prt to find interest, balances, rates, times and principals.',
  instruction: 'Solve each problem. Use I = Prt.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'find',
      label: 'Find',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'interest', label: 'Interest earned' },
        { value: 'balance', label: 'Balance (principal + interest)' },
        { value: 'other', label: 'Rate, time or principal' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const f = strOpt(ctx, 'find');
    const type: IType =
      f === 'interest' || f === 'balance'
        ? f
        : f === 'other'
          ? rng.pick(['rate', 'time', 'principal'] as const)
          : difficulty === 'hard'
            ? rng.pick(['interest', 'balance', 'rate', 'time', 'principal'] as const)
            : rng.pick(['interest', 'balance'] as const);
    const name = pickName(rng);
    const p = attempt('interest', () => {
      const P = difficulty === 'easy' ? rng.int(2, 40) * 100 : difficulty === 'medium' ? rng.int(10, 160) * 50 : rng.int(40, 400) * 25;
      const rate = difficulty === 'easy' ? new Dec(rng.int(2, 9)) : rng.bool(0.5) ? new Dec(rng.int(2, 12)) : new Dec(rng.int(4, 24) * 5 + 0, 1);
      const months = difficulty === 'hard' && type !== 'time' && rng.bool(0.4);
      const tMonths = months ? rng.pick([6, 9, 18, 30, 15]) : rng.int(1, difficulty === 'easy' ? 5 : 10) * 12;
      // interest in cents, exact
      const Icents = (P * 100 * rate.n * tMonths) / (10 ** rate.s * 100 * 12);
      if (!Number.isInteger(Icents) || Icents <= 0) return null;
      if (type !== 'interest' && type !== 'balance' && Icents % 100 !== 0 && rng.bool(0.7)) return null;
      return { P, rate, tMonths, I: Icents, months };
    });
    const { P, rate, tMonths, I, months } = p;
    const time = months ? `${m(String(tMonths))} months` : `${m(String(tMonths / 12))} year${tMonths === 12 ? '' : 's'}`;
    const R = m(pct(rate));
    const tYears = new Dec(tMonths * 100 / 12, 2);
    let question: string;
    let answer: string;
    let wrong: string[];
    const steps: string[] = [];
    if (months) steps.push(`Write the time in years: $${tMonths} \\text{ months} = ${tYears.toTex()} \\text{ years}$`);
    const Pc = P * 100;
    switch (type) {
      case 'interest':
      case 'balance': {
        const verb = rng.pick(['deposits', 'invests']);
        question = `${name} ${verb} ${moneyShort(Pc)} in an account that earns ${R} simple interest per year. ${type === 'interest' ? `How much interest is earned after ${time}?` : `What is the balance after ${time}?`}`;
        const value = type === 'interest' ? I : Pc + I;
        answer = money(value);
        steps.push(m(`I = ${moneyNum(Pc)} \\times ${rate.times10(-2).toTex()} \\times ${tYears.toTex()} = ${moneyNum(I)}`));
        if (type === 'balance') steps.push(m(`${moneyNum(Pc)} + ${moneyNum(I)} = ${moneyNum(Pc + I)}`));
        const noPct = Math.round(I * 100);
        wrong = [money(type === 'interest' ? Pc + I : I), money(type === 'interest' ? noPct : Pc + noPct), money(type === 'interest' ? I * 2 : Pc + I * 2)];
        break;
      }
      case 'rate':
        question = `${name} invests ${moneyShort(Pc)} and earns ${moneyShort(I)} in simple interest after ${time}. What is the annual interest rate?`;
        answer = R;
        steps.push(m(`r = \\frac{I}{Pt} = \\frac{${moneyNum(I)}}{${moneyNum(Pc)} \\times ${tYears.toTex()}} = ${rate.times10(-2).toTex()}`));
        wrong = [m(pct(rate.times10(-2))), m(pct(rate.times10(1))), m(pct(rate.mul(tYears)))];
        break;
      case 'time':
        question = `${name} borrows ${moneyShort(Pc)} at ${R} simple interest per year and pays ${moneyShort(I)} in interest. For how many years was the money borrowed?`;
        answer = `${m(tYears.toTex())} year${tYears.value === 1 ? '' : 's'}`;
        steps.push(m(`t = \\frac{I}{Pr} = \\frac{${moneyNum(I)}}{${moneyNum(Pc)} \\times ${rate.times10(-2).toTex()}} = ${tYears.toTex()}`));
        wrong = [tYears.times10(1), tYears.add(new Dec(1)), new Dec(tMonths)].map((x) => `${m(x.toTex())} years`);
        break;
      default:
        question = `An account earns ${R} simple interest per year. After ${time}, the interest earned is ${moneyShort(I)}. How much was deposited?`;
        answer = money(Pc);
        steps.push(m(`P = \\frac{I}{rt} = \\frac{${moneyNum(I)}}{${rate.times10(-2).toTex()} \\times ${tYears.toTex()}} = ${moneyNum(Pc)}`));
        wrong = [money(Pc * 10), money(Pc - I), money(Math.round(Pc / 10))];
    }
    const distractors = distinctDistractors(answer, wrong, (k) => (type === 'rate' ? m(pct(rate.add(new Dec(offset(k))))) : type === 'time' ? `${m(tYears.add(new Dec(offset(k) + 3)).toTex())} years` : money((type === 'principal' ? Pc : type === 'interest' ? I : Pc + I) + offset(k) * 1000)));
    return { question, answer, steps, distractors, check: { kind: 'prealgebra.interest' } };
  },
});
