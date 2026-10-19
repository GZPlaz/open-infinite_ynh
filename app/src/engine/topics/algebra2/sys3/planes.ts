/** Planes ax + by + cz = d: intercepts, points on the plane, equations from intercepts. */
import { Frac, gcdAll, lcm } from '../../../fraction';
import { attempt, boolOpt, defineTopic, distinctDistractors, strOpt } from '../../../generator';
import type { Rng } from '../../../rng';
import { m, num, paren, sum, tuple } from '../../../tex';
import type { Difficulty, ProblemContent } from '../../../types';
import { KIND } from '../smc-common';
import { axes3d, proj, type P3 } from './space';

const V = ['x', 'y', 'z'] as const;

interface Plane {
  c: [number, number, number];
  d: number;
}

const planeTex = (p: Plane) => `${sum(p.c.map((c, i) => ({ coef: c, sym: V[i]! })))} = ${p.d}`;
const lhsAt = (p: Plane, q: readonly number[]) => p.c.reduce((s, c, i) => s + c * q[i]!, 0);

/** Intercept values (null when the plane is parallel to that axis). */
const intercepts = (p: Plane): Array<Frac | null> => p.c.map((c) => (c === 0 ? null : new Frac(p.d, c)));

function interceptText(vals: Array<Frac | null>): string {
  return vals
    .map((v, i) => `$${V[i]}$-intercept: ${v === null ? 'none' : `$${tuple(V.map((_, j) => (j === i ? v : Frac.ZERO)))}$`}`)
    .join(', ');
}

/** Primitive integer form with a positive leading coefficient. */
function primitive(p: Plane): Plane {
  const g = gcdAll([...p.c, p.d]) || 1;
  const lead = p.c.find((c) => c !== 0)!;
  const s = lead < 0 ? -1 : 1;
  return { c: p.c.map((c) => (s * c) / g) as [number, number, number], d: (s * p.d) / g };
}

/** Plane through (p,0,0), (0,q,0), (0,0,r). */
function throughIntercepts(ints: Frac[]): Plane {
  const coefs = ints.map((v) => v.inv());
  const L = coefs.reduce((l, c) => lcm(l, c.d), 1);
  return primitive({ c: coefs.map((c) => c.mul(L).value) as [number, number, number], d: L });
}

function randomPlane(rng: Rng, d: Difficulty, allowZero: boolean, small: boolean): Plane {
  return attempt('plane', () => {
    if (d === 'easy') {
      const D = rng.pick([6, 12, 12, 18, 24, 30, 36]);
      const divs = Array.from({ length: D }, (_, i) => i + 1).filter((k) => D % k === 0 && k <= 12 && D / k <= (small ? 8 : 12));
      const c = [0, 1, 2].map(() => rng.pick(divs) * (rng.bool(0.3) ? -1 : 1)) as [number, number, number];
      return { c, d: D };
    }
    const c = [0, 1, 2].map(() => rng.signedInt(1, d === 'medium' ? 6 : 9, true)) as [number, number, number];
    if (allowZero && rng.bool(0.3)) c[rng.int(0, 2)] = 0;
    const p = primitive({ c, d: rng.signedInt(2, d === 'medium' ? 24 : 36, true) });
    const ints = intercepts(p).filter((v): v is Frac => v !== null);
    if (ints.some((v) => v.d > 9)) return null;
    if (small && ints.some((v) => Math.abs(v.value) > 8)) return null;
    if (ints.every((v) => v.isInt()) && rng.bool(0.6)) return null;
    return p;
  });
}

function sketch(p: Plane) {
  const ints = intercepts(p) as Frac[];
  const R = Math.min(8, Math.max(3, Math.ceil(Math.max(...ints.map((v) => Math.abs(v.value)))) + 1));
  const b = axes3d(R, R > 5 ? 11 : 14);
  const pts = ints.map((v, i) => proj(V.map((_, j) => (j === i ? v.value : 0)) as unknown as P3));
  b.polygon(pts, { ink: 'accent', fill: 'accent', weight: 1.4 });
  pts.forEach((q) => b.dot(q, false, 'accent'));
  return b.build(`The plane ${planeTex(p)} sketched through its three intercepts`);
}

type Task = 'intercepts' | 'contains' | 'equation';

const LETTERS = [
  ['A', 'B', 'C'],
  ['P', 'Q', 'R'],
  ['J', 'K', 'L'],
];

function subsetText(names: string[]): string {
  if (names.length === 0) return 'None of them';
  if (names.length === 3) return 'All three';
  if (names.length === 1) return `Only $${names[0]}$`;
  return `$${names[0]}$ and $${names[1]}$`;
}

export const planes = defineTopic({
  id: 'alg2.sys3.planes',
  subject: 'algebra2',
  title: 'Planes in Three Dimensions',
  description: 'Intercepts of ax + by + cz = d, points on a plane, and equations of planes from their intercepts.',
  category: 'Systems of Equations and Inequalities',
  instruction: (o) =>
    o.task === 'intercepts'
      ? o.graph
        ? 'Find the intercepts of each plane and sketch it.'
        : 'Find the intercepts of each plane.'
      : o.task === 'contains'
        ? 'Decide which of the points lie on each plane.'
        : o.task === 'equation'
          ? 'Write an equation of each plane in standard form.'
          : 'Answer each question about planes.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Problem type',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'intercepts', label: 'Find the intercepts' },
        { value: 'contains', label: 'Does a point lie on the plane?' },
        { value: 'equation', label: 'Equation from the intercepts' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Sketch the plane through its intercepts', default: false },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const chosen = strOpt(ctx, 'task');
    const task: Task = chosen === 'any' ? rng.pick<Task>(['intercepts', 'contains', 'equation']) : (chosen as Task);
    const graph = boolOpt(ctx, 'graph');

    if (task === 'intercepts') {
      const p = randomPlane(rng, difficulty, difficulty === 'hard' && !graph, graph);
      const ints = intercepts(p);
      const answer = interceptText(ints);
      const cands = [
        interceptText(ints.map((v) => (v ? v.neg() : v))),
        interceptText(p.c.map((c) => (c === 0 ? null : new Frac(c, p.d)))),
        interceptText([ints[1]!, ints[2]!, ints[0]!].map((v, i) => (p.c[i] === 0 ? null : v ?? new Frac(p.d)))),
        interceptText(p.c.map((c) => (c === 0 ? null : new Frac(p.d - c)))),
      ];
      const distractors = distinctDistractors(answer, cands, (k) => interceptText(ints.map((v, i) => (v && i === (k - 1) % 3 ? v.add(Math.ceil(k / 3)) : v))));
      const steps = V.map((v, i) => {
        const others = V.filter((_, j) => j !== i).map((w) => `${w} = 0`).join(', ');
        return p.c[i] === 0
          ? `$${v}$ does not appear, so the plane is parallel to the $${v}$-axis: no $${v}$-intercept.`
          : Math.abs(p.c[i]!) === 1 && p.c[i]! > 0
          ? `Let $${others}$: $${v} = ${p.d}$.`
          : `Let $${others}$: $${sum([{ coef: p.c[i]!, sym: v }])} = ${p.d}$, so $${v} = ${num(ints[i]!)}$.`;
      });
      return {
        question: `$${planeTex(p)}$`,
        answer,
        steps,
        distractors,
        answerDiagram: graph ? sketch(p) : undefined,
        check: { kind: `${KIND}.plane`, task },
      };
    }

    if (task === 'contains') {
      const p = attempt('lattice plane', () => {
        const q = randomPlane(rng, difficulty === 'easy' ? 'medium' : difficulty, false, false);
        return q.d % gcdAll(q.c) === 0 ? q : null;
      });
      const R = { easy: 5, medium: 7, hard: 9 }[difficulty];
      const names = rng.pick(LETTERS);
      const onFlags = names.map(() => rng.bool(0.5));
      const pts = onFlags.map((on) =>
        attempt('plane point', () => {
          const q = [rng.int(-R, R), rng.int(-R, R), rng.int(-R, R)];
          const k = rng.bool(0.7) ? p.c.reduce((b, c, i) => (Math.abs(c) < Math.abs(p.c[b]!) ? i : b), 0) : rng.int(0, 2);
          const rest = p.d - lhsAt(p, q.map((v, i) => (i === k ? 0 : v)));
          if (rest % p.c[k]! !== 0) return null;
          q[k] = rest / p.c[k]!;
          if (Math.abs(q[k]!) > 2 * R) return null;
          if (!on) q[rng.int(0, 2)] += rng.pick([-2, -1, 1, 2]);
          return lhsAt(p, q) === p.d ? (on ? q : null) : on ? null : q;
        }),
      );
      const truth = names.filter((_, i) => onFlags[i]);
      const answer = subsetText(truth);
      const all = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => names.filter((_, i) => mask & (1 << i)));
      const near = all.filter((s) => s.length !== truth.length && Math.abs(s.length - truth.length) === 1);
      const distractors = distinctDistractors(answer, rng.shuffle(near).map(subsetText), (k) => subsetText(all[k % 8]!));
      const steps = pts.map((q, i) => `$${names[i]}$: $${sum(p.c.map((c, j) => ({ coef: c, sym: paren(q[j]!) })))} = ${lhsAt(p, q)}$ ${onFlags[i] ? `$= ${p.d}$, on the plane` : `$\\ne ${p.d}$, not on the plane`}`);
      return {
        question: `Which of the points ${pts.map((q, i) => `$${names[i]}${tuple(q)}$`).join(', ')} lie on the plane $${planeTex(p)}$?`,
        answer,
        steps,
        distractors,
        check: { kind: `${KIND}.plane`, task },
      };
    }

    // equation from intercepts
    const ints = attempt('intercepts', () => {
      const R = graph ? 7 : { easy: 6, medium: 9, hard: 10 }[difficulty];
      const vals = V.map(() => {
        if (difficulty === 'hard' && rng.bool(0.35)) return new Frac(rng.signedInt(1, 2 * R, true) | 1, 2);
        return new Frac(rng.signedInt(1, R, difficulty !== 'easy' || rng.bool(0.3)));
      });
      if (difficulty === 'easy' && lcm(lcm(vals[0]!.n, vals[1]!.n), vals[2]!.n) > 24) return null;
      if (graph && vals.some((v) => Math.abs(v.value) > 7)) return null;
      const p = throughIntercepts(vals);
      if (Math.abs(p.d) > 120) return null;
      return vals;
    });
    const p = throughIntercepts(ints);
    const answer = m(planeTex(p));
    const naive: Plane = { c: ints.map((v) => v.value) as unknown as [number, number, number], d: 1 };
    const naiveTex = ints.every((v) => v.isInt()) ? m(planeTex(primitive(naive))) : null;
    const flip: Plane = { c: [p.c[0], p.c[1], -p.c[2]], d: p.d };
    const rhsWrong: Plane = { c: p.c, d: p.d + (p.d > 0 ? 1 : -1) * Math.max(1, Math.abs(p.c[0])) };
    const swap: Plane = { c: [p.c[1], p.c[0], p.c[2]], d: p.d };
    const distractors = distinctDistractors(answer, [naiveTex, m(planeTex(flip)), m(planeTex(swap)), m(planeTex(rhsWrong))], (k) => m(planeTex({ c: p.c, d: p.d + k })));
    const interceptForm = `\\frac{x}{${num(ints[0]!)}} + \\frac{y}{${num(ints[1]!)}} + \\frac{z}{${num(ints[2]!)}} = 1`;
    return {
      question: `Write an equation of the plane with $x$-intercept $${num(ints[0]!)}$, $y$-intercept $${num(ints[1]!)}$, and $z$-intercept $${num(ints[2]!)}$.`,
      answer,
      steps: [`Intercept form: $${interceptForm}$`, `Clear the fractions: $${planeTex(p)}$`],
      distractors,
      answerDiagram: graph ? sketch(p) : undefined,
      check: { kind: `${KIND}.plane`, task },
    };
  },
});
