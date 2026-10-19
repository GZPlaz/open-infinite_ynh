/** Operations with complex numbers: sums, differences, products, quotients and powers of i. */
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../../generator';
import { m, num, parenNeg, pow, sum } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { cadd, ceq, cdiv, cmul, conj, cParen, cpowI, csub, cTex, cx, norm2, randCx, type Cx } from './common';

type Op = 'add' | 'multiply' | 'divide' | 'powers';

const OPS: Record<Difficulty, Op[]> = {
  easy: ['add', 'add', 'multiply', 'powers'],
  medium: ['add', 'multiply', 'multiply', 'divide', 'powers'],
  hard: ['multiply', 'divide', 'divide', 'powers'],
};

const iPow = (n: number) => pow('i', n);

export const complexOperations = defineTopic({
  id: 'alg2.complex.operations',
  subject: 'algebra2',
  title: 'Operations with Complex Numbers',
  description: 'Add, subtract, multiply and divide complex numbers; simplify powers of i.',
  category: 'Complex Numbers',
  instruction: 'Simplify. Write each answer in standard form $a + bi$.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operation',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'add', label: 'Add / subtract' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'divide', label: 'Divide' },
        { value: 'powers', label: 'Powers of i' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'operation');
    const op: Op = chosen === 'any' ? rng.pick(OPS[difficulty]) : (chosen as Op);
    const R = { easy: 8, medium: 9, hard: 12 }[difficulty];
    const steps: string[] = [];
    let question: string;
    let result: Cx;
    let wrongs: Cx[];

    switch (op) {
      case 'add': {
        const a = randCx(rng, R, true);
        const b = randCx(rng, R, true);
        if (difficulty === 'hard' || (difficulty === 'medium' && rng.bool(0.5))) {
          const c = randCx(rng, R, true);
          const s1 = rng.sign();
          const s2 = rng.sign();
          const step1 = s1 > 0 ? cadd(a, b) : csub(a, b);
          result = s2 > 0 ? cadd(step1, c) : csub(step1, c);
          question = `${cParen(a)} ${s1 > 0 ? '+' : '-'} ${cParen(b)} ${s2 > 0 ? '+' : '-'} ${cParen(c)}`;
          steps.push('Combine the real parts and the imaginary parts separately.');
          steps.push(`Real: $${num(result.re)}$, imaginary: $${num(result.im)}$`);
          const alt = (t1: number, t2: number) => {
            const x = t1 > 0 ? cadd(a, b) : csub(a, b);
            return t2 > 0 ? cadd(x, c) : csub(x, c);
          };
          wrongs = [alt(-s1, s2), alt(s1, -s2), { re: result.re, im: result.im.neg() }];
        } else {
          const s = rng.sign();
          result = s > 0 ? cadd(a, b) : csub(a, b);
          question = `${cParen(a)} ${s > 0 ? '+' : '-'} ${cParen(b)}`;
          steps.push(`Real parts: $${num(a.re)} ${s > 0 ? '+' : '-'} ${parenNeg(b.re)} = ${num(result.re)}$`);
          steps.push(`Imaginary parts: $${num(a.im)} ${s > 0 ? '+' : '-'} ${parenNeg(b.im)} = ${num(result.im)}$`);
          // distributing the minus sign only to the real part, swapping parts, adding instead of subtracting
          wrongs = s > 0 ? [csub(a, b), { re: result.im, im: result.re }, cx(result.re.add(result.im))] : [cadd(a, b), cx(a.re.sub(b.re), a.im.add(b.im)), { re: result.im, im: result.re }];
        }
        break;
      }
      case 'multiply': {
        const small = difficulty === 'easy' ? 6 : difficulty === 'medium' ? 7 : 9;
        let a: Cx;
        let b: Cx;
        let square = false;
        if (difficulty === 'easy' && rng.bool(0.5)) {
          a = rng.bool(0.5) ? cx(0, rng.signedInt(1, 6, true)) : cx(rng.signedInt(2, 6, true));
          b = randCx(rng, small);
        } else {
          a = randCx(rng, small);
          square = difficulty !== 'easy' && rng.bool(0.25);
          b = square ? a : randCx(rng, small);
        }
        result = cmul(a, b);
        if (difficulty === 'hard' && !square && rng.bool(0.4)) {
          const c = randCx(rng, 4);
          const r2 = cmul(result, c);
          question = `${cParen(a)}${cParen(b)}${cParen(c)}`;
          steps.push(`$${cParen(a)}${cParen(b)} = ${cTex(result)}$`);
          steps.push(`$${cParen(result)}${cParen(c)} = ${cTex(r2)}$`);
          wrongs = [cx(r2.re, r2.im.neg()), { re: r2.im, im: r2.re }, cneg2(r2)];
          result = r2;
          break;
        }
        const aTex = a.re.isZero() ? cTex(a) : cParen(a);
        question = square ? `${cParen(a)}^{2}` : a.im.isZero() ? `${num(a.re)}${cParen(b)}` : `${aTex}${cParen(b)}`;
        const ac = a.re.mul(b.re);
        const bd = a.im.mul(b.im);
        steps.push(`Distribute: $${sum([{ coef: ac }, { coef: a.re.mul(b.im).add(a.im.mul(b.re)), sym: 'i' }, { coef: bd, sym: 'i^{2}' }])}$`);
        steps.push(`Use $i^{2} = -1$: $${cTex(result)}$`);
        // i² = +1, forgetting the cross terms, sign slip
        wrongs = [cx(ac.add(bd), result.im), cx(ac, bd), conj(result), cx(result.re.neg(), result.im)];
        break;
      }
      case 'divide': {
        const built = attempt('complex division', () => {
          let num_: Cx;
          let den: Cx;
          if (difficulty === 'medium' && rng.bool(0.4)) {
            num_ = randCx(rng, 9);
            den = cx(0, rng.signedInt(1, 5, true));
          } else if (difficulty !== 'hard') {
            // integer quotient: numerator = quotient × denominator
            den = randCx(rng, 4);
            num_ = cmul(randCx(rng, 5), den);
          } else {
            num_ = randCx(rng, 9, true);
            den = randCx(rng, 6);
          }
          const q = cdiv(num_, den);
          if (difficulty !== 'hard' && (!q.re.isInt() || !q.im.isInt()) && !den.re.isZero()) return null;
          if (Math.max(q.re.d, q.im.d) > 60 || Math.abs(num_.re.value) > 40 || Math.abs(num_.im.value) > 40) return null;
          return { num_, den, q };
        });
        const { num_, den, q } = built;
        result = q;
        question = `\\frac{${cTex(num_)}}{${cTex(den)}}`;
        const top = cmul(num_, conj(den));
        if (den.re.isZero()) {
          steps.push(`Multiply the numerator and denominator by $i$: $\\frac{${cTex(cmul(num_, cx(0, 1)))}}{${cTex(cmul(den, cx(0, 1)))}}$`);
        } else {
          steps.push(`Multiply by the conjugate $\\frac{${cTex(conj(den))}}{${cTex(conj(den))}}$: $\\frac{${cTex(top)}}{${num(norm2(den))}}$`);
        }
        steps.push(`$${cTex(q)}$`);
        const d2 = den.re.mul(den.re).sub(den.im.mul(den.im));
        wrongs = [
          d2.isZero() ? cx(top.re, top.im.neg()) : { re: top.re.div(d2), im: top.im.div(d2) },
          { re: num_.re.div(den.re.isZero() ? den.im : den.re), im: num_.im.div(den.im) },
          cx(q.re, q.im.neg()),
          cx(q.re.neg(), q.im),
        ];
        break;
      }
      case 'powers':
      default: {
        const maxN = { easy: 30, medium: 50, hard: 64 }[difficulty];
        if (difficulty === 'easy') {
          const n = rng.int(5, maxN);
          question = iPow(n);
          result = cpowI(n);
          steps.push(`$${n} = 4 \\cdot ${Math.floor(n / 4)} + ${n % 4}$, so $${iPow(n)} = ${n % 4 === 0 ? '1' : iPow(n % 4)}$`);
          steps.push(`$${cTex(result)}$`);
          wrongs = [1, 2, 3].map((k) => cpowI(n + k));
        } else {
          const n1 = rng.int(5, maxN);
          const n2 = rng.int(5, maxN);
          const k1 = rng.signedInt(1, difficulty === 'hard' ? 9 : 5, true);
          const k2 = rng.signedInt(1, difficulty === 'hard' ? 9 : 5, true);
          const extra = difficulty === 'hard' ? rng.signedInt(1, 9, true) : 0;
          const t1 = cmul(cx(k1), cpowI(n1));
          const t2 = cmul(cx(k2), cpowI(n2));
          result = cadd(cadd(t1, t2), cx(extra));
          const term = (k: number, n: number, first: boolean) => `${first ? (k < 0 ? '-' : '') : k < 0 ? ' - ' : ' + '}${Math.abs(k) === 1 ? '' : Math.abs(k)}${iPow(n)}`;
          question = `${term(k1, n1, true)}${term(k2, n2, false)}${extra ? ` ${extra < 0 ? '-' : '+'} ${Math.abs(extra)}` : ''}`;
          steps.push(`$${iPow(n1)} = ${cTex(cpowI(n1))}$ and $${iPow(n2)} = ${cTex(cpowI(n2))}$ (divide each exponent by $4$ and use the remainder)`);
          steps.push(`$${cTex(result)}$`);
          const shift = (d1: number, d2: number) => cadd(cadd(cmul(cx(k1), cpowI(n1 + d1)), cmul(cx(k2), cpowI(n2 + d2))), cx(extra));
          wrongs = [shift(1, 0), shift(0, 1), shift(2, 2), shift(1, 1)];
        }
        break;
      }
    }
    const answer = m(cTex(result));
    const res = result;
    const distractors = distinctDistractors(
      answer,
      wrongs.filter((w) => !ceq(w, res)).map((w) => m(cTex(w))),
      (k) => m(cTex(k % 2 ? cx(res.re.add(offset(k)), res.im) : cx(res.re, res.im.add(offset(k))))),
    );
    return { question: m(question), answer, steps, distractors, check: { kind: `${KIND}.complex` } };
  },
});

const cneg2 = (z: Cx): Cx => cx(z.re.neg(), z.im.neg());
