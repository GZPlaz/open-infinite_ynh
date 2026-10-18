/** Solving polynomial equations by factoring (GCF, grouping, quadratic form, cubes, rational zeros). */
import { Frac } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, offset, opt, pickVar } from '../../../generator';
import { Poly } from '../../../polynomial';
import type { Rng } from '../../../rng';
import { m, num } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { CATEGORY, type Cx, factoredTex, quadZerosNum, quadZerosTex, rearrange, rootFactor } from './common';

type Kind = 'gcf' | 'grouping' | 'quadform' | 'cubes' | 'rational';

interface Eq {
  k: number;
  j: number;
  factors: Poly[];
  kind: Kind;
}

const KINDS: Record<Difficulty, Kind[]> = {
  easy: ['gcf', 'quadform', 'grouping'],
  medium: ['gcf', 'quadform', 'grouping', 'cubes', 'rational'],
  hard: ['gcf', 'quadform', 'grouping', 'cubes', 'rational'],
};

function build(rng: Rng, d: Difficulty, kind: Kind): Eq {
  return attempt('solve-poly', () => {
    const sq = () => rng.int(1, d === 'easy' ? 5 : 7);
    switch (kind) {
      case 'gcf': {
        const j = d === 'hard' && rng.bool(0.3) ? 2 : 1;
        const k = rng.int(1, d === 'easy' ? 3 : 5);
        const t = rng.int(0, 2);
        const inner = t === 0 ? Poly.of(-(sq() ** 2), 0, 1) : t === 1 ? Poly.of(sq() ** 2, 0, 1) : Poly.fromRoots([rng.signedInt(1, 6, true), rng.signedInt(1, 6, true)]);
        if (inner.coef(0).isZero()) return null;
        return { k, j, factors: [inner], kind };
      }
      case 'grouping': {
        const a = d === 'easy' ? 1 : rng.int(1, 3);
        const b = rng.signedInt(1, 6, true);
        const t = rng.int(0, 2);
        const dd = t === 0 ? -(sq() ** 2) : t === 1 ? sq() ** 2 : rng.pick([-2, -3, -5, 2, 3, 5]);
        if (Math.abs(b) % a === 0 && a > 1) return null;
        return { k: 1, j: 0, factors: [Poly.linear(a, b), Poly.of(dd, 0, 1)], kind };
      }
      case 'quadform': {
        const p = rng.bool(0.6) ? -(sq() ** 2) : rng.signedInt(1, 9, true);
        const q = rng.bool(0.6) ? -(sq() ** 2) : rng.signedInt(1, 9, true);
        if (p === q) return null;
        if (p > 0 && q > 0 && rng.bool(0.6)) return null;
        const a = d === 'hard' && rng.bool(0.3) ? 4 : 1;
        const f1 = a === 4 ? Poly.of(-1, 0, 4) : Poly.of(p, 0, 1);
        return { k: 1, j: 0, factors: [f1, Poly.of(q, 0, 1)], kind };
      }
      case 'cubes': {
        const a = d === 'hard' ? rng.int(1, 3) : 1;
        const b = rng.int(1, 5);
        if (a > 1 && b % a === 0) return null;
        const s = rng.sign();
        return { k: d === 'hard' && rng.bool(0.3) ? rng.int(2, 3) : 1, j: 0, factors: [Poly.linear(a, s * b), Poly.of(b * b, -s * a * b, a * a)], kind };
      }
      case 'rational':
      default: {
        const r = d === 'hard' && rng.bool(0.5) ? new Frac(rng.signedInt(1, 5, true), rng.int(2, 3)) : new Frac(rng.signedInt(1, 5, true));
        const B = rng.int(-6, 6);
        const C = rng.signedInt(1, 10, true);
        const q = Poly.of(C, B, 1);
        return { k: 1, j: 0, factors: [rootFactor(r), q], kind };
      }
    }
  });
}

interface Root {
  tex: string;
  val: Cx;
}

function rootsOf(eq: Eq): Root[] {
  const out: Root[] = [];
  const add = (tex: string, val: Cx) => {
    if (!out.some((o) => Math.abs(o.val.re - val.re) < 1e-9 && Math.abs(o.val.im - val.im) < 1e-9)) out.push({ tex, val });
  };
  if (eq.j > 0) add('0', { re: 0, im: 0 });
  for (const f of eq.factors) {
    if (f.degree === 1) {
      const r = f.coef(0).neg().div(f.coef(1));
      add(num(r), { re: r.value, im: 0 });
    } else {
      const t = quadZerosTex(f);
      const v = quadZerosNum(f);
      if (t.length === 1) add(t[0]!, v[0]!);
      else t.forEach((tx, i) => add(tx, v[i]!));
    }
  }
  const real = out.filter((r) => Math.abs(r.val.im) < 1e-12).sort((a, b) => a.val.re - b.val.re);
  const cx = out.filter((r) => Math.abs(r.val.im) >= 1e-12);
  return [...real, ...cx];
}

function expandEq(eq: Eq): Poly {
  return eq.factors.reduce((p, f) => p.mul(f), new Poly([...Array.from({ length: eq.j }, () => 0), eq.k]));
}

export const solvingPolynomialEquations = defineTopic({
  id: 'alg2.poly.solve',
  subject: 'algebra2',
  category: CATEGORY,
  title: 'Solving Polynomial Equations',
  description: 'Solve polynomial equations by factoring: GCF, grouping, quadratic form, cubes and rational zeros.',
  instruction: (o) => (o.complex ? 'Find all solutions, including imaginary solutions.' : 'Find all real solutions.'),
  multipleChoice: true,
  defaultCount: 10,
  options: [{ type: 'boolean', id: 'complex', label: 'Include imaginary solutions', default: true }, opt.variedVariables(false)],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const complex = boolOpt(ctx, 'complex');
    const v = pickVar(rng, boolOpt(ctx, 'variedVars'));
    const kind = rng.pick(KINDS[difficulty]);
    const eq = attempt('solve-real', () => {
      const e = build(rng, difficulty, kind);
      const rs = rootsOf(e);
      if (!complex && !rs.some((r) => r.val.im === 0)) return null;
      return expandEq(e).c.every((c) => Math.abs(c.value) <= 200) ? e : null;
    });
    const poly = expandEq(eq);
    const keep = (rs: Root[]) => (complex ? rs : rs.filter((r) => r.val.im === 0));
    const roots = keep(rootsOf(eq));
    const std = `${poly.toTex(v)} = 0`;
    const rearr = difficulty === 'hard' ? rng.bool(0.8) : difficulty === 'medium' ? rng.bool(0.3) : false;
    const question = (rearr ? rearrange(rng, poly, v) : null) ?? std;
    const steps: string[] = [];
    if (question !== std) steps.push(`Standard form: $${std}$`);
    steps.push(`Factor: $${factoredTex({ k: eq.k, mono: eq.j, factors: eq.factors.map((p) => ({ p, e: 1 })) }, v)} = 0$`);
    steps.push('Set each factor equal to zero and solve.');
    const fmt = (rs: Root[]) => m(`${v} = ${rs.map((r) => r.tex).join(', ')}`);
    const answer = fmt(roots);
    const negate = (p: Poly) => {
      const q = new Poly(p.c.map((c, i) => (i % 2 ? c.neg() : c)));
      return q.lead().sign < 0 ? q.scale(-1) : q;
    };
    const flipConst = (p: Poly) => (p.degree === 2 ? new Poly(p.c.map((c, i) => (i === 0 ? c.neg() : c))) : p);
    const wrongEqs: Eq[] = [
      { ...eq, factors: eq.factors.map(negate) },
      { ...eq, factors: eq.factors.map(flipConst) },
      eq.j > 0 ? { ...eq, j: 0 } : { ...eq, factors: eq.factors.slice(0, -1) },
      { ...eq, factors: eq.factors.slice(1) },
    ];
    const wrongs = wrongEqs.map((w) => keep(rootsOf(w))).filter((rs) => rs.length > 0).map(fmt);
    if (complex && roots.some((r) => r.val.im !== 0)) wrongs.push(fmt(roots.filter((r) => r.val.im === 0)));
    return {
      question: m(question),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.filter((w) => w !== m(`${v} = `)), (k) => {
        const lin = eq.factors.findIndex((f) => f.degree === 1);
        const shifted: Eq =
          lin >= 0
            ? { ...eq, factors: eq.factors.map((f, i) => (i === lin ? f.add(Poly.of(offset(k) * f.lead().value)) : f)) }
            : { ...eq, factors: eq.factors.map((f, i) => (i === 0 ? f.add(Poly.of(offset(k))) : f)) };
        const rs = keep(rootsOf(shifted));
        return rs.length ? fmt(rs) : null;
      }),
      check: { kind: 'roots', variable: v, solutions: roots.map((r) => r.val) },
    };
  },
});
