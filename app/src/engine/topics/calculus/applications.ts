/** Applications of differentiation: tangent lines, related rates, extrema, concavity, MVT, motion, L'Hôpital, optimization. */
import { Frac } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num, sum, tuple, withUnit } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { atom, fderiv, ft, ftex, lin, piTex, pickName, randPoly, sqrtFracTex, type FTerm } from './common';

const ds = (t: string) => `\\displaystyle ${t}`;
const lineTex = (mm: Frac, b: Frac) => `y = ${sum([{ coef: mm, sym: 'x' }, { coef: b }])}`;
const pt = (x: Frac | number, y: Frac | number) => tuple([x, y]);

// ---------------------------------------------------------------- tangent and normal lines

interface Curve {
  tex: string;
  at: number;
  y: Frac;
  slope: Frac;
}

function curveFor(rng: Rng, d: Difficulty): Curve {
  const kind = rng.pick(d === 'easy' ? ['poly'] : d === 'medium' ? ['poly', 'rational', 'root'] : ['exp', 'ln', 'sin', 'rational', 'root']);
  switch (kind) {
    case 'poly': {
      const p = randPoly(rng, d === 'easy' ? 2 : 3, d === 'easy' ? 4 : 3, 0.7);
      const a = rng.int(-3, 3);
      return { tex: p.toTex(), at: a, y: p.eval(a), slope: p.derivative().eval(a) };
    }
    case 'rational': {
      const k = rng.signedInt(1, 8, true);
      const b = rng.int(-4, 4);
      const a = attempt('tan-rat', () => {
        const a = rng.int(-4, 4);
        return a + b === 0 ? null : a;
      });
      const den = Poly.of(b, 1).toTex();
      return { tex: `\\frac{${k}}{${den}}`, at: a, y: new Frac(k, a + b), slope: new Frac(-k, (a + b) ** 2) };
    }
    case 'root': {
      const k = rng.int(1, 4);
      const b = rng.int(-3, 5);
      const r = rng.int(1, 4);
      const a = r * r - b;
      return { tex: `${k === 1 ? '' : k}\\sqrt{${Poly.of(b, 1).toTex()}}`, at: a, y: new Frac(k * r), slope: new Frac(k, 2 * r) };
    }
    default: {
      // c·g(kx) + polynomial at a point where g is clean
      const c = rng.signedInt(1, 4, true);
      const k = rng.int(1, 3);
      const p = randPoly(rng, rng.int(1, 2), 4, 0.8);
      let T: FTerm[];
      let a: number;
      if (kind === 'exp') {
        T = [ft(c, 0, [atom('exp', k)])];
        a = 0;
      } else if (kind === 'ln') {
        T = [ft(c, 0, [atom('ln')])];
        a = 1;
      } else {
        T = [ft(c, 0, [atom(rng.pick(['sin', 'cos'] as const), k)])];
        a = 0;
      }
      const all = [...T, ...p.c.map((q, i) => ft(q, i)).filter((t) => !t.c.isZero()).reverse()];
      const val = (ts: FTerm[]) =>
        ts.reduce((s, t) => {
          let v = t.c.mul(new Frac(a).pow(t.p.n));
          for (const at of t.atoms) v = v.mul(at.fn === 'exp' ? 1 : at.fn === 'ln' ? 0 : at.fn === 'cos' ? 1 : 0);
          return s.add(v);
        }, Frac.ZERO);
      return { tex: ftex(all), at: a, y: val(all), slope: val(fderiv(all)) };
    }
  }
}

export const tangentLines = defineTopic({
  id: 'calc.tangent-lines',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: 'Tangent and Normal Lines',
  description: 'Equations of tangent and normal lines to a curve at a given x-value.',
  instruction: (o) => (o.line === 'normal' ? 'Find the equation of the normal line at the given value.' : o.line === 'tangent' ? 'Find the equation of the tangent line at the given value.' : 'Find the equation of the indicated line at the given value.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'line',
      label: 'Line',
      default: 'tangent',
      choices: [
        { value: 'tangent', label: 'Tangent lines' },
        { value: 'normal', label: 'Normal lines' },
        { value: 'mixed', label: 'Mixed' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const lOpt = strOpt(ctx, 'line');
    const normal = lOpt === 'normal' || (lOpt === 'mixed' && rng.bool());
    const c = curveFor(rng, difficulty);
    const { at, y, slope } = c;
    const steps = [`Point: $(${at}, ${num(y)})$`.replace(/\(([^,]+), ([^)]+)\)/, (_, a, b) => `(${a}, ${b})`), `Slope of the tangent: $f'(${at}) = ${num(slope)}$`];
    let answer: string;
    let wrongs: string[];
    const tangent = (mm: Frac) => lineTex(mm, y.sub(mm.mul(at)));
    if (!normal) {
      answer = tangent(slope);
      wrongs = [lineTex(slope, y.add(slope.mul(at))), slope.isZero() ? `x = ${at}` : tangent(slope.inv().neg()), lineTex(y, slope.sub(y.mul(at))), tangent(slope.neg())];
    } else if (slope.isZero()) {
      answer = `x = ${at}`;
      steps.push('The tangent is horizontal, so the normal line is vertical.');
      wrongs = [`y = ${num(y)}`, `x = ${num(y)}`, `y = x ${y.sub(at).sign < 0 ? '-' : '+'} ${num(y.sub(at).abs())}`.replace(/ \+ 0$/, '')];
    } else {
      const mn = slope.inv().neg();
      steps.push(`Normal slope: $${num(mn)}$`);
      answer = tangent(mn);
      wrongs = [tangent(slope), tangent(slope.inv()), lineTex(mn, y.add(mn.mul(at))), tangent(mn.neg())];
    }
    steps.push(m(answer));
    return {
      question: `${normal ? 'Normal' : 'Tangent'} line to $${ds(`y = ${c.tex}`)}$ at $x = ${at}$`,
      answer: m(answer),
      steps,
      distractors: distinctDistractors(m(answer), wrongs.map(m), (k) => m(lineTex(normal && !slope.isZero() ? slope.inv().neg() : slope, y.sub(slope.mul(at)).add(offset(k))))),
      check: { kind: 'calculus.tangent' },
    };
  },
});

// ---------------------------------------------------------------- related rates

/** Central difference, used to compute the expected rate independently of the closed form. */
const rate = (f: (t: number) => number) => (f(1e-4) - f(-1e-4)) / 2e-4;

export const relatedRates = defineTopic({
  id: 'calc.related-rates',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: 'Related Rates',
  description: 'Word problems: expanding circles and spheres, growing squares and cubes, sliding ladders, filling cones, separating cars.',
  instruction: 'Solve each related rates problem.',
  multipleChoice: true,
  defaultCount: 6,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const KINDS: Record<Difficulty, string[]> = { easy: ['circle', 'square', 'cube'], medium: ['sphere', 'ladder', 'cars', 'circle'], hard: ['cone', 'sphereInv', 'ladder', 'cars'] };
    const kind = rng.pick(KINDS[difficulty]);
    const name = pickName(rng);
    const u = rng.pick(['cm', 'in', 'ft', 'm']);
    const tu = rng.pick(['s', 'min']);
    const ru = (p = 1) => (p === 1 ? `\\text{ ${u}/${tu}}` : `\\text{ ${u}}^{${p}}\\text{/${tu}}`);
    const steps: string[] = [];
    let question: string;
    let lhs: string;
    let value: Frac; // coefficient (times π when pi)
    let pi = false;
    let expected: number;
    let wrongs: Array<[Frac, boolean]>;
    switch (kind) {
      case 'circle': {
        const r = rng.int(2, 12);
        const dr = rng.int(1, 6);
        const what = rng.pick(['A stone is dropped in a pond, and the radius of the circular ripple', 'An oil spill spreads in a circle, and its radius', 'The radius of a circular puddle']);
        question = `${what} grows at $${dr}${ru()}$. How fast is the area increasing when the radius is $${r}\\text{ ${u}}$?`;
        lhs = '\\frac{dA}{dt}';
        value = new Frac(2 * r * dr);
        pi = true;
        expected = rate((t) => Math.PI * (r + dr * t) ** 2);
        steps.push('$A = \\pi r^{2}$, so $\\frac{dA}{dt} = 2\\pi r\\frac{dr}{dt}$', `$\\frac{dA}{dt} = 2\\pi(${r})(${dr})$`);
        wrongs = [[new Frac(r * dr), true], [new Frac(2 * r * dr), false], [new Frac(r * r * dr), true]];
        break;
      }
      case 'square':
      case 'cube': {
        const s = rng.int(2, 15);
        const ds_ = rng.int(1, 5);
        const cube = kind === 'cube';
        question = cube
          ? `${name} is watching an ice cube melt; its edge shrinks at $${ds_}${ru()}$. How fast is the volume changing when the edge is $${s}\\text{ ${u}}$?`
          : `The sides of a square tile pattern grow at $${ds_}${ru()}$. How fast is the area growing when each side is $${s}\\text{ ${u}}$?`;
        lhs = cube ? '\\frac{dV}{dt}' : '\\frac{dA}{dt}';
        value = new Frac(cube ? -3 * s * s * ds_ : 2 * s * ds_);
        expected = rate((t) => (cube ? (s - ds_ * t) ** 3 : (s + ds_ * t) ** 2));
        steps.push(cube ? `$V = s^{3}$, so $\\frac{dV}{dt} = 3s^{2}\\frac{ds}{dt} = 3(${s})^{2}(-${ds_})$` : `$A = s^{2}$, so $\\frac{dA}{dt} = 2s\\frac{ds}{dt} = 2(${s})(${ds_})$`);
        wrongs = cube ? [[value.neg(), false], [new Frac(-s * s * ds_), false], [new Frac(-3 * s * ds_), false]] : [[new Frac(s * ds_), false], [new Frac(s * s * ds_), false], [new Frac(4 * ds_), false]];
        break;
      }
      case 'sphere':
      case 'sphereInv': {
        const r = rng.int(2, 10);
        if (kind === 'sphere') {
          const dr = rng.int(1, 4);
          question = `${name} inflates a spherical balloon so that its radius grows at $${dr}${ru()}$. How fast is the volume increasing when the radius is $${r}\\text{ ${u}}$?`;
          lhs = '\\frac{dV}{dt}';
          value = new Frac(4 * r * r * dr);
          expected = rate((t) => (4 / 3) * Math.PI * (r + dr * t) ** 3);
          steps.push('$V = \\frac{4}{3}\\pi r^{3}$, so $\\frac{dV}{dt} = 4\\pi r^{2}\\frac{dr}{dt}$', `$\\frac{dV}{dt} = 4\\pi(${r})^{2}(${dr})$`);
          wrongs = [[new Frac(4 * r * r * r * dr, 3), true], [new Frac(4 * r * r * dr), false], [new Frac(2 * r * dr), true]];
        } else {
          const dV = rng.int(2, 20) * 4;
          question = `Air is pumped into a spherical balloon at $${dV}${ru(3)}$. How fast is the radius increasing when the radius is $${r}\\text{ ${u}}$?`;
          lhs = '\\frac{dr}{dt}';
          value = new Frac(dV, 4 * r * r);
          // dr/dt = dV/dt ÷ dV/dr
          expected = dV / rate((t) => (4 / 3) * Math.PI * (r + t) ** 3);
          steps.push('$\\frac{dV}{dt} = 4\\pi r^{2}\\frac{dr}{dt}$', `$${dV} = 4\\pi(${r})^{2}\\frac{dr}{dt}$`);
          wrongs = [[new Frac(dV, 4 * r * r), false], [new Frac(dV, 2 * r), true], [new Frac(4 * r * r, dV), true]];
          pi = true;
          const show = (v: Frac, p: boolean) => (p ? (v.n === 1 ? `\\frac{1}{${v.d}\\pi}` : `\\frac{${v.n}}{${v.d === 1 ? '' : v.d}\\pi}`) : num(v));
          const ans = `$${lhs} = ${show(value, true)}${ru()}$`;
          steps.push(ans);
          return {
            question,
            answer: ans,
            steps,
            distractors: distinctDistractors(ans, wrongs.map(([v, p]) => `$${lhs} = ${show(v, p)}${ru()}$`), (k) => `$${lhs} = ${show(value.add(offset(k)), true)}${ru()}$`),
            check: { kind: 'expect', value: expected, tol: 1e-6 },
          };
        }
        pi = true;
        break;
      }
      case 'ladder': {
        const [a0, b0, c0] = rng.pick([
          [3, 4, 5],
          [6, 8, 10],
          [5, 12, 13],
          [9, 12, 15],
          [8, 15, 17],
          [12, 16, 20],
        ] as const);
        const swap = rng.bool();
        const x = swap ? b0 : a0;
        const y = swap ? a0 : b0;
        const v = rng.int(1, 4);
        const unit = rng.pick(['ft', 'm']);
        question = `A $${c0}\\text{ ${unit}}$ ladder leans against a wall. ${name} pulls the bottom away from the wall at $${v}\\text{ ${unit}/s}$. How fast is the top sliding down the wall when the bottom is $${x}\\text{ ${unit}}$ from the wall?`;
        lhs = '\\frac{dy}{dt}';
        value = new Frac(-x * v, y);
        expected = rate((t) => Math.sqrt(c0 * c0 - (x + v * t) ** 2));
        steps.push(`$x^{2} + y^{2} = ${c0 * c0}$, so $2x\\frac{dx}{dt} + 2y\\frac{dy}{dt} = 0$`, `When $x = ${x}$, $y = ${y}$: $\\frac{dy}{dt} = -\\frac{${x}(${v})}{${y}}$`);
        const ans = `$${lhs} = ${num(value)}\\text{ ${unit}/s}$`;
        steps.push(ans);
        const alt = (f: Frac) => `$${lhs} = ${num(f)}\\text{ ${unit}/s}$`;
        return {
          question,
          answer: ans,
          steps,
          distractors: distinctDistractors(ans, [alt(value.neg()), alt(new Frac(-y * v, x)), alt(new Frac(-v * c0, y))], (k) => alt(value.add(offset(k)))),
          check: { kind: 'expect', value: expected, tol: 1e-6 },
        };
      }
      case 'cars': {
        const [a0, b0, c0] = rng.pick([
          [3, 4, 5],
          [5, 12, 13],
          [8, 15, 17],
          [7, 24, 25],
        ] as const);
        const t0 = rng.int(1, 3);
        const k = rng.int(5, 12);
        // speeds chosen so that the legs after t0 hours are k·a0, k·b0
        const va = (k * a0) / t0;
        const vb = (k * b0) / t0;
        if (!Number.isInteger(va) || !Number.isInteger(vb)) return relatedRates.generate({ ...ctx, rng: rng.fork('cars') });
        const n2 = rng.pick(['Ana', 'Ben', 'Chen', 'Dev', 'Elif', 'Femi'].filter((nn) => nn !== name));
        question = `${name} drives north from an intersection at $${vb}\\text{ mi/h}$ while ${n2} drives east from it at $${va}\\text{ mi/h}$, both starting at noon. How fast is the distance between them increasing $${t0}$ hour${t0 === 1 ? '' : 's'} later?`;
        lhs = '\\frac{ds}{dt}';
        const dist = c0 * k;
        value = new Frac(va * k * a0 + vb * k * b0, dist);
        expected = rate((t) => Math.hypot(va * (t0 + t), vb * (t0 + t)));
        steps.push(`After $${t0}$ h: $x = ${k * a0}$, $y = ${k * b0}$, $s = ${dist}$`, `$s\\frac{ds}{dt} = x\\frac{dx}{dt} + y\\frac{dy}{dt}$`);
        const ans = `$${lhs} = ${num(value)}\\text{ mi/h}$`;
        steps.push(ans);
        const alt = (f: Frac) => `$${lhs} = ${num(f)}\\text{ mi/h}$`;
        return {
          question,
          answer: ans,
          steps,
          distractors: distinctDistractors(ans, [alt(new Frac(va + vb)), alt(new Frac(Math.abs(vb - va))), alt(new Frac(va * va + vb * vb, dist))], (q) => alt(value.add(offset(q)))),
          check: { kind: 'expect', value: expected, tol: 1e-6 },
        };
      }
      case 'cone':
      default: {
        // cone tank, vertex down: radius R, height H; water flows in at Q; find dh/dt at depth h
        const ratio = rng.pick([
          [1, 2],
          [1, 3],
          [2, 3],
          [1, 1],
          [3, 4],
        ] as const);
        const sc = rng.int(2, 4);
        const R = ratio[0] * sc;
        const H = ratio[1] * sc;
        const h = rng.int(1, H);
        const Q = rng.int(1, 9);
        question = `Water pours into an inverted conical tank at $${Q}\\text{ ${u}}^{3}\\text{/${tu}}$. The tank is $${H}\\text{ ${u}}$ tall with a top radius of $${R}\\text{ ${u}}$. How fast is the water level rising when the water is $${h}\\text{ ${u}}$ deep?`;
        lhs = '\\frac{dh}{dt}';
        // V = π R² h³ / (3H²)  ⇒  dh/dt = Q H² / (π R² h²)
        value = new Frac(Q * H * H, R * R * h * h);
        expected = Q / rate((t) => (Math.PI * R * R * (h + t) ** 3) / (3 * H * H));
        steps.push(`$r = \\frac{${R}}{${H}}h$, so $V = \\frac{1}{3}\\pi r^{2}h = ${num(new Frac(R * R, 3 * H * H))}\\pi h^{3}$`.replace('= 1\\pi', '= \\pi'), `$\\frac{dV}{dt} = ${num(new Frac(R * R, H * H))}\\pi h^{2}\\frac{dh}{dt}$`.replace('= 1\\pi', '= \\pi'));
        const show = (v: Frac) => (v.n === 1 ? `\\frac{1}{${v.d}\\pi}` : `\\frac{${v.n}}{${v.d === 1 ? '' : v.d}\\pi}`);
        const ans = `$${lhs} = ${show(value)}${ru()}$`;
        steps.push(ans);
        const alt = (v: Frac) => `$${lhs} = ${show(v)}${ru()}$`;
        return {
          question,
          answer: ans,
          steps,
          distractors: distinctDistractors(ans, [alt(value.mul(3)), alt(new Frac(Q, h * h)), alt(new Frac(Q * H, R * h * h))], (k) => alt(value.add(offset(k)))),
          check: { kind: 'expect', value: expected, tol: 1e-6 },
        };
      }
    }
    const unitPow = kind === 'circle' || kind === 'square' ? 2 : kind === 'sphere' || kind === 'cube' ? 3 : 1;
    const show = (v: Frac, p: boolean) => (p ? piTex(v) : num(v));
    const ans = `$${lhs} = ${show(value, pi)}${ru(unitPow)}$`;
    steps.push(ans);
    return {
      question,
      answer: ans,
      steps,
      distractors: distinctDistractors(ans, wrongs.map(([v, p]) => `$${lhs} = ${show(v, p)}${ru(unitPow)}$`), (k) => `$${lhs} = ${show(value.add(offset(k)), pi)}${ru(unitPow)}$`),
      check: { kind: 'expect', value: expected, tol: 1e-6 },
    };
  },
});

// ---------------------------------------------------------------- extrema

/** Integer-coefficient polynomial whose derivative is k·Π(x − rᵢ)·(scale). */
function polyWithCritical(rng: Rng, roots: number[], k: number): Poly {
  // f' = L·k·Π(x − r) with L = lcm of the needed denominators (1, 2, 3, 4 → 12)
  let dp = Poly.fromRoots(roots).scale(k);
  const anti = dp.antiderivative();
  const L = anti.c.reduce((acc, c) => (acc * c.d) / gcd(acc, c.d), 1);
  dp = dp.scale(L);
  const f = dp.antiderivative().add(Poly.of(rng.int(-9, 9)));
  return f;
}
function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : Math.abs(a);
}

const sortedU = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);

export const extrema = defineTopic({
  id: 'calc.extrema',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: 'Critical Points and Extrema',
  description: 'Critical points, relative extrema by the first derivative test, and absolute extrema on a closed interval.',
  instruction: (o) =>
    o.task === 'critical'
      ? 'Find all critical points of each function.'
      : o.task === 'absolute'
        ? 'Find the absolute extrema of each function on the given interval.'
        : 'Find all relative extrema of each function. Use the first derivative test.',
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'relative',
      choices: [
        { value: 'critical', label: 'Critical points' },
        { value: 'relative', label: 'Relative extrema' },
        { value: 'absolute', label: 'Absolute extrema on an interval' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    const roots = attempt('crit', () => {
      const n = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : rng.pick([2, 3]);
      const rs = Array.from({ length: n }, () => rng.int(-4, 4));
      // occasionally a double root: a critical point that is not an extremum
      if (difficulty !== 'easy' && n === 2 && rng.bool(0.15)) rs[1] = rs[0]!;
      if (n === 3 && new Set(rs).size < 3) return null;
      if (n === 2 && rs[0] === rs[1] && task === 'absolute') return null;
      return rs;
    });
    const k = rng.signedInt(1, difficulty === 'hard' ? 2 : 3, true);
    const f = polyWithCritical(rng, roots, k);
    if (f.c.some((c) => Math.abs(c.value) > 200)) return extrema.generate({ ...ctx, rng: rng.fork('big') });
    const fp = f.derivative();
    const crit = sortedU(roots);
    const steps = [`$f'(x) = ${fp.toTex()}$`, `$f'(x) = 0$ at $x = ${crit.join(', ')}$`];
    const fTex = f.toTex();
    const fx = (x: number) => f.eval(x);
    if (task === 'critical') {
      const answer = `$x = ${crit.join(', ')}$`;
      const wrongCrit = sortedU(crit.map((c) => -c));
      return {
        question: m(ds(`f(x) = ${fTex}`)),
        answer,
        steps,
        distractors: distinctDistractors(answer, [`$x = ${wrongCrit.join(', ')}$`, `$x = ${crit.map((c) => num(fx(c))).join(', ')}$`, `$x = ${sortedU([...crit, 0]).join(', ')}$`, `$x = ${crit.map((c) => c + 1).join(', ')}$`], (q) => `$x = ${crit.map((c) => c + offset(q) * 2).join(', ')}$`),
        check: { kind: 'calculus.extrema', task: 'critical' },
      };
    }
    // classify by the sign of f' on either side
    const sgn = (x: number) => Math.sign(fp.evalNum(x));
    const maxes: number[] = [];
    const mins: number[] = [];
    for (const c of crit) {
      const l = sgn(c - 0.5);
      const r = sgn(c + 0.5);
      if (l > 0 && r < 0) maxes.push(c);
      else if (l < 0 && r > 0) mins.push(c);
    }
    if (task !== 'absolute') {
      const list = (xs: number[]) => xs.map((x) => `$${pt(x, fx(x))}$`).join(', ');
      const part = (word: string, xs: number[]) => (xs.length ? `${word}: ${list(xs)}` : null);
      const render = (mx: number[], mn: number[]) => {
        const parts = [part(mx.length > 1 ? 'Relative maxima' : 'Relative maximum', mx), part(mn.length > 1 ? 'Relative minima' : 'Relative minimum', mn)].filter(Boolean) as string[];
        return parts.length ? parts.join('; ').replace('; Relative', '; relative') : 'No relative extrema';
      };
      const answer = render(maxes, mins);
      steps.push(`Sign of $f'$ changes ${maxes.length || mins.length ? 'at the extrema' : 'nowhere'}: ${crit.map((c) => `$x = ${c}$: ${maxes.includes(c) ? 'max' : mins.includes(c) ? 'min' : 'neither'}`).join(', ')}`);
      const allCrit = crit;
      return {
        question: m(ds(`f(x) = ${fTex}`)),
        answer,
        steps,
        distractors: distinctDistractors(answer, [render(mins, maxes), maxes.length + mins.length ? 'No relative extrema' : render([], allCrit), render(maxes.map((x) => -x), mins.map((x) => -x)), render(allCrit.filter((c) => !mins.includes(c)), mins)], (q) => (maxes.length + mins.length ? render(maxes.map((x) => x + offset(q)), mins.map((x) => x + offset(q))) : render(allCrit.map((c) => c + offset(q)), []))),
        check: { kind: 'calculus.extrema', task: 'relative' },
      };
    }
    // absolute extrema on [a, b] containing at least one critical point
    const a = Math.min(...crit) - rng.int(1, 2);
    const b = Math.max(...crit) + rng.int(1, 2);
    const cands = sortedU([a, b, ...crit]);
    const vals = cands.map((x) => ({ x, y: fx(x) }));
    const hi = vals.reduce((mx, v) => (v.y.cmp(mx) > 0 ? v.y : mx), vals[0]!.y);
    const lo = vals.reduce((mn, v) => (v.y.cmp(mn) < 0 ? v.y : mn), vals[0]!.y);
    const at = (y: Frac) => vals.filter((v) => v.y.eq(y)).map((v) => `$${pt(v.x, v.y)}$`).join(' and ');
    const answer = `Absolute minimum: ${at(lo)}; absolute maximum: ${at(hi)}`;
    steps.push(`Evaluate at the critical points and endpoints: ${vals.map((v) => `$f(${v.x}) = ${num(v.y)}$`).join(', ')}`);
    const ends = vals.filter((v) => v.x === a || v.x === b);
    const endHi = ends.reduce((mx, v) => (v.y.cmp(mx.y) > 0 ? v : mx), ends[0]!);
    const endLo = ends.reduce((mn, v) => (v.y.cmp(mn.y) < 0 ? v : mn), ends[0]!);
    return {
      question: `$${ds(`f(x) = ${fTex}`)}$ on $[${a}, ${b}]$`,
      answer,
      steps,
      distractors: distinctDistractors(
        answer,
        [`Absolute minimum: ${at(hi)}; absolute maximum: ${at(lo)}`, `Absolute minimum: $${pt(endLo.x, endLo.y)}$; absolute maximum: $${pt(endHi.x, endHi.y)}$`, ...crit.map((c) => `Absolute minimum: ${at(lo)}; absolute maximum: $${pt(c, fx(c))}$`)],
        (q) => `Absolute minimum: ${at(lo)}; absolute maximum: $${pt(vals.find((v) => v.y.eq(hi))!.x, hi.add(offset(q)))}$`,
      ),
      check: { kind: 'calculus.extrema', task: 'absolute' },
    };
  },
});

// ---------------------------------------------------------------- concavity

export const concavity = defineTopic({
  id: 'calc.concavity',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: 'Concavity and Points of Inflection',
  description: 'Intervals of concavity and inflection points of polynomial functions, from the sign of the second derivative.',
  instruction: (o) => (o.task === 'inflection' ? 'Find all points of inflection of each function.' : 'Find the intervals where each function is concave up or concave down, and all points of inflection.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Find',
      default: 'intervals',
      choices: [
        { value: 'intervals', label: 'Concavity intervals and inflection points' },
        { value: 'inflection', label: 'Inflection points only' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const task = strOpt(ctx, 'task');
    const quartic = difficulty !== 'easy' && (difficulty === 'hard' || rng.bool(0.5));
    let rs: number[];
    if (!quartic) rs = [rng.int(-4, 4)];
    else {
      rs = attempt('infl', () => {
        const p = rng.int(-3, 3);
        const q = rng.int(-3, 3);
        if (p === q && !rng.bool(0.2)) return null;
        return [p, q];
      });
    }
    const k = rng.signedInt(1, 2, true);
    // f'' = k·Π(x − r) scaled for integer coefficients, then integrate twice
    let fpp = Poly.fromRoots(rs).scale(k);
    for (let tries = 0; tries < 2; tries++) {
      const F = fpp.antiderivative().antiderivative();
      const L = F.c.reduce((acc, c) => (acc * c.d) / gcd(acc, c.d), 1);
      fpp = fpp.scale(L);
    }
    const f = fpp.antiderivative().antiderivative().add(Poly.of(rng.int(-6, 6), rng.int(-6, 6)));
    if (f.c.some((c) => Math.abs(c.value) > 150)) return concavity.generate({ ...ctx, rng: rng.fork('big') });
    const fTex = f.toTex();
    const roots = [...new Set(rs)].sort((a, b) => a - b);
    const sign = (x: number) => Math.sign(fpp.evalNum(x));
    const infl = roots.filter((r) => sign(r - 0.5) !== sign(r + 0.5));
    // intervals between consecutive roots
    const cuts = [-Infinity, ...roots, Infinity];
    const ivs = cuts.slice(0, -1).map((lo, i) => ({ lo, hi: cuts[i + 1]!, s: sign(Number.isFinite(lo) ? (Number.isFinite(cuts[i + 1]!) ? (lo + cuts[i + 1]!) / 2 : lo + 1) : cuts[i + 1]! - 1) }));
    const end = (v: number) => (v === Infinity ? '\\infty' : v === -Infinity ? '-\\infty' : String(v));
    // merge neighbouring intervals with the same sign (double root without inflection)
    const merged: typeof ivs = [];
    for (const iv of ivs) {
      const last = merged[merged.length - 1];
      if (last && last.s === iv.s) last.hi = iv.hi;
      else merged.push({ ...iv });
    }
    const ivTex = (s: number) =>
      merged
        .filter((iv) => iv.s === s)
        .map((iv) => `(${end(iv.lo)}, ${end(iv.hi)})`)
        .join(' \\cup ');
    const inflTex = (xs: number[]) => (xs.length ? `inflection point${xs.length > 1 ? 's' : ''} at ${xs.map((x) => `$${pt(x, f.eval(x))}$`).join(' and ')}` : 'no inflection points');
    const render = (up: string, down: string, xs: number[]) =>
      task === 'inflection'
        ? inflTex(xs).replace(/^i/, 'I').replace(/^no/, 'No')
        : `${up ? `Concave up on $${up}$` : 'Never concave up'}; ${down ? `concave down on $${down}$` : 'never concave down'}; ${inflTex(xs)}`;
    const answer = render(ivTex(1), ivTex(-1), infl);
    const steps = [`$f''(x) = ${fpp.toTex()}$`, `$f''(x) = 0$ at $x = ${roots.join(', ')}$`, `Test the sign of $f''$ on each interval.`];
    const swappedAns = render(ivTex(-1), ivTex(1), infl);
    const shifted = infl.map((x) => x + 1);
    const wrongs = [swappedAns, render(ivTex(1), ivTex(-1), infl.length ? [] : roots), render(ivTex(1), ivTex(-1), shifted.length ? shifted : [roots[0]! + 1]), render(ivTex(-1), ivTex(1), infl.length ? [] : roots)];
    return {
      question: m(ds(`f(x) = ${fTex}`)),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs, (q) => render(ivTex(1), ivTex(-1), infl.length ? infl.map((x) => x + offset(q) + 1) : [roots[0]! + offset(q) + 1])),
      check: { kind: 'calculus.concavity' },
    };
  },
});

// ---------------------------------------------------------------- mean value theorem

export const meanValueTheorem = defineTopic({
  id: 'calc.mean-value-theorem',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: "Mean Value Theorem and Rolle's Theorem",
  description: "Find every c guaranteed by the Mean Value Theorem or Rolle's Theorem on an interval.",
  instruction: (o) => (o.theorem === 'rolle' ? "Find all values of c that satisfy Rolle's Theorem on the given interval." : 'Find all values of c that satisfy the Mean Value Theorem on the given interval.'),
  multipleChoice: true,
  defaultCount: 8,
  options: [
    {
      type: 'select',
      id: 'theorem',
      label: 'Theorem',
      default: 'mvt',
      choices: [
        { value: 'mvt', label: 'Mean Value Theorem' },
        { value: 'rolle', label: "Rolle's Theorem" },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const rolle = strOpt(ctx, 'theorem') === 'rolle';
    const kind = rng.pick(difficulty === 'easy' ? ['quad'] : difficulty === 'medium' ? ['quad', 'cubic'] : rolle ? ['cubic', 'recip'] : ['cubic', 'recip', 'root']);
    let fTex: string;
    let a: number;
    let b: number;
    let cs: string[];
    let csVal: Frac[] | null = null;
    let wrongs: string[];
    const steps: string[] = [];
    if (kind === 'quad') {
      const A = rng.signedInt(1, 4, true);
      const B = rng.int(-8, 8);
      const C = rng.int(-9, 9);
      if (rolle) {
        // symmetric about the vertex −B/(2A); choose B even multiple of A for an integer vertex
        const v = rng.int(-3, 3);
        const w = rng.int(1, 4);
        a = v - w;
        b = v + w;
        const p = new Poly([C, -2 * A * v, A]);
        fTex = p.toTex();
        csVal = [new Frac(v)];
      } else {
        a = rng.int(-4, 2);
        b = a + rng.int(1, 5);
        fTex = new Poly([C, B, A]).toTex();
        csVal = [new Frac(a + b, 2)];
      }
      cs = csVal.map(num);
      steps.push(`Average rate of change on $[${a}, ${b}]$ equals $f'(c)$; for a quadratic, $c$ is the midpoint.`);
      wrongs = [num(new Frac(a + b)), num(new Frac(b - a, 2)), `${num(new Frac(a, 1))}, ${num(new Frac(b))}`];
    } else if (kind === 'cubic') {
      // f = α x³ + γ x on [a, b]: 3α c² = α(a² + ab + b²)  ⇒  c² = (a² + ab + b²)/3
      const alpha = rng.signedInt(1, 3, true);
      let gamma = rng.int(-9, 9);
      if (rolle) {
        const n = rng.int(1, 4);
        gamma = -alpha * n * n;
        a = rng.bool() ? -n : 0;
        b = n;
        if (a === 0 && rng.bool()) {
          a = -n;
          b = 0;
        }
      } else {
        a = rng.int(-3, 1);
        b = attempt('mvt-b', () => {
          const bb = a + rng.int(1, 4);
          return bb === -a ? null : bb;
        });
      }
      const p = new Poly([0, gamma, 0, alpha]);
      fTex = p.toTex();
      const q = new Frac(a * a + a * b + b * b, 3);
      const r = Math.sqrt(q.value);
      const roots = [-r, r].filter((x) => x > a + 1e-12 && x < b - 1e-12);
      cs = roots.map((x) => (x < 0 ? `-${sqrtFracTex(q)}` : sqrtFracTex(q)));
      steps.push(`$f'(c) = ${num(new Frac(3 * alpha))}c^{2} ${gamma < 0 ? '-' : '+'} ${Math.abs(gamma)}$ and $\\frac{f(${b}) - f(${a})}{${b} - (${a})} = ${num(p.eval(b).sub(p.eval(a)).div(b - a))}$`.replace(' + 0$', '$'));
      steps.push(`$c^{2} = ${num(q)}$`);
      wrongs = [num(q), num(new Frac(a + b, 2)), cs.length === 1 ? `-${sqrtFracTex(q)}, ${sqrtFracTex(q)}` : sqrtFracTex(q)];
    } else if (kind === 'recip') {
      // f = x + k/x on [a, b], 0 < a < b: c = √(ab)
      const kk = rng.int(1, 9);
      a = rng.int(1, 4);
      b = rolle ? kk / a : a + rng.int(1, 6);
      if (rolle && (!Number.isInteger(b) || b <= a)) return meanValueTheorem.generate({ ...ctx, rng: rng.fork('r') });
      fTex = `x + \\frac{${kk}}{x}`;
      cs = [sqrtFracTex(new Frac(a * b))];
      steps.push(`$f'(c) = 1 - \\frac{${kk}}{c^{2}}$ and the average rate of change is $1 - \\frac{${kk}}{${a * b}}$, so $c^{2} = ${a * b}$.`);
      wrongs = [num(new Frac(a + b, 2)), `-${cs[0]}, ${cs[0]}`, sqrtFracTex(new Frac(kk))];
    } else {
      // f = k√x on [p², q²]: c = ((p + q)/2)²
      const k = rng.int(1, 6);
      const p0 = rng.int(0, 3);
      const q0 = p0 + rng.int(1, 4);
      a = p0 * p0;
      b = q0 * q0;
      fTex = `${k === 1 ? '' : k}\\sqrt{x}`;
      const c = new Frac((p0 + q0) ** 2, 4);
      cs = [num(c)];
      steps.push(`$f'(c) = \\frac{${k}}{2\\sqrt{c}} = \\frac{${k}(${q0} - ${p0})}{${b} - ${a}}$, so $\\sqrt{c} = ${num(new Frac(p0 + q0, 2))}$.`);
      wrongs = [num(new Frac(a + b, 2)), num(new Frac(p0 + q0, 2)), num(c.add(1))];
    }
    const answer = `$c = ${cs.join(', ')}$`;
    steps.push(answer);
    return {
      question: `$f(x) = ${fTex}$ on $[${a}, ${b}]$`,
      answer,
      steps,
      distractors: distinctDistractors(answer, wrongs.map((w) => `$c = ${w}$`), (k) => `$c = ${num(new Frac(a + b, 2).add(offset(k)))}$`),
      check: { kind: 'calculus.mvt' },
    };
  },
});

// ---------------------------------------------------------------- motion along a line

export const motion = defineTopic({
  id: 'calc.motion',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: 'Motion Along a Line',
  description: 'Position, velocity and acceleration of a particle: values at a time, when it is at rest, total distance traveled.',
  instruction: 'A particle moves along a horizontal line; its position at time t ≥ 0 is s(t). Answer each question.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'task',
      label: 'Questions',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'values', label: 'Position, velocity and acceleration at a time' },
        { value: 'rest', label: 'When the particle is at rest' },
        { value: 'distance', label: 'Total distance traveled' },
      ],
    },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const tOpt = strOpt(ctx, 'task');
    const task = tOpt === 'any' ? rng.pick(['values', 'rest', 'distance']) : tOpt;
    // s(t) with v = 6k(t − p)(t − q), or a quadratic on easy
    let s: Poly;
    let restTimes: number[];
    if (difficulty === 'easy') {
      const p = rng.int(1, 6);
      const k = rng.signedInt(1, 4, true);
      s = new Poly([rng.int(-9, 9), -2 * k * p, k]);
      restTimes = [p];
    } else {
      const p = rng.int(1, 3);
      const q = p + rng.int(1, 3);
      const k = rng.signedInt(1, difficulty === 'hard' ? 2 : 1, true);
      s = new Poly([rng.int(-9, 9), 6 * k * p * q, -3 * k * (p + q), 2 * k]);
      restTimes = [p, q];
    }
    const v = s.derivative();
    const acc = v.derivative();
    const sTex = s.toTex('t');
    const steps = [`$v(t) = s'(t) = ${v.toTex('t')}$`, `$a(t) = v'(t) = ${acc.toTex('t')}$`];
    const head = `$s(t) = ${sTex}$`;
    if (task === 'values') {
      const T = rng.int(0, 5);
      const items = (sv: Frac, vv: Frac, av: Frac) => `$s(${T}) = ${num(sv)}$, $v(${T}) = ${num(vv)}$, $a(${T}) = ${num(av)}$`;
      const answer = items(s.eval(T), v.eval(T), acc.eval(T));
      return {
        question: `${head}. Find the position, velocity and acceleration at $t = ${T}$.`,
        answer,
        steps,
        distractors: distinctDistractors(answer, [items(s.eval(T), acc.eval(T), v.eval(T)), items(v.eval(T), s.eval(T), acc.eval(T)), items(s.eval(T), v.eval(T).neg(), acc.eval(T)), items(s.eval(T), v.eval(T), acc.eval(T).add(v.eval(T)))], (k) => items(s.eval(T), v.eval(T).add(offset(k)), acc.eval(T))),
        check: { kind: 'calculus.motion', task: 'values' },
      };
    }
    if (task === 'rest') {
      const answer = `$t = ${restTimes.join(', ')}$`;
      steps.push(`$v(t) = 0$ when $t = ${restTimes.join(', ')}$`);
      const accZero = acc.degree === 1 ? acc.coef(0).neg().div(acc.coef(1)) : null;
      return {
        question: `${head}. When is the particle at rest?`,
        answer,
        steps,
        distractors: distinctDistractors(answer, [accZero ? `$t = ${num(accZero)}$` : '$t = 0$', `$t = ${restTimes.map((r) => r + 1).join(', ')}$`, `$t = 0, ${restTimes.join(', ')}$`, `$t = ${restTimes.map((r) => r * 2).join(', ')}$`], (k) => `$t = ${restTimes.map((r) => r + offset(k) + 1).join(', ')}$`),
        check: { kind: 'calculus.motion', task: 'rest' },
      };
    }
    const T = Math.max(...restTimes) + rng.int(1, 2);
    const marks = [0, ...restTimes, T];
    let total = Frac.ZERO;
    for (let i = 0; i + 1 < marks.length; i++) total = total.add(s.eval(marks[i + 1]!).sub(s.eval(marks[i]!)).abs());
    const disp = s.eval(T).sub(s.eval(0));
    steps.push(`The particle turns around at $t = ${restTimes.join(', ')}$.`, `Distance $= ${marks.slice(0, -1).map((t0, i) => `|s(${marks[i + 1]}) - s(${t0})|`).join(' + ')} = ${num(total)}$`);
    const answer = `$${num(total)}$ units`;
    return {
      question: `${head}. Find the total distance traveled from $t = 0$ to $t = ${T}$.`,
      answer,
      steps,
      distractors: distinctDistractors(answer, [`$${num(disp.abs())}$ units`, `$${num(s.eval(T))}$ units`, `$${num(total.add(disp.abs()))}$ units`], (k) => `$${num(total.add(offset(k)))}$ units`),
      check: { kind: 'calculus.motion', task: 'distance', span: [0, T] },
    };
  },
});

// ---------------------------------------------------------------- L'Hôpital's rule

type LV = Frac | 'inf' | { e: number };

export const lhopital = defineTopic({
  id: 'calc.lhopital',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: "L'Hôpital's Rule",
  description: "Indeterminate forms 0/0, ∞/∞, 0·∞ and 1^∞ evaluated with L'Hôpital's rule.",
  instruction: "Evaluate each limit. Use L'Hôpital's rule where appropriate.",
  multipleChoice: true,
  defaultCount: 10,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const POOL: Record<Difficulty, string[]> = { easy: ['expm1', 'log1p', 'power'], medium: ['expdiff', 'lnratio', 'xnexp', 'lnx', 'power'], hard: ['cos2', 'expquad', 'sinCubic', 'oneInf', 'xsin', 'expinf'] };
    const kind = rng.pick(POOL[difficulty]);
    const a = rng.int(2, 6);
    const b = attempt('lh-b', () => {
      const b = rng.int(1, 7);
      return b === a ? null : b;
    });
    const fr = (n: string, d: string) => `\\frac{${n}}{${d}}`;
    const bx = (k: number, p = 1) => (p === 0 ? String(k) : `${k === 1 ? '' : k}x${p === 1 ? '' : `^{${p}}`}`);
    let point = '0';
    let expr: string;
    let value: LV;
    let wrong: LV[];
    const steps: string[] = [];
    switch (kind) {
      case 'expm1':
        expr = fr(`e^{${lin(a)}} - 1`, bx(b));
        value = new Frac(a, b);
        steps.push(`$\\frac{0}{0}$: differentiate: $${fr(`${a}e^{${lin(a)}}`, String(b))} \\to ${fr(String(a), String(b))}$`);
        wrong = [new Frac(b, a), new Frac(1, b), Frac.ZERO];
        break;
      case 'log1p':
        expr = fr(`\\ln(1 + ${bx(a)})`, bx(b));
        value = new Frac(a, b);
        steps.push(`$\\frac{0}{0}$: differentiate: $${fr(fr(String(a), `1 + ${bx(a)}`), String(b))} \\to ${fr(String(a), String(b))}$`);
        wrong = [new Frac(b, a), new Frac(1, b), Frac.ONE];
        break;
      case 'power': {
        const c = rng.int(1, 3);
        const n = rng.int(2, 5);
        point = String(c);
        expr = fr(`x^{${n}} - ${c ** n}`, `x - ${c}`);
        value = new Frac(n * c ** (n - 1));
        steps.push(`$\\frac{0}{0}$: differentiate: $${n}x^{${n - 1}}$ at $x = ${c}$`.replace('^{1}', ''));
        wrong = [new Frac(n * c ** n), new Frac(n), new Frac(c ** (n - 1))];
        break;
      }
      case 'expdiff':
        expr = fr(`e^{${lin(a)}} - e^{${lin(b)}}`, 'x');
        value = new Frac(a - b);
        steps.push(`$\\frac{0}{0}$: differentiate: $${a}e^{${lin(a)}} - ${b === 1 ? '' : b}e^{${lin(b)}} \\to ${a - b}$`);
        wrong = [new Frac(a + b), new Frac(a * b), Frac.ZERO];
        break;
      case 'lnratio': {
        const n = rng.int(2, 6);
        const mm = attempt('lh-m', () => {
          const q = rng.int(2, 6);
          return q === n ? null : q;
        });
        point = '1';
        expr = fr(`x^{${n}} - 1`, `x^{${mm}} - 1`);
        value = new Frac(n, mm);
        steps.push(`$\\frac{0}{0}$: differentiate: $${fr(`${n}x^{${n - 1}}`, `${mm}x^{${mm - 1}}`).replace(/\^\{1\}/g, '')} \\to ${fr(String(n), String(mm))}$`);
        wrong = [new Frac(mm, n), Frac.ONE, new Frac(n - 1, mm - 1)];
        break;
      }
      case 'xnexp': {
        const n = rng.int(1, 4);
        point = '\\infty';
        expr = fr(bx(rng.int(1, 5), n), `e^{${lin(a)}}`);
        value = Frac.ZERO;
        steps.push(`$\\frac{\\infty}{\\infty}$: differentiate ${n === 1 ? 'once' : `${n} times`}; the numerator becomes constant while the denominator still grows, so the limit is $0$.`);
        wrong = ['inf', Frac.ONE, new Frac(1, a)];
        break;
      }
      case 'lnx': {
        const n = rng.int(1, 3);
        const c = a - 1;
        point = '\\infty';
        expr = fr(`${c === 1 ? '' : c}\\ln x`, bx(b, n));
        value = Frac.ZERO;
        steps.push(`$\\frac{\\infty}{\\infty}$: differentiate: $${fr(fr(String(c), 'x'), bx(b * n, n - 1))} = ${fr(String(c), bx(b * n, n))} \\to 0$`);
        wrong = ['inf', new Frac(c, b), Frac.ONE];
        break;
      }
      case 'cos2':
        expr = fr(`1 - \\cos(${lin(a)})`, bx(b, 2));
        value = new Frac(a * a, 2 * b);
        steps.push(`Apply the rule twice: $${fr(`${a}\\sin(${lin(a)})`, bx(2 * b))} \\to ${fr(`${a * a}\\cos(${lin(a)})`, String(2 * b))} \\to ${num(value)}$`);
        wrong = [Frac.ZERO, new Frac(a * a, b), new Frac(a, 2 * b)];
        break;
      case 'expquad':
        expr = fr(`e^{${lin(a)}} - 1 - ${bx(a)}`, 'x^{2}');
        value = new Frac(a * a, 2);
        steps.push(`Apply the rule twice: $${fr(`${a}e^{${lin(a)}} - ${a}`, '2x')} \\to ${fr(`${a * a}e^{${lin(a)}}`, '2')} \\to ${num(value)}$`);
        wrong = [new Frac(a * a), new Frac(a, 2), Frac.ZERO];
        break;
      case 'sinCubic':
        expr = fr(`\\sin(${lin(a)}) - ${bx(a)}`, 'x^{3}');
        value = new Frac(-(a ** 3), 6);
        steps.push(`Apply the rule three times: $${fr(`-${a ** 3}\\cos(${lin(a)})`, '6')} \\to ${num(value)}$`);
        wrong = [value.neg(), new Frac(-a, 6), Frac.ZERO];
        break;
      case 'oneInf':
        point = '\\infty';
        expr = `\\left(1 + ${fr(String(a), 'x')}\\right)^{x}`;
        value = { e: a };
        steps.push(`$1^{\\infty}$: take logs, $x\\ln\\left(1 + ${fr(String(a), 'x')}\\right) = ${fr(`\\ln\\left(1 + ${fr(String(a), 'x')}\\right)`, fr('1', 'x'))} \\to ${a}$, so the limit is $e^{${a}}$.`);
        wrong = [Frac.ONE, 'inf', new Frac(a)];
        break;
      case 'xsin':
        point = '\\infty';
        expr = `x\\sin\\left(${fr(String(a), 'x')}\\right)`;
        value = new Frac(a);
        steps.push(`$\\infty \\cdot 0$: rewrite as $${fr(`\\sin\\left(${fr(String(a), 'x')}\\right)`, fr('1', 'x'))}$ and differentiate: $${a}\\cos\\left(${fr(String(a), 'x')}\\right) \\to ${a}$`);
        wrong = [Frac.ZERO, Frac.ONE, 'inf'];
        break;
      default: {
        const n = rng.int(2, 4);
        point = '\\infty';
        expr = fr(`e^{${lin(a)}}`, bx(b, n));
        value = 'inf';
        steps.push(`$\\frac{\\infty}{\\infty}$: after ${n} applications the denominator is constant and the numerator still grows: $\\infty$.`);
        wrong = [Frac.ZERO, new Frac(a, b), Frac.ONE];
        break;
      }
    }
    const show = (v: LV) => m(v === 'inf' ? '\\infty' : v instanceof Frac ? num(v) : `e^{${v.e}}`);
    const answer = show(value);
    const base = value instanceof Frac ? value : Frac.ZERO;
    return {
      question: m(ds(`\\lim_{x \\to ${point}} ${expr}`)),
      answer,
      steps,
      distractors: distinctDistractors(answer, wrong.map(show), (k) => show(base.add(offset(k)))),
      check: { kind: 'calculus.limit' },
    };
  },
});

// ---------------------------------------------------------------- optimization

/** Maximum or minimum of g on (lo, hi) by dense sampling plus golden-section refinement. */
function extremeValue(g: (x: number) => number, lo: number, hi: number, max: boolean): number {
  const sgn = max ? 1 : -1;
  let best = lo;
  const N = 4000;
  for (let i = 1; i < N; i++) {
    const x = lo + ((hi - lo) * i) / N;
    if (sgn * g(x) > sgn * g(best) || best === lo) best = x;
  }
  let a = best - (hi - lo) / N;
  let b = best + (hi - lo) / N;
  for (let i = 0; i < 100; i++) {
    const c = b - (b - a) / 1.618;
    const d = a + (b - a) / 1.618;
    if (sgn * g(c) > sgn * g(d)) b = d;
    else a = c;
  }
  return g((a + b) / 2);
}

export const optimization = defineTopic({
  id: 'calc.optimization',
  subject: 'calculus',
  category: 'Applications of Differentiation',
  title: 'Optimization',
  description: 'Word problems: fencing, rectangles, open boxes and number problems solved by finding a maximum or minimum.',
  instruction: 'Solve each optimization problem.',
  multipleChoice: true,
  defaultCount: 5,
  options: [],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['rect', 'numbers'] : difficulty === 'medium' ? ['river', 'rect', 'product'] : ['box', 'river', 'product']);
    const name = pickName(rng);
    const unit = rng.pick(['ft', 'm', 'yd']);
    let question: string;
    let value: Frac;
    let expected: number;
    let unitPow = 0;
    let wrongs: Frac[];
    const steps: string[] = [];
    switch (kind) {
      case 'rect': {
        const P = rng.int(5, 40) * 4;
        question = `${name} has $${P}\\text{ ${unit}}$ of fencing to enclose a rectangular garden. What is the largest area that can be enclosed?`;
        value = new Frac((P / 4) ** 2);
        expected = extremeValue((x) => x * (P / 2 - x), 0, P / 2, true);
        unitPow = 2;
        steps.push(`$A = x\\left(${P / 2} - x\\right)$, $A' = ${P / 2} - 2x = 0$ at $x = ${P / 4}$`);
        wrongs = [new Frac((P / 2) ** 2), new Frac(P * P, 8), new Frac((P / 4) * (P / 2))];
        break;
      }
      case 'numbers': {
        const S = rng.int(4, 40) * 2;
        const ask = rng.pick(['product', 'squares']);
        if (ask === 'product') {
          question = `Two positive numbers have a sum of $${S}$. What is the largest possible product?`;
          value = new Frac((S / 2) ** 2);
          expected = extremeValue((x) => x * (S - x), 0, S, true);
          steps.push(`$P = x(${S} - x)$, $P' = ${S} - 2x = 0$ at $x = ${S / 2}$`);
          wrongs = [new Frac(S * S), new Frac(S / 2), new Frac((S / 2) * (S / 2 - 1))];
        } else {
          question = `Two numbers have a sum of $${S}$. What is the smallest possible sum of their squares?`;
          value = new Frac((S * S) / 2);
          expected = extremeValue((x) => x * x + (S - x) ** 2, -S, 2 * S, false);
          steps.push(`$Q = x^{2} + (${S} - x)^{2}$, $Q' = 4x - ${2 * S} = 0$ at $x = ${S / 2}$`);
          wrongs = [new Frac(S * S), new Frac((S / 2) ** 2), new Frac(S / 2)];
        }
        break;
      }
      case 'river': {
        const F = rng.int(5, 40) * 4;
        question = `A farmer will fence a rectangular field along a straight river using $${F}\\text{ ${unit}}$ of fencing; no fence is needed along the river. What is the largest area that can be enclosed?`;
        value = new Frac((F * F) / 8);
        expected = extremeValue((x) => x * (F - 2 * x), 0, F / 2, true);
        unitPow = 2;
        steps.push(`$A = x(${F} - 2x)$, $A' = ${F} - 4x = 0$ at $x = ${F / 4}$`);
        wrongs = [new Frac((F / 4) ** 2), new Frac((F * F) / 4), new Frac(F * F, 9)];
        break;
      }
      case 'product': {
        const r = rng.int(2, 15);
        const P = r * r;
        question = `Two positive numbers have a product of $${P}$. What is the smallest possible sum?`;
        value = new Frac(2 * r);
        expected = extremeValue((x) => x + P / x, 0.01, P, false);
        steps.push(`$S = x + \\frac{${P}}{x}$, $S' = 1 - \\frac{${P}}{x^{2}} = 0$ at $x = ${r}$`);
        wrongs = [new Frac(P + 1), new Frac(r), new Frac(P, 2)];
        break;
      }
      default: {
        // open box from an L × L sheet: cut x squares, V = x(L − 2x)², max at x = L/6
        const k = rng.int(1, 5);
        const L = 6 * k;
        const ask = rng.pick(['volume', 'cut']);
        const in_ = rng.pick(['in', 'cm']);
        question = `${name} makes an open-top box from a $${L}\\text{ ${in_}}$ by $${L}\\text{ ${in_}}$ square of cardboard by cutting equal squares from the corners and folding up the sides. ${ask === 'volume' ? 'What is the largest possible volume?' : 'What size squares should be cut to maximize the volume?'}`;
        steps.push(`$V = x(${L} - 2x)^{2}$, $V' = (${L} - 2x)(${L} - 6x) = 0$ at $x = ${k}$`);
        if (ask === 'volume') {
          value = new Frac(16 * k ** 3);
          expected = extremeValue((x) => x * (L - 2 * x) ** 2, 0, L / 2, true);
          wrongs = [new Frac(L ** 3, 27), new Frac(2 * k * (L - 2 * k) ** 2), new Frac(k * (L - 4 * k) ** 2)];
          const ans = `$V = ${num(value)}\\text{ ${in_}}^{3}$`;
          return {
            question,
            answer: ans,
            steps: [...steps, ans],
            distractors: distinctDistractors(ans, wrongs.map((w) => `$V = ${num(w)}\\text{ ${in_}}^{3}$`), (q) => `$V = ${num(value.add(offset(q) * 8))}\\text{ ${in_}}^{3}$`),
            check: { kind: 'expect', value: expected, tol: 1e-6 },
          };
        }
        value = new Frac(k);
        // the optimal cut: maximize V and read off its location
        let best = 0;
        for (let i = 1; i < 6000; i++) {
          const x = (L / 2) * (i / 6000);
          if (x * (L - 2 * x) ** 2 > best * (L - 2 * best) ** 2) best = x;
        }
        expected = best;
        const ans = `$x = ${k}\\text{ ${in_}}$`;
        return {
          question,
          answer: ans,
          steps: [...steps, ans],
          distractors: distinctDistractors(ans, [`$x = ${3 * k}\\text{ ${in_}}$`, `$x = ${2 * k}\\text{ ${in_}}$`, `$x = ${num(new Frac(k, 2))}\\text{ ${in_}}$`], (q) => `$x = ${k + offset(q) + 3}\\text{ ${in_}}$`),
          check: { kind: 'expect', value: expected, tol: 2e-3 },
        };
      }
    }
    const fmt = (v: Frac) => (unitPow ? withUnit(num(v), unit, unitPow) : num(v));
    const ans = m(fmt(value));
    steps.push(ans);
    return {
      question,
      answer: ans,
      steps,
      distractors: distinctDistractors(ans, wrongs.map((w) => m(fmt(w))), (q) => m(fmt(value.add(offset(q))))),
      check: { kind: 'expect', value: expected, tol: 1e-6 },
    };
  },
});
