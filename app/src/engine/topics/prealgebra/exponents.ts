/** Exponents and roots: evaluating powers, scientific notation, square roots. */
import { Frac } from '../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import type { Rng } from '../../rng';
import { m } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { CAT, Dec, groupDigits, roundDec } from './common';

// ---------------------------------------------------------------- evaluating powers

interface PowExpr {
  tex: string;
  value: Frac | Dec;
  wrong: Array<Frac | Dec>;
  steps: string[];
}

const valTex = (v: Frac | Dec) => (v instanceof Dec ? v.toTex() : v.toTex());

function powerExpr(rng: Rng, d: Difficulty, negatives: boolean, zero: boolean, fractions: boolean): PowExpr | null {
  const kinds: string[] = ['plain'];
  if (zero) kinds.push('zero');
  if (d === 'easy') {
    if (negatives) kinds.push('negParen');
  } else {
    if (negatives) kinds.push('negParen', 'negNoParen', 'negParen');
    kinds.push('product');
  }
  if (d === 'hard') {
    if (fractions) kinds.push('fraction', 'decimal', 'fraction');
    kinds.push('combo');
    if (negatives) kinds.push('negCombo');
  }
  const kind = rng.pick(kinds);
  const b = rng.int(2, d === 'easy' ? 8 : 10);
  const e = b <= 3 ? rng.int(2, d === 'easy' ? 5 : 6) : b <= 5 || d === 'easy' ? rng.int(2, 3) : 2;
  switch (kind) {
    case 'plain': {
      const v = b ** e;
      return { tex: `${b}^{${e}}`, value: new Frac(v), wrong: [new Frac(b * e), new Frac(b ** (e + 1)), new Frac(e ** b)], steps: [m(`${Array(e).fill(b).join(' \\cdot ')} = ${v}`)] };
    }
    case 'zero': {
      const neg = negatives && rng.bool(0.5);
      const outside = neg && rng.bool(0.5);
      const tex = neg ? (outside ? `-${b}^{0}` : `(-${b})^{0}`) : `${b}^{0}`;
      const v = outside ? -1 : 1;
      return { tex, value: new Frac(v), wrong: [new Frac(0), new Frac(b), new Frac(-v)], steps: [`Any nonzero number to the zero power is $1$.`, m(`= ${v}`)] };
    }
    case 'negParen': {
      const ee = rng.int(2, b <= 3 ? 5 : 3);
      const v = (-b) ** ee;
      return { tex: `(-${b})^{${ee}}`, value: new Frac(v), wrong: [new Frac(-v), new Frac(-b * ee), new Frac(b * ee)], steps: [m(`${Array(ee).fill(`(-${b})`).join('')} = ${v}`)] };
    }
    case 'negNoParen': {
      const ee = rng.int(2, b <= 3 ? 4 : 2);
      const v = -(b ** ee);
      return { tex: `-${b}^{${ee}}`, value: new Frac(v), wrong: [new Frac(-v), new Frac(-b * ee), new Frac(b * ee)], steps: [`The exponent applies only to $${b}$: $-(${b}^{${ee}})$`, m(`= ${v}`)] };
    }
    case 'product': {
      const a = rng.int(2, 5);
      const ea = rng.int(2, a <= 3 ? 4 : 2);
      const c = rng.int(2, 4);
      const ec = rng.int(2, 3);
      if (a === c) return null;
      const v = a ** ea * c ** ec;
      return {
        tex: `${a}^{${ea}} \\cdot ${c}^{${ec}}`,
        value: new Frac(v),
        wrong: [new Frac(a * ea * c * ec), new Frac((a * c) ** (ea + ec)), new Frac(a ** ea + c ** ec)],
        steps: [m(`= ${a ** ea} \\cdot ${c ** ec}`), m(`= ${v}`)],
      };
    }
    case 'fraction': {
      const p = rng.int(1, 5);
      const q = rng.int(2, 7);
      const ee = rng.int(2, 3);
      if (new Frac(p, q).d !== q) return null;
      const neg = negatives && rng.bool(0.5);
      const base = new Frac(neg ? -p : p, q);
      const v = base.pow(ee);
      return {
        tex: `\\left(${base.toTex()}\\right)^{${ee}}`,
        value: v,
        wrong: [new Frac((neg ? -1 : 1) * p ** ee, q), base.mul(ee), v.neg()],
        steps: [m(`= \\frac{${neg && ee % 2 ? '-' : ''}${p}^{${ee}}}{${q}^{${ee}}}`.replace('\\frac{-', '-\\frac{')), m(`= ${v.toTex()}`)],
      };
    }
    case 'decimal': {
      const x = new Dec(rng.int(1, 9) * (rng.bool(0.3) ? 11 : 1), rng.bool(0.7) ? 1 : 2);
      if (x.s > 1 && x.n > 20) return null;
      const ee = x.n < 10 ? rng.int(2, 3) : 2;
      let v = new Dec(1);
      for (let i = 0; i < ee; i++) v = v.mul(x);
      if (v.s > 6) return null;
      return { tex: `(${x.toTex()})^{${ee}}`, value: v, wrong: [x.mul(new Dec(ee)), v.times10(1), v.times10(-1)], steps: [m(`${Array(ee).fill(x.toTex()).join(' \\times ')} = ${v.toTex()}`)] };
    }
    case 'combo': {
      const a = rng.int(2, 5);
      const c = rng.int(2, 3);
      const k = rng.int(2, 6);
      const ec = rng.int(2, 3);
      const zeroTerm = zero && rng.bool(0.5);
      // a^2 - c^ec · k^0  or  a^2 + k · c^ec
      const v = zeroTerm ? a ** 2 - c ** ec : a ** 2 + k * c ** ec;
      const tex = zeroTerm ? `${a}^{2} - ${c}^{${ec}} \\cdot ${k}^{0}` : `${a}^{2} + ${k} \\cdot ${c}^{${ec}}`;
      const wrongs = zeroTerm ? [a ** 2, a ** 2 - c ** ec * k, 2 * a - c * ec] : [a ** 2 + (k * c) ** ec, (a ** 2 + k) * c ** ec, 2 * a + k * c * ec];
      return {
        tex,
        value: new Frac(v),
        wrong: wrongs.map((w) => new Frac(w)),
        steps: [zeroTerm ? m(`= ${a ** 2} - ${c ** ec} \\cdot 1`) : m(`= ${a ** 2} + ${k} \\cdot ${c ** ec}`), m(`= ${v}`)],
      };
    }
    default: {
      // -a^ee + (-c)^2
      const a = rng.int(2, 4);
      const ee = rng.int(2, 4);
      const c = rng.int(2, 6);
      const v = -(a ** ee) + c ** 2;
      return {
        tex: `-${a}^{${ee}} + (-${c})^{2}`,
        value: new Frac(v),
        wrong: [new Frac(a ** ee + c ** 2), new Frac(-(a ** ee) - c ** 2), new Frac((-a) ** ee + c ** 2)],
        steps: [m(`= -${a ** ee} + ${c ** 2}`), m(`= ${v}`)],
      };
    }
  }
}

export const evaluatingExponents = defineTopic({
  id: 'prealg.exponents',
  subject: 'prealgebra',
  category: CAT.exponents,
  title: 'Exponents',
  description: 'Evaluate powers, including negative bases, zero exponents and fraction bases.',
  instruction: 'Evaluate each expression.',
  multipleChoice: true,
  defaultCount: 16,
  options: [
    { type: 'boolean', id: 'negatives', label: 'Negative bases', default: true },
    { type: 'boolean', id: 'zero', label: 'Zero exponents', default: true },
    { type: 'boolean', id: 'fractions', label: 'Fraction and decimal bases (hard)', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const e = attempt('exponents', () => powerExpr(rng, difficulty, boolOpt(ctx, 'negatives'), boolOpt(ctx, 'zero'), boolOpt(ctx, 'fractions')));
    const answer = m(valTex(e.value));
    const distractors = distinctDistractors(
      answer,
      e.wrong.map((w) => m(valTex(w))),
      (k) => m(valTex(e.value instanceof Dec ? e.value.add(new Dec(offset(k), Math.max(1, e.value.s))) : e.value.add(offset(k)))),
    );
    return { question: m(e.tex), answer, steps: e.steps, distractors, check: { kind: 'value', value: e.value.value } };
  },
});

// ---------------------------------------------------------------- scientific notation

/** value = m · 10^e with m an integer without trailing zeros. */
interface Sci {
  m: number;
  e: number;
}

function normSci(mm: number, e: number): Sci {
  while (mm !== 0 && mm % 10 === 0) {
    mm /= 10;
    e++;
  }
  return { m: mm, e };
}

function sciParts(x: Sci): { coef: string; exp: number } {
  const digits = String(Math.abs(x.m));
  const coef = digits.length === 1 ? digits : `${digits[0]}.${digits.slice(1)}`;
  return { coef: `${x.m < 0 ? '-' : ''}${coef}`, exp: x.e + digits.length - 1 };
}

function sciTex(x: Sci): string {
  const { coef, exp } = sciParts(x);
  return `${coef} \\times 10^{${exp}}`;
}

function stdTex(x: Sci): string {
  if (x.e >= 0) return groupDigits(String(x.m) + '0'.repeat(x.e));
  return new Dec(x.m, -x.e).toTex();
}

/** Coefficient written as a decimal × 10^k with a non-normalised coefficient (a common slip). */
function rawTex(coefDigits: number, exp: number): string {
  return `${coefDigits} \\times 10^{${exp}}`;
}

function pickSci(rng: Rng, d: Difficulty, allowSmall: boolean, sig: number): Sci {
  const digits = rng.int(1, sig);
  let mm = rng.int(10 ** (digits - 1), 10 ** digits - 1);
  if (digits > 1 && mm % 10 === 0) mm += rng.int(1, 9);
  const maxExp = d === 'easy' ? 6 : d === 'medium' ? 8 : 11;
  const small = allowSmall && rng.bool(0.5);
  const exp = small ? -rng.int(1, d === 'easy' ? 4 : d === 'medium' ? 6 : 8) : rng.int(2, maxExp);
  return normSci(mm, exp - (digits - 1));
}

type STask = 'toSci' | 'toStd' | 'mul' | 'div';

export const scientificNotation = defineTopic({
  id: 'prealg.scientific-notation',
  subject: 'prealgebra',
  category: CAT.exponents,
  title: 'Scientific Notation',
  description: 'Convert between standard form and scientific notation, and multiply or divide in scientific notation.',
  instruction: (o) =>
    o.task === 'toSci'
      ? 'Write each number in scientific notation.'
      : o.task === 'toStd'
        ? 'Write each number in standard form.'
        : o.task === 'muldiv'
          ? 'Simplify. Write each answer in scientific notation.'
          : 'Write each number as indicated, or simplify and write the answer in scientific notation.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'toSci', label: 'Standard → scientific' },
        { value: 'toStd', label: 'Scientific → standard' },
        { value: 'muldiv', label: 'Multiply and divide' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task: STask =
      t === 'toSci' || t === 'toStd' ? t : t === 'muldiv' ? rng.pick(['mul', 'div'] as const) : rng.pick(difficulty === 'easy' ? (['toSci', 'toStd'] as const) : (['toSci', 'toStd', 'mul', 'div'] as const));
    const small = difficulty !== 'easy';
    const sig = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
    const mixedLabel = t === 'mixed';
    if (task === 'toSci' || task === 'toStd') {
      const x = pickSci(rng, difficulty, small, sig);
      const { coef, exp } = sciParts(x);
      const digits = String(Math.abs(x.m));
      if (task === 'toSci') {
        const answer = m(sciTex(x));
        const alt = normSci(x.m, x.e);
        const distractors = distinctDistractors(
          answer,
          [m(`${coef} \\times 10^{${-exp}}`), m(`${coef} \\times 10^{${exp + 1}}`), m(rawTex(x.m, x.e)), m(`${coef} \\times 10^{${exp - 1}}`)],
          (k) => m(`${coef} \\times 10^{${exp + offset(k) * 2}}`),
        );
        return {
          question: mixedLabel ? `Write $${stdTex(x)}$ in scientific notation.` : m(stdTex(x)),
          answer,
          steps: [`Move the decimal point to get $${coef}$: ${Math.abs(exp)} place${Math.abs(exp) === 1 ? '' : 's'} ${exp >= 0 ? 'left' : 'right'}.`, m(`${stdTex(alt)} = ${sciTex(x)}`)],
          distractors,
          check: { kind: 'prealgebra.sci', form: 'sci' },
        };
      }
      const answer = m(stdTex(x));
      const distractors = distinctDistractors(
        answer,
        [m(stdTex({ m: x.m, e: x.e + 1 })), m(stdTex({ m: x.m, e: x.e - 1 })), m(stdTex({ m: x.m, e: -x.e - 2 * (digits.length - 1) }))],
        (k) => m(stdTex({ m: x.m, e: x.e + offset(k) * 2 })),
      );
      return {
        question: mixedLabel ? `Write $${sciTex(x)}$ in standard form.` : m(sciTex(x)),
        answer,
        steps: [`Move the decimal point ${Math.abs(exp)} place${Math.abs(exp) === 1 ? '' : 's'} to the ${exp >= 0 ? 'right' : 'left'}.`, m(`= ${stdTex(x)}`)],
        distractors,
        check: { kind: 'prealgebra.sci', form: 'std' },
      };
    }
    const p = attempt('sci-ops', () => {
      const a = pickSci(rng, difficulty, small, difficulty === 'hard' ? 3 : 2);
      const b = pickSci(rng, difficulty, small, 2);
      const prod = normSci(a.m * b.m, a.e + b.e);
      if (Math.abs(sciParts(prod).exp) > 20) return null;
      return task === 'mul' ? { left: a, right: b, res: prod } : { left: prod, right: b, res: a };
    });
    const { left, right, res } = p;
    const L = sciParts(left);
    const R = sciParts(right);
    const question = task === 'mul' ? `(${sciTex(left)})(${sciTex(right)})` : `\\frac{${sciTex(left)}}{${sciTex(right)}}`;
    const answer = m(sciTex(res));
    const { coef, exp } = sciParts(res);
    const coefDec = (c: string) => Dec.of(Number(c.replace('.', '')), c.split('.')[1]?.length ?? 0);
    const rawCoef = task === 'mul' ? coefDec(L.coef).mul(coefDec(R.coef)) : coefDec(L.coef).div(coefDec(R.coef), 8)!;
    const rawExp = task === 'mul' ? L.exp + R.exp : L.exp - R.exp;
    const wrongExp = task === 'mul' ? L.exp * R.exp : L.exp + R.exp;
    const normalised = Math.abs(rawCoef.value) >= 1 && Math.abs(rawCoef.value) < 10;
    const distractors = distinctDistractors(
      answer,
      [m(`${coef} \\times 10^{${wrongExp}}`), !normalised ? m(`${rawCoef.toTex()} \\times 10^{${rawExp}}`) : m(`${coef} \\times 10^{${exp + 1}}`), m(`${coef} \\times 10^{${exp - 1}}`), m(`${coef} \\times 10^{${-exp}}`)],
      (k) => m(`${coef} \\times 10^{${exp + offset(k) * 2}}`),
    );
    const op = task === 'mul' ? '\\times' : '\\div';
    const steps = [
      `${task === 'mul' ? 'Multiply' : 'Divide'} the coefficients: $${L.coef} ${op} ${R.coef} = ${rawCoef.toTex()}$`,
      `${task === 'mul' ? 'Add' : 'Subtract'} the exponents: $10^{${rawExp}}$`,
      normalised ? m(`= ${sciTex(res)}`) : `Rewrite: $${rawCoef.toTex()} \\times 10^{${rawExp}} = ${sciTex(res)}$`,
    ];
    return {
      question: mixedLabel ? `Simplify $${question}$.` : m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'prealgebra.sci', form: 'sci' },
    };
  },
});

// ---------------------------------------------------------------- square roots

type RTask = 'perfect' | 'estimate' | 'round';

export const squareRoots = defineTopic({
  id: 'prealg.square-roots',
  subject: 'prealgebra',
  category: CAT.exponents,
  title: 'Square Roots',
  description: 'Evaluate square roots of perfect squares, and estimate other square roots.',
  instruction: (o) =>
    o.task === 'perfect'
      ? 'Evaluate each expression.'
      : o.task === 'estimate'
        ? 'Name the two consecutive integers that each square root lies between.'
        : o.task === 'round'
          ? 'Estimate each square root to the nearest tenth.'
          : 'Answer each question.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problems',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Mixed' },
        { value: 'perfect', label: 'Perfect squares' },
        { value: 'estimate', label: 'Between two integers' },
        { value: 'round', label: 'Round to the nearest tenth' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const t = strOpt(ctx, 'task');
    const task: RTask = t === 'mixed' ? rng.pick(['perfect', 'perfect', 'estimate', 'round'] as const) : (t as RTask);
    const labelled = t === 'mixed';
    if (task === 'perfect') {
      const kinds = difficulty === 'easy' ? ['plain', 'plain', 'neg'] : difficulty === 'medium' ? ['plain', 'neg', 'sum', 'coef'] : ['fraction', 'decimal', 'sum', 'coef', 'neg'];
      const kind = rng.pick(kinds);
      const n = rng.int(1, difficulty === 'easy' ? 12 : difficulty === 'medium' ? 20 : 25);
      let tex: string;
      let value: Frac | Dec;
      let wrong: Array<Frac | Dec>;
      let steps: string[];
      switch (kind) {
        case 'plain':
          tex = `\\sqrt{${n * n}}`;
          value = new Frac(n);
          wrong = [new Frac(2 * n), new Frac(n + 1), new Frac(-n)];
          steps = [m(`${n}^{2} = ${n * n}`)];
          break;
        case 'neg':
          tex = `-\\sqrt{${n * n}}`;
          value = new Frac(-n);
          wrong = [new Frac(n), new Frac(-2 * n), new Frac(-n - 1)];
          steps = [m(`\\sqrt{${n * n}} = ${n}`)];
          break;
        case 'sum': {
          const a = rng.int(1, 12);
          const b = rng.int(1, 12);
          const minus = rng.bool(0.4);
          tex = `\\sqrt{${a * a}} ${minus ? '-' : '+'} \\sqrt{${b * b}}`;
          value = new Frac(minus ? a - b : a + b);
          const inside = minus ? a * a - b * b : a * a + b * b;
          wrong = [new Frac(inside), new Frac(minus ? a + b : a - b), new Frac((minus ? a - b : a + b) + 1)];
          steps = [m(`= ${a} ${minus ? '-' : '+'} ${b}`), m(`= ${minus ? a - b : a + b}`)];
          break;
        }
        case 'coef': {
          const c = rng.int(2, 6);
          const k = rng.int(1, 9);
          tex = `${c}\\sqrt{${n * n}} - ${k}`;
          value = new Frac(c * n - k);
          wrong = [new Frac(c * n * n - k), new Frac(c + n - k), new Frac(c * n + k)];
          steps = [m(`= ${c} \\cdot ${n} - ${k}`), m(`= ${c * n - k}`)];
          break;
        }
        case 'fraction': {
          const [p, q] = attempt('sqrt-fraction', () => {
            const p = rng.int(1, 9);
            const q = rng.int(2, 12);
            return new Frac(p, q).d === q ? [p, q] : null;
          });
          tex = `\\sqrt{\\frac{${p * p}}{${q * q}}}`;
          value = new Frac(p, q);
          wrong = [new Frac(p * p, q), new Frac(p, q * q), new Frac(q, p)];
          steps = [m(`= \\frac{\\sqrt{${p * p}}}{\\sqrt{${q * q}}} = \\frac{${p}}{${q}}`)];
          break;
        }
        default: {
          const r = new Dec(rng.intExcept(1, 15, [10]), 1);
          const sq = r.mul(r);
          tex = `\\sqrt{${sq.toTex()}}`;
          value = r;
          wrong = [r.times10(-1), r.times10(1), sq.mul(new Dec(5, 1))];
          steps = [m(`${r.toTex()} \\times ${r.toTex()} = ${sq.toTex()}`)];
        }
      }
      const answer = m(valTex(value));
      const distractors = distinctDistractors(answer, wrong.map((w) => m(valTex(w))), (k) => m(valTex(value instanceof Dec ? value.add(new Dec(offset(k), 1)) : value.add(offset(k)))));
      return { question: labelled ? `Evaluate $${tex}$.` : m(tex), answer, steps, distractors, check: { kind: 'prealgebra.sqrt', task: 'perfect' } };
    }
    const max = difficulty === 'easy' ? 100 : difficulty === 'medium' ? 250 : 600;
    const n = attempt('sqrt-estimate', () => {
      const n = rng.int(2, max);
      return Number.isInteger(Math.sqrt(n)) ? null : n;
    });
    const lo = Math.floor(Math.sqrt(n));
    if (task === 'estimate') {
      const pair = (a: number) => `${m(String(a))} and ${m(String(a + 1))}`;
      const answer = pair(lo);
      const distractors = distinctDistractors(answer, [pair(lo - 1), pair(lo + 1), pair(Math.floor(n / 2) > lo + 1 ? Math.floor(n / 2) : lo + 2)], (k) => pair(lo + 2 + k));
      return {
        question: labelled ? `Between which two consecutive integers does $\\sqrt{${n}}$ lie?` : m(`\\sqrt{${n}}`),
        answer,
        steps: [m(`${lo}^{2} = ${lo * lo} < ${n} < ${(lo + 1) ** 2} = ${lo + 1}^{2}`)],
        distractors,
        check: { kind: 'prealgebra.sqrt', task: 'estimate' },
      };
    }
    const r = roundDec(Math.sqrt(n), 1);
    const answer = m(r.toTex());
    const truncated = new Dec(Math.floor(Math.sqrt(n) * 10), 1);
    const distractors = distinctDistractors(
      answer,
      [truncated.eq(r) ? null : m(truncated.toTex()), m(r.add(new Dec(1, 1)).toTex()), m(r.sub(new Dec(1, 1)).toTex()), m(new Dec(n * 5, 1).toTex())],
      (k) => m(r.add(new Dec(offset(k) + 3, 1)).toTex()),
    );
    return {
      question: labelled ? `Estimate $\\sqrt{${n}}$ to the nearest tenth.` : m(`\\sqrt{${n}}`),
      answer,
      steps: [m(`${lo}^{2} = ${lo * lo}`) + ' and ' + m(`${lo + 1}^{2} = ${(lo + 1) ** 2}`), m(`\\sqrt{${n}} \\approx ${roundDec(Math.sqrt(n), 3).toTex()} \\approx ${r.toTex()}`)],
      distractors,
      check: { kind: 'prealgebra.sqrt', task: 'round' },
    };
  },
});
