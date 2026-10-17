/** Adding, subtracting and multiplying polynomials. */
import { attempt, defineTopic, distinctDistractors, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, sum, type Term } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';

type Kind = 'add' | 'sub' | 'mono' | 'binomial' | 'square' | 'conjugate' | 'bitri';

const KINDS: Record<Difficulty, { addsub: Kind[]; multiply: Kind[] }> = {
  easy: { addsub: ['add', 'sub'], multiply: ['mono', 'binomial'] },
  medium: { addsub: ['add', 'sub', 'sub'], multiply: ['binomial', 'binomial', 'mono'] },
  hard: { addsub: ['sub'], multiply: ['square', 'conjugate', 'bitri', 'binomial'] },
};

function randPoly(rng: Rng, degree: number, max: number, terms: number): Poly {
  return attempt('poly', () => {
    const c = Array.from({ length: degree + 1 }, () => 0);
    c[degree] = rng.signedInt(1, max, true);
    const others = rng.sample(
      Array.from({ length: degree }, (_, i) => i),
      Math.min(terms - 1, degree),
    );
    others.forEach((i) => (c[i] = rng.signedInt(1, max, true)));
    return new Poly(c);
  });
}

/** Polynomial with its terms in a shuffled but readable order (descending most of the time). */
function polyTex(p: Poly, v: string): string {
  return p.toTex(v);
}

export const polynomialOperations = defineTopic({
  id: 'alg1.polynomial-ops',
  subject: 'algebra1',
  title: 'Adding, Subtracting & Multiplying Polynomials',
  description: 'Combine like terms, distribute, FOIL, special products.',
  instruction: 'Simplify each expression.',
  multipleChoice: true,
  defaultCount: 12,
  options: [
    {
      type: 'select',
      id: 'operation',
      label: 'Operations',
      default: 'any',
      choices: [
        { value: 'any', label: 'Any' },
        { value: 'addsub', label: 'Add and subtract' },
        { value: 'multiply', label: 'Multiply' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const op = strOpt(ctx, 'operation');
    const family = op === 'any' ? (rng.bool() ? 'addsub' : 'multiply') : (op as 'addsub' | 'multiply');
    const kind = rng.pick(KINDS[difficulty][family]);
    const v = rng.pick(['x', 'x', 'n', 'k', 'p', 'm', 'v']);
    const max = difficulty === 'easy' ? 8 : 10;
    const steps: string[] = [];
    let question: string;
    let result: Poly;
    let wrongs: Poly[] = [];

    switch (kind) {
      case 'add':
      case 'sub': {
        const deg = difficulty === 'easy' ? rng.int(1, 2) : rng.int(2, 3);
        const p = randPoly(rng, deg, max, difficulty === 'easy' ? 2 : 3);
        const q = randPoly(rng, rng.int(Math.max(1, deg - 1), deg), max, difficulty === 'easy' ? 2 : 3);
        const s = kind === 'add' ? '+' : '-';
        question = `(${polyTex(p, v)}) ${s} (${polyTex(q, v)})`;
        result = kind === 'add' ? p.add(q) : p.sub(q);
        if (kind === 'sub') {
          steps.push(`Distribute the negative: $${sum([...p.terms(v), ...q.scale(-1).terms(v)])}$`);
          // forgetting to distribute to every term: only the leading term changes sign
          const lead = new Poly(q.c.map((c, i) => (i === q.degree ? c : c.neg())));
          wrongs = [p.add(q), p.add(lead)];
        } else {
          wrongs = [p.sub(q)];
        }
        steps.push(`Combine like terms: $${polyTex(result, v)}$`);
        break;
      }
      case 'mono': {
        const k = rng.signedInt(1, 8, true);
        const e = rng.int(1, difficulty === 'easy' ? 2 : 3);
        const p = randPoly(rng, rng.int(1, 2), max, 3);
        const mono = Poly.of(...Array.from({ length: e }, () => 0), k);
        question = `${sum([{ coef: k, sym: e === 1 ? v : `${v}^{${e}}` }])}(${polyTex(p, v)})`;
        result = mono.mul(p);
        // slip: multiplying coefficients but not adding exponents
        wrongs = [p.scale(k), result.scale(-1)];
        steps.push(`Distribute: $${polyTex(result, v)}$`);
        break;
      }
      case 'binomial':
      case 'square':
      case 'conjugate': {
        const a = rng.signedInt(1, difficulty === 'hard' ? 7 : 6, kind === 'binomial');
        const b = rng.signedInt(1, 9, true);
        const c = kind === 'binomial' ? rng.signedInt(1, 6, true) : a;
        const d = kind === 'binomial' ? rng.signedInt(1, 9, true) : kind === 'square' ? b : -b;
        const f1 = Poly.linear(a, b);
        const f2 = Poly.linear(c, d);
        question = kind === 'square' ? `(${polyTex(f1, v)})^{2}` : `(${polyTex(f1, v)})(${polyTex(f2, v)})`;
        result = f1.mul(f2);
        const foil: Term[] = [
          { coef: a * c, sym: `${v}^{2}` },
          { coef: a * d, sym: v },
          { coef: b * c, sym: v },
          { coef: b * d },
        ];
        steps.push(`${kind === 'square' ? `Write as $(${polyTex(f1, v)})(${polyTex(f1, v)})$ and FOIL` : 'FOIL'}: $${sum(foil)}$`);
        steps.push(`Combine like terms: $${polyTex(result, v)}$`);
        // classic slips: (a+b)² = a² + b²; dropping the middle terms; sign error on the constant
        wrongs = [Poly.of(b * d, 0, a * c), Poly.of(-b * d, a * d + b * c, a * c), Poly.of(b * d, a * d - b * c, a * c)];
        break;
      }
      case 'bitri':
      default: {
        const f1 = Poly.linear(rng.signedInt(1, 4, true), rng.signedInt(1, 6, true));
        const f2 = randPoly(rng, 2, 6, 3);
        question = `(${polyTex(f1, v)})(${polyTex(f2, v)})`;
        result = f1.mul(f2);
        const parts: Term[] = [];
        for (let i = 1; i >= 0; i--) for (let j = 2; j >= 0; j--) parts.push({ coef: f1.coef(i).mul(f2.coef(j)), sym: i + j === 0 ? '' : i + j === 1 ? v : `${v}^{${i + j}}` });
        steps.push(`Distribute each term: $${sum(parts)}$`);
        steps.push(`Combine like terms: $${polyTex(result, v)}$`);
        wrongs = [f1.mul(f2).add(Poly.of(0, 1)), new Poly(result.c.map((c, i) => (i === 1 ? c.neg() : c)))];
        break;
      }
    }
    const answer = m(polyTex(result, v));
    const distractors = distinctDistractors(
      answer,
      wrongs.filter((w) => !w.isZero()).map((w) => m(polyTex(w, v))),
      (k) => m(polyTex(result.add(Poly.of(k % 2 ? k : -k)), v)),
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'equivalent', vars: [v] },
    };
  },
});
