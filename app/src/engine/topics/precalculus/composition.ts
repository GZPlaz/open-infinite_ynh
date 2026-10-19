/** Composition of functions, including the domain of the composite. */
import { Frac } from '../../fraction';
import { defineTopic, distinctDistractors, offset } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { linear, m, num, sum } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { ALL, INF, NINF, allExcept, end, intervalTex, iv, signedFrac, type Interval } from './common';

interface Pair {
  outer: string;
  inner: string;
  comp: string;
  domain: Interval[];
  wrongComp: string[];
  wrongDomain: Interval[][];
  steps: string[];
}

type Fam = 'linQuad' | 'quadLin' | 'sqrtLin' | 'linSqrt' | 'recipLin' | 'quadSqrt' | 'recipRecip' | 'shiftRecip' | 'sqrtQuad';

const POOLS: Record<Difficulty, Fam[]> = {
  easy: ['linQuad', 'quadLin', 'linQuad'],
  medium: ['sqrtLin', 'linSqrt', 'recipLin', 'quadLin'],
  hard: ['quadSqrt', 'recipRecip', 'shiftRecip', 'sqrtQuad', 'sqrtLin'],
};

function compose(p: Poly, q: Poly): Poly {
  let out = Poly.of(0);
  p.c.forEach((c, i) => (out = out.add(q.powInt(i).scale(c))));
  return out;
}

const ge = (x: Frac) => [iv(end(x), INF, true)];
const le = (x: Frac) => [iv(NINF, end(x), false, true)];

function build(rng: Rng, fam: Fam): Pair {
  const a = rng.signedInt(1, 5, true);
  const b = rng.signedInt(1, 9, true);
  const c = rng.signedInt(1, 9, true);
  switch (fam) {
    case 'linQuad':
    case 'quadLin': {
      const lin = Poly.of(b, a);
      const quad = Poly.of(rng.int(-6, 6), rng.int(-5, 5), rng.signedInt(1, 3, true));
      const [O, I] = fam === 'linQuad' ? [lin, quad] : [quad, lin];
      const comp = compose(O, I);
      return {
        outer: O.toTex(),
        inner: I.toTex(),
        comp: comp.toTex(),
        domain: ALL,
        wrongComp: [compose(I, O).toTex(), O.mul(I).toTex(), O.add(I).toTex(), comp.add(Poly.of(1)).toTex()],
        wrongDomain: [],
        steps: [`Substitute the inner function for $x$: ${m(`${O.toTex().replace(/x/g, `(${I.toTex()})`)}`)}`, `Expand: ${m(comp.toTex())}`, 'A polynomial is defined for all real numbers.'],
      };
    }
    case 'sqrtLin': {
      const inner = Poly.of(b, a);
      const rad = inner.add(Poly.of(c));
      if (rad.coef(0).isZero()) return build(rng, fam);
      const bound = rad.coef(0).neg().div(a);
      const D = a > 0 ? ge(bound) : le(bound);
      return {
        outer: `\\sqrt{${linear(1, c)}}`,
        inner: inner.toTex(),
        comp: `\\sqrt{${rad.toTex()}}`,
        domain: D,
        wrongComp: [sum([{ coef: a, sym: `\\sqrt{${linear(1, c)}}` }, { coef: b }]), `\\sqrt{${inner.toTex()}}`, `\\sqrt{${inner.add(Poly.of(-c)).toTex()}}`],
        wrongDomain: [ge(new Frac(-c)), a > 0 ? le(bound) : ge(bound), a > 0 ? ge(bound.neg()) : le(bound.neg())],
        steps: [`${m(`\\sqrt{(${inner.toTex()}) + ${c < 0 ? `(${c})` : c}} = \\sqrt{${rad.toTex()}}`)}`, `Need ${m(`${rad.toTex()} \\ge 0`)}, so ${m(`x ${a > 0 ? '\\ge' : '\\le'} ${num(bound)}`)}.`],
      };
    }
    case 'linSqrt': {
      const d = rng.int(-6, 6);
      const comp = sum([{ coef: a, sym: `\\sqrt{${linear(1, -d)}}` }, { coef: b }]);
      return {
        outer: linear(a, b),
        inner: `\\sqrt{${linear(1, -d)}}`,
        comp,
        domain: ge(new Frac(d)),
        wrongComp: [`\\sqrt{${linear(a, b - d)}}`, sum([{ coef: a, sym: `\\sqrt{x}` }, { coef: b - d }]), sum([{ coef: 1, sym: `\\sqrt{${linear(a, -d)}}` }, { coef: b }])],
        wrongDomain: [[iv(end(d), INF)], ge(new Frac(-d)), ALL],
        steps: [`${m(comp)}`, `The inner function needs ${m(`${linear(1, -d)} \\ge 0`)}, so ${m(`x \\ge ${d}`)}.`],
      };
    }
    case 'recipLin': {
      const k = rng.signedInt(1, 6, true);
      const den = Poly.of(b - c, a);
      if (den.coef(0).isZero() || b - c === 0) return build(rng, fam);
      const excl = new Frac(c - b, a);
      return {
        outer: signedFrac(k, linear(1, -c)),
        inner: linear(a, b),
        comp: signedFrac(k, den.toTex()),
        domain: allExcept([end(excl)]),
        wrongComp: [sum([{ coef: 1, sym: signedFrac(k * a, linear(1, -c)) }, { coef: b }]), signedFrac(k, linear(a, b)), signedFrac(k, linear(a, b + c))],
        wrongDomain: [allExcept([end(c)]), allExcept([end(excl.neg())]), ALL],
        steps: [`${m(signedFrac(k, `(${linear(a, b)}) ${c < 0 ? '+' : '-'} ${Math.abs(c)}`))} ${m(`= ${signedFrac(k, den.toTex())}`)}`, `The denominator is zero at ${m(`x = ${num(excl)}`)}.`],
      };
    }
    case 'quadSqrt': {
      const d = rng.int(-6, 6);
      const comp = linear(1, c - d);
      return {
        outer: `x^{2} ${c < 0 ? '-' : '+'} ${Math.abs(c)}`,
        inner: `\\sqrt{${linear(1, -d)}}`,
        comp,
        domain: ge(new Frac(d)),
        wrongComp: [`\\sqrt{x^{2} ${c - d < 0 ? '-' : '+'} ${Math.abs(c - d) || 1}}`, linear(1, c + d), `x^{2} ${c - d < 0 ? '-' : '+'} ${Math.abs(c - d) || 1}`],
        wrongDomain: [ALL, [iv(end(d), INF)], ge(new Frac(-d))],
        steps: [`${m(`(\\sqrt{${linear(1, -d)}})^{2} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${comp}`)}`, `The simplified form hides a restriction: the inner function needs ${m(`x \\ge ${d}`)}.`],
      };
    }
    case 'recipRecip': {
      const k = rng.signedInt(1, 6, true);
      const comp = Poly.of(-k * c, k).toTex();
      return {
        outer: signedFrac(k, 'x'),
        inner: `\\frac{1}{${linear(1, -c)}}`,
        comp,
        domain: allExcept([end(c)]),
        wrongComp: [signedFrac(k, linear(1, -c)), Poly.of(k * c, k).toTex(), signedFrac(1, linear(k, -c))],
        wrongDomain: [ALL, allExcept([end(0), end(c)]), allExcept([end(0)])],
        steps: [`${m(`${signedFrac(k, `\\frac{1}{${linear(1, -c)}}`)} = ${comp}`)}`, `The inner function is not defined at ${m(`x = ${c}`)}, so that value stays excluded.`],
      };
    }
    case 'shiftRecip': {
      const cc = rng.signedInt(1, 4, true);
      const den = sum([{ coef: 1 }, { coef: -cc, sym: 'x' }]);
      const pts = [end(0), end(new Frac(1, cc))].sort((p, q) => p.v - q.v);
      return {
        outer: `\\frac{1}{${linear(1, -cc)}}`,
        inner: '\\frac{1}{x}',
        comp: `\\frac{x}{${den}}`,
        domain: allExcept(pts),
        wrongComp: [`\\frac{1}{${linear(1, -cc)}}`, linear(1, -cc), `\\frac{x}{${sum([{ coef: 1 }, { coef: cc, sym: 'x' }])}}`, `\\frac{1}{${sum([{ coef: 1 }, { coef: -cc, sym: 'x' }])}}`],
        wrongDomain: [allExcept([end(new Frac(1, cc))]), allExcept([end(0), end(cc)].sort((p, q) => p.v - q.v)), allExcept([end(0)])],
        steps: [`${m(`\\frac{1}{\\frac{1}{x} ${cc < 0 ? '+' : '-'} ${Math.abs(cc)}} = \\frac{x}{${den}}`)}`, `Exclude ${m('x = 0')} (inner function) and ${m(`x = ${num(new Frac(1, cc))}`)} (zero denominator).`],
      };
    }
    case 'sqrtQuad':
    default: {
      const p = rng.int(1, 7);
      const outside = rng.bool();
      const inner = outside ? `x^{2} - ${p * p}` : `${p * p} - x^{2}`;
      const D = outside ? [iv(NINF, end(-p), false, true), iv(end(p), INF, true)] : [iv(end(-p), end(p), true, true)];
      const alt = outside ? [iv(end(-p), end(p), true, true)] : [iv(NINF, end(-p), false, true), iv(end(p), INF, true)];
      return {
        outer: '\\sqrt{x}',
        inner,
        comp: `\\sqrt{${inner}}`,
        domain: D,
        wrongComp: [outside ? `x - ${p * p}` : `${p * p} - x`, `x^{2} ${outside ? '-' : '+'} ${p}`, outside ? `x - ${p}` : `${p} - x`],
        wrongDomain: [alt, ge(new Frac(p)), outside ? [iv(NINF, end(-p)), iv(end(p), INF)] : [iv(end(-p), end(p))]],
        steps: [`${m(`\\sqrt{${inner}}`)}`, `Solve ${m(`${inner} \\ge 0`)}.`],
      };
    }
  }
}

export const composition = defineTopic({
  id: 'precalc.functions.composition',
  subject: 'precalculus',
  category: 'Functions',
  title: 'Composition of Functions',
  description: 'Find composite functions (f∘g)(x) and (g∘f)(x) and state their domains.',
  instruction: 'Find each composite function and its domain. Use interval notation.',
  multipleChoice: true,
  defaultCount: 8,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const pair = build(rng, rng.pick(POOLS[difficulty]));
    const fOuter = rng.bool();
    const [fTex, gTex] = fOuter ? [pair.outer, pair.inner] : [pair.inner, pair.outer];
    const op = fOuter ? '(f \\circ g)(x)' : '(g \\circ f)(x)';
    const fmt = (comp: string, D: Interval[]) => `${m(`${op} = ${comp}`)}; domain: ${m(intervalTex(D))}`;
    const answer = fmt(pair.comp, pair.domain);
    const cands: string[] = [];
    pair.wrongComp.forEach((w, i) => {
      cands.push(fmt(w, pair.domain));
      if (pair.wrongDomain[i]) cands.push(fmt(pair.comp, pair.wrongDomain[i]!));
    });
    const distractors = distinctDistractors(answer, cands, (k) => fmt(`${pair.comp} ${offset(k) < 0 ? '-' : '+'} ${Math.abs(offset(k))}`, pair.domain));
    return {
      question: `Given ${m(`f(x) = ${fTex}`)} and ${m(`g(x) = ${gTex}`)}, find ${m(op)} and its domain.`,
      answer,
      steps: pair.steps,
      distractors,
      check: { kind: 'precalculus.composition' },
    };
  },
});
