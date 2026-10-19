/** Rational expressions: simplifying, multiplying/dividing, adding/subtracting and complex fractions. */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, opt, pickVar } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { joinTerms } from '../radicals/common';
import { lcd, lin, ONE, polyFactoredTex, prod, Rat, rationalRoots, X } from './ratpoly';

export const RATIONAL_CATEGORY = 'Rational Expressions';

/** Distinct linear factors x + c (or ax + b on hard). */
export function factorPool(rng: Rng, count: number, d: Difficulty, allowLead = d === 'hard'): Poly[] {
  return attempt('factor-pool', () => {
    const out: Poly[] = [];
    for (let i = 0; i < count; i++) {
      const a = allowLead && rng.bool(0.35) ? rng.pick([2, 3]) : 1;
      let b = rng.int(-(d === 'easy' ? 6 : 9), d === 'easy' ? 6 : 9);
      if (a > 1 && b % a === 0) b += 1;
      if (b === 0 && a === 1 && rng.bool(0.6)) b = rng.signedInt(1, 7, true);
      const f = lin(a, b);
      if (out.some((g) => g.eq(f))) return null;
      out.push(f);
    }
    return out;
  });
}

/** `\frac{N}{D}` with both expanded (D = 1 → N). */
function fracTexExpanded(N: Poly, D: Poly, v: string): string {
  if (D.degree === 0 && D.coef(0).eq(1)) return N.toTex(v);
  return `\\frac{${N.toTex(v)}}{${D.toTex(v)}}`;
}

function sortedRoots(p: Poly): Frac[] {
  const out: Frac[] = [];
  for (const r of rationalRoots(p).roots) if (!out.some((x) => x.eq(r))) out.push(r);
  return out.sort((a, b) => a.cmp(b));
}

function wrongs(answer: string, cands: Array<Rat | null>, fallback: (k: number) => Rat | null, v: string, suffix = ''): string[] {
  const t = (r: Rat | null) => (r && !r.isZero() ? m(r.tex(v)) + suffix : null);
  return distinctDistractors(answer, cands.map(t), (k) => t(fallback(k)));
}

// ---------------------------------------------------------------- simplifying

export const simplifyRational = defineTopic({
  id: 'alg2.rational.simplify',
  subject: 'algebra2',
  title: 'Simplifying Rational Expressions',
  description: 'Factor the numerator and denominator and cancel common factors.',
  category: RATIONAL_CATEGORY,
  instruction: (o) => (o.excluded ? 'Simplify each expression and state the excluded values.' : 'Simplify each expression.'),
  multipleChoice: true,
  defaultCount: 12,
  options: [{ type: 'boolean', id: 'excluded', label: 'State excluded values', default: false }, opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const excluded = boolOpt(ctx, 'excluded');
    const built = attempt('rational-simplify', () => {
      if (difficulty === 'easy' && rng.bool(0.35)) {
        // monomials: a x^p / (b x^q)
        const p = rng.int(1, 6);
        const q = rng.int(1, 6);
        if (p === q) return null;
        const g = rng.int(2, 6);
        const a = g * rng.int(1, 5);
        const b = g * rng.int(1, 5);
        const N = Poly.of(...Array(p).fill(0), a);
        const D = Poly.of(...Array(q).fill(0), b);
        return { N, D, steps: [] as string[], nf: [] as Poly[], df: [] as Poly[], cf: [] as Poly[], cn: a, cd: b };
      }
      const pool = factorPool(rng, 4, difficulty);
      const cf = difficulty === 'hard' && rng.bool(0.4) ? [pool[0]!, pool[1]!] : [pool[0]!];
      const rest = pool.slice(cf.length);
      const nf = difficulty === 'easy' ? (rng.bool(0.5) ? [] : [rest[0]!]) : rng.bool(0.75) ? [rest[0]!] : [];
      const df = difficulty === 'easy' ? [rest[1]!] : rng.bool(0.8) ? [rest[1]!] : [];
      if (nf.length + df.length === 0) return null;
      if (cf.length + nf.length > 3 || cf.length + df.length > 3) return null;
      const g = rng.bool(difficulty === 'easy' ? 0.5 : 0.4) ? rng.int(2, 4) : 1;
      const cn = g * (rng.bool(0.3) ? rng.int(1, 3) : 1);
      const cd = g * (rng.bool(0.3) ? rng.int(1, 3) : 1) * (difficulty === 'hard' && rng.bool(0.2) ? -1 : 1);
      // opposite factor: c − x in the numerator (hard)
      const flip = difficulty === 'hard' && rng.bool(0.3);
      const nfac = [...cf.map((f, i) => (flip && i === 0 ? f.scale(-1) : f)), ...nf];
      const N = prod(nfac).scale(cn);
      const D = prod([...cf, ...df]).scale(cd);
      if (N.degree > 3 || D.degree > 3) return null;
      if (N.c.some((c) => Math.abs(c.n) > 120) || D.c.some((c) => Math.abs(c.n) > 120)) return null;
      return { N, D, steps: [] as string[], nf, df, cf, cn: flip ? -cn : cn, cd };
    });
    const { N, D, nf, df, cn, cd } = built;
    const question = `\\frac{${N.toTex(v)}}{${D.toTex(v)}}`;
    const ans = Rat.of(N, D);
    const ex = sortedRoots(D);
    const exTex = (rs: Frac[]) => m(`${v} \\neq ${rs.map((r) => num(r)).join(', ')}`);
    const suffix = excluded ? `; ${exTex(ex)}` : '';
    const answer = m(ans.tex(v)) + suffix;
    const steps = [m(`= \\frac{${polyFactoredTex(N, v)}}{${polyFactoredTex(D, v)}}`), m(`= ${ans.tex(v)}`)];
    if (excluded) steps.push(`Excluded values make the original denominator zero: ${exTex(ex)}.`);
    const sign1 = (fs: Poly[]) => (fs.length ? [fs[0]!.add(Poly.of(-2 * fs[0]!.coef(0).value)), ...fs.slice(1)] : fs);
    const cands: Array<Rat | null> = [
      ans.inv(),
      nf.length ? Rat.of(prod(sign1(nf)).scale(cn), prod(df).scale(cd)) : Rat.of(Poly.of(cn), prod(sign1(df)).scale(cd)),
      ans.neg(),
      Rat.of(prod(nf).add(Poly.of(1)).scale(cn), prod(df).scale(cd)),
    ];
    const distractors = excluded
      ? distinctDistractors(
          answer,
          [
            sortedRoots(ans.D).length && sortedRoots(ans.D).length !== ex.length ? m(ans.tex(v)) + `; ${exTex(sortedRoots(ans.D))}` : null,
            ...cands.map((r) => (r && !r.isZero() ? m(r.tex(v)) + suffix : null)),
          ],
          (k) => m(Rat.of(ans.N.scale(k + 1), ans.D).tex(v)) + suffix,
        )
      : wrongs(answer, cands, (k) => Rat.of(ans.N.scale(k + 1), ans.D), v);
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.ratexpr', variable: v },
    };
  },
});

// ---------------------------------------------------------------- multiplying and dividing

export const multiplyDivideRational = defineTopic({
  id: 'alg2.rational.multiply-divide',
  subject: 'algebra2',
  title: 'Multiplying and Dividing Rational Expressions',
  description: 'Multiply or divide rational expressions, factoring and cancelling to simplest form.',
  category: RATIONAL_CATEGORY,
  instruction: 'Simplify each expression.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'op',
      label: 'Operation',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Multiply and divide' },
        { value: 'multiply', label: 'Multiply only' },
        { value: 'divide', label: 'Divide only' },
      ],
    },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const opOpt = ctx.options.op;
    const divide = opOpt === 'divide' ? true : opOpt === 'multiply' ? false : rng.bool(difficulty === 'easy' ? 0.3 : 0.5);
    const built = attempt('rational-muldiv', () => {
      const pieces: Poly[] = [];
      if (difficulty === 'easy' && rng.bool(0.5)) {
        for (let i = 0; i < 4; i++) {
          const e = rng.int(0, 4);
          pieces.push(Poly.of(...Array(e).fill(0), rng.int(1, 12)));
        }
      } else {
        const pool = factorPool(rng, 4, difficulty);
        const slots: Poly[][] = [[], [], [], []];
        const pairs: Array<[number, number]> = divide ? [[0, 2], [3, 1]] : [[0, 3], [2, 1]];
        const shared = difficulty === 'easy' ? 1 : rng.int(1, 2);
        for (let i = 0; i < shared; i++) {
          const [a, b] = rng.pick(pairs);
          slots[a]!.push(pool[i]!);
          slots[b]!.push(pool[i]!);
        }
        for (let i = shared; i < 4; i++) if (rng.bool(0.7)) slots[rng.int(0, 3)]!.push(pool[i]!);
        if (slots.some((s) => s.length > 2)) return null;
        if (slots[1]!.length + slots[3]!.length === 0) return null;
        const consts = slots.map(() => (rng.bool(difficulty === 'easy' ? 0.3 : 0.45) ? rng.pick([2, 3, 4, 5, 6]) : 1));
        slots.forEach((s, i) => pieces.push(prod(s).scale(consts[i]!)));
      }
      const [N1, D1, N2, D2] = pieces as [Poly, Poly, Poly, Poly];
      if (N2.isZero()) return null;
      const F1 = new Rat(N1, D1);
      const F2 = new Rat(N2, D2);
      const ans = divide ? Rat.of(N1, D1).div(Rat.of(N2, D2)) : Rat.of(N1, D1).mul(Rat.of(N2, D2));
      if (ans.N.degree + ans.D.degree === 0) return null;
      if (D1.degree === 0 && D2.degree === 0) return null;
      return { N1, D1, N2, D2, F1, F2, ans };
    });
    const { N1, D1, N2, D2, ans } = built;
    const f1 = fracTexExpanded(N1, D1, v);
    const f2 = fracTexExpanded(N2, D2, v);
    const question = `${f1} ${divide ? '\\div' : '\\cdot'} ${f2}`;
    const ft = (N: Poly, D: Poly) => (D.degree === 0 && D.coef(0).eq(1) ? polyFactoredTex(N, v) : `\\frac{${polyFactoredTex(N, v)}}{${polyFactoredTex(D, v)}}`);
    const steps: string[] = [];
    if (divide) steps.push(m(`= ${f1} \\cdot ${fracTexExpanded(D2, N2, v)}`));
    steps.push(m(`= ${ft(N1, D1)} \\cdot ${divide ? ft(D2, N2) : ft(N2, D2)}`));
    steps.push(m(`= ${ans.tex(v)}`));
    const answer = m(ans.tex(v));
    const other = divide ? Rat.of(N1, D1).mul(Rat.of(N2, D2)) : Rat.of(N1, D1).div(Rat.of(N2, D2));
    const distractors = wrongs(
      answer,
      [other, ans.inv(), ans.neg(), divide ? Rat.of(D1, N1).mul(Rat.of(N2, D2)) : Rat.of(N1.mul(N2).add(Poly.of(1)), D1.mul(D2))],
      (k) => Rat.of(ans.N.scale(k + 1), ans.D),
      v,
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.ratexpr', variable: v },
    };
  },
});

// ---------------------------------------------------------------- adding and subtracting

export const addSubtractRational = defineTopic({
  id: 'alg2.rational.add-subtract',
  subject: 'algebra2',
  title: 'Adding and Subtracting Rational Expressions',
  description: 'Combine rational expressions over a least common denominator and simplify.',
  category: RATIONAL_CATEGORY,
  instruction: 'Simplify each expression.',
  multipleChoice: true,
  defaultCount: 10,
  options: [
    {
      type: 'select',
      id: 'op',
      label: 'Operation',
      default: 'mixed',
      choices: [
        { value: 'mixed', label: 'Add and subtract' },
        { value: 'add', label: 'Add only' },
        { value: 'subtract', label: 'Subtract only' },
      ],
    },
    opt.variedVariables(false),
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const opOpt = ctx.options.op;
    const sub = opOpt === 'subtract' ? true : opOpt === 'add' ? false : rng.bool(0.5);
    const built = attempt('rational-addsub', () => {
      let N1: Poly;
      let D1: Poly;
      let N2: Poly;
      let D2: Poly;
      const kind = difficulty === 'easy' ? rng.pick(['like', 'mono']) : difficulty === 'medium' ? rng.pick(['linear', 'linear', 'shared', 'like']) : rng.pick(['shared', 'quad', 'linear']);
      const pool = factorPool(rng, 3, difficulty, false);
      const smallLin = () => (rng.bool(0.5) ? Poly.of(rng.signedInt(1, 9, true)) : lin(rng.int(1, 4), rng.int(-6, 6)));
      if (kind === 'like') {
        D1 = D2 = rng.bool(0.6) ? pool[0]! : Poly.of(...Array(rng.int(1, 2)).fill(0), rng.int(1, 6));
        N1 = smallLin();
        N2 = smallLin();
      } else if (kind === 'mono') {
        D1 = Poly.of(...Array(rng.int(1, 2)).fill(0), rng.int(1, 6));
        D2 = Poly.of(...Array(rng.int(1, 3)).fill(0), rng.int(1, 6));
        if (D1.eq(D2)) return null;
        N1 = Poly.of(rng.int(1, 9));
        N2 = Poly.of(rng.int(1, 9));
      } else if (kind === 'linear') {
        D1 = pool[0]!;
        D2 = pool[1]!;
        N1 = rng.bool(0.7) ? Poly.of(rng.int(1, 8)) : lin(1, 0);
        N2 = Poly.of(rng.int(1, 8));
      } else if (kind === 'shared') {
        D1 = pool[0]!.mul(pool[1]!);
        D2 = pool[1]!;
        N1 = rng.bool(0.5) ? Poly.of(rng.int(1, 9)) : lin(rng.int(1, 3), rng.int(-5, 5));
        N2 = Poly.of(rng.int(1, 6));
        if (rng.bool(0.5)) [N1, D1, N2, D2] = [N2, D2, N1, D1];
      } else {
        D1 = pool[0]!.mul(pool[1]!);
        D2 = pool[1]!.mul(pool[2]!);
        N1 = rng.bool(0.5) ? Poly.of(rng.int(1, 9)) : lin(1, rng.int(-5, 5));
        N2 = rng.bool(0.5) ? Poly.of(rng.int(1, 9)) : lin(rng.int(1, 2), rng.int(-5, 5));
      }
      if (N1.isZero() || N2.isZero()) return null;
      const F1 = Rat.of(N1, D1);
      const F2 = Rat.of(N2, D2);
      if (!F1.N.eq(N1) || !F2.N.eq(N2)) return null; // terms already in lowest terms
      const ans = sub ? F1.sub(F2) : F1.add(F2);
      if (ans.isZero() || ans.N.degree + ans.D.degree === 0) return null;
      if (ans.N.c.some((c) => Math.abs(c.n) > 150)) return null;
      return { N1, D1, N2, D2, F1, F2, ans, kind };
    });
    const { N1, D1, N2, D2, F1, F2, ans, kind } = built;
    const question = `${fracTexExpanded(N1, D1, v)} ${sub ? '-' : '+'} ${fracTexExpanded(N2, D2, v)}`;
    const steps = [`Least common denominator: ${m(polyFactoredTex(lcd(D1, D2), v))}`, m(`= ${ans.tex(v)}`)];
    if (kind !== 'like' && kind !== 'mono') steps.splice(1, 0, `Rewrite each fraction over the LCD, then ${sub ? 'subtract' : 'add'} the numerators.`);
    const answer = m(ans.tex(v));
    const naive = D1.add(D2).isZero() ? null : Rat.of(sub ? N1.sub(N2) : N1.add(N2), D1.add(D2));
    const tops = Rat.of(sub ? N1.sub(N2) : N1.add(N2), D1.eq(D2) ? D1.mul(D2) : D1.mul(D2));
    const flipOp = sub ? F1.add(F2) : F1.sub(F2);
    const distractors = wrongs(answer, [naive, tops, flipOp, ans.neg()], (k) => Rat.of(ans.N.scale(k + 1), ans.D), v);
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.ratexpr', variable: v },
    };
  },
});

// ---------------------------------------------------------------- complex fractions

/** c·x^a / (d·x^b) or c/(x + p) as a display term and value. */
interface CTerm {
  tex: string;
  r: Rat;
}

function monoTerm(c: number, a: number, d: number, b: number, v: string): CTerm {
  const top = Poly.of(...Array(a).fill(0), Math.abs(c));
  const bot = Poly.of(...Array(b).fill(0), d);
  const body = bot.degree === 0 && d === 1 ? top.toTex(v) : `\\dfrac{${top.toTex(v)}}{${bot.toTex(v)}}`;
  return { tex: c < 0 ? `-${body}` : body, r: Rat.of(top.scale(Math.sign(c)), bot) };
}

function sumTerms(ts: CTerm[]): CTerm {
  return { tex: joinTerms(ts.map((t) => t.tex)), r: ts.reduce((acc, t) => acc.add(t.r), Rat.of(Poly.of(0))) };
}

export const complexFractions = defineTopic({
  id: 'alg2.rational.complex-fractions',
  subject: 'algebra2',
  title: 'Complex Fractions',
  description: 'Simplify fractions whose numerator and denominator contain fractions.',
  category: RATIONAL_CATEGORY,
  instruction: 'Simplify each expression.',
  multipleChoice: true,
  defaultCount: 10,
  options: [opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const built = attempt('complex-fraction', () => {
      let top: CTerm;
      let bot: CTerm;
      const form = difficulty === 'easy' ? rng.pick(['mono', 'mono', 'const']) : difficulty === 'medium' ? rng.pick(['const', 'square', 'recip']) : rng.pick(['shift', 'recip', 'square']);
      if (form === 'mono') {
        top = monoTerm(rng.int(1, 9), rng.int(0, 2), rng.int(1, 6), rng.int(0, 2), v);
        bot = monoTerm(rng.int(1, 9), rng.int(0, 2), rng.int(1, 6), rng.int(0, 2), v);
        if (!top.tex.includes('frac') || !bot.tex.includes('frac')) return null;
      } else if (form === 'const') {
        // (c0 + c1/x) / (d1/x)  or  (c1/x) / (d0 + d1/x²)
        top = sumTerms([monoTerm(rng.signedInt(1, 6, true), 0, 1, 0, v), monoTerm(rng.signedInt(1, 6, true), 0, 1, 1, v)]);
        bot = rng.bool(0.5) ? monoTerm(rng.int(1, 6), 0, rng.int(1, 3), rng.int(1, 2), v) : sumTerms([monoTerm(rng.int(1, 5), 0, 1, 0, v), monoTerm(rng.signedInt(1, 6, true), 0, 1, 2, v)]);
        if (rng.bool(0.5)) [top, bot] = [bot, top];
      } else if (form === 'square') {
        // (1 ± a/x) / (1 − a²/x²) and relatives
        const a = rng.int(1, 6);
        const s = rng.sign();
        const k = rng.pick([1, 1, 2]);
        top = sumTerms([monoTerm(k, 0, 1, 0, v), monoTerm(s * k * a, 0, 1, 1, v)]);
        bot = sumTerms([monoTerm(1, 0, 1, 0, v), monoTerm(-a * a, 0, 1, 2, v)]);
        if (rng.bool(0.3)) [top, bot] = [bot, top];
      } else if (form === 'recip') {
        // (1/x − 1/p) / (x − p)  or  (1/p + 1/x) / (1/p² − 1/x²)·…
        const p = rng.int(2, 8);
        const s = rng.sign();
        top = sumTerms([monoTerm(1, 0, 1, 1, v), monoTerm(-s, 0, p, 0, v)]);
        bot = sumTerms([monoTerm(1, 1, 1, 0, v), monoTerm(-s * p, 0, 1, 0, v)]);
        if (rng.bool(0.3)) [top, bot] = [bot, top];
      } else {
        // (a/(x + p) + b) / (c/(x + p) − d)
        const p = rng.signedInt(1, 6, true);
        const den = lin(1, p);
        const t = (c: number) => ({ tex: `${c < 0 ? '-' : ''}\\dfrac{${Math.abs(c)}}{${den.toTex(v)}}`, r: Rat.of(Poly.of(c), den) });
        top = sumTerms([t(rng.int(1, 9)), monoTerm(rng.signedInt(1, 5, true), 0, 1, 0, v)]);
        bot = sumTerms([t(rng.signedInt(1, 9, true)), monoTerm(rng.signedInt(1, 5, true), 0, 1, 0, v)]);
        if (rng.bool(0.3)) {
          const q = rng.signedInt(1, 6, true);
          if (q === p) return null;
          const c = rng.int(1, 5);
          bot = sumTerms([monoTerm(1, 0, 1, 0, v), { tex: `\\dfrac{${c}}{${lin(1, q).toTex(v)}}`, r: Rat.of(Poly.of(c), lin(1, q)) }]);
        }
      }
      if (top.r.isZero() || bot.r.isZero()) return null;
      const ans = top.r.div(bot.r);
      if (ans.N.degree + ans.D.degree === 0 && form !== 'mono') return null;
      if (ans.N.c.some((c) => Math.abs(c.n) > 200) || ans.D.c.some((c) => Math.abs(c.n) > 200)) return null;
      return { top, bot, ans };
    });
    const { top, bot, ans } = built;
    const question = `\\dfrac{${top.tex}}{${bot.tex}}`;
    const steps = [
      m(`= \\dfrac{${top.r.tex(v)}}{${bot.r.tex(v)}}`),
      m(`= ${top.r.tex(v)} \\cdot ${bot.r.inv().tex(v)}`),
      m(`= ${ans.tex(v)}`),
    ];
    const answer = m(ans.tex(v));
    const distractors = wrongs(
      answer,
      [ans.inv(), ans.neg(), Rat.of(top.r.N, bot.r.N), top.r.mul(bot.r)],
      (k) => Rat.of(ans.N.scale(k + 1), ans.D),
      v,
    );
    return {
      question: m(question),
      answer,
      steps,
      distractors,
      check: { kind: 'alg2-radicals-rational.ratexpr', variable: v },
    };
  },
});

export { ONE, X };
