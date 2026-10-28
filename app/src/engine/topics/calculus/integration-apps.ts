/** Applications of integration: area between curves, volumes of solids of revolution (disks and washers). */
import { graphPlane, plot, plotParam, shadeBetween, type Diagram, type Pt } from '../../diagram';
import { Frac, type FracLike } from '../../fraction';
import { attempt, defineTopic, distinctDistractors, offset, strOpt } from '../../generator';
import { Poly } from '../../polynomial';
import type { Rng } from '../../rng';
import { m, num } from '../../tex';
import type { Difficulty, ProblemContent } from '../../types';
import { piTex } from './common';

/** A boundary curve dep = c(ind): a polynomial, or √(ind) (then `sq` is its square). */
interface Curve {
  tex: string;
  f: (s: number) => number;
  poly?: Poly;
  sq?: Poly;
}

const polyCurve = (p: Poly, v: string): Curve => ({ tex: p.toTex(v), f: (s) => p.evalNum(s), poly: p });
const rootCurve = (v: string): Curve => ({ tex: `\\sqrt{${v}}`, f: (s) => Math.sqrt(Math.max(0, s)), sq: Poly.of(0, 1) });

const exactIntegral = (p: Poly, lo: FracLike, hi: FracLike) => {
  const F = p.antiderivative();
  return F.eval(hi).sub(F.eval(lo));
};

/** ∫ (c − k)² for a curve, exactly. */
function squareShift(c: Curve, k: number): Poly {
  if (c.poly) return c.poly.sub(Poly.of(k)).powInt(2);
  if (k !== 0) throw new Error('squareShift: root curves only about their own axis');
  return c.sq!;
}

/** Shaded region between two curves; for x = g(y) regions the roles of the axes are swapped. */
function regionFigure(c1: Curve, c2: Curve, lo: number, hi: number, inY: boolean, axisLine: number | null, alt: string, perpAxis: number | null = null): Diagram {
  const xs = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
  const extent = Math.max(3, Math.abs(lo), Math.abs(hi), ...xs.flatMap((s) => [Math.abs(c1.f(s)), Math.abs(c2.f(s))]), axisLine === null ? 0 : Math.abs(axisLine), perpAxis === null ? 0 : Math.abs(perpAxis));
  const R = Math.min(16, Math.ceil(extent + 1));
  const tick = R > 10 ? 4 : R > 5 ? 2 : 1;
  const { b, w } = graphPlane(R, tick, Math.max(7, Math.round(220 / (2 * R))));
  if (!inY) {
    const lower = (x: number) => (x < lo || x > hi ? NaN : Math.min(c1.f(x), c2.f(x)));
    const upper = (x: number) => (x < lo || x > hi ? NaN : Math.max(c1.f(x), c2.f(x)));
    shadeBetween(b, (x) => (Number.isNaN(lower(x)) ? 0 : lower(x)), (x) => (Number.isNaN(upper(x)) ? 0 : upper(x)), w, 'accent');
    for (const c of [c1, c2]) plot(b, (x) => (c.sq && x < 0 ? NaN : c.f(x)), w);
    if (axisLine !== null && axisLine !== 0) b.segment([-R, axisLine], [R, axisLine], { dash: true, ink: 'ink' });
  } else {
    const pts: Pt[] = [...xs.map((y): Pt => [c1.f(y), y]), ...[...xs].reverse().map((y): Pt => [c2.f(y), y])];
    b.polygon(pts, { fill: 'accent', noStroke: true });
    for (const c of [c1, c2]) plotParam(b, (t) => c.f(t), (t) => t, c.sq ? 0 : -R, R, w);
  }
  if (perpAxis !== null && perpAxis !== 0) b.segment(inY ? [-R, perpAxis] : [perpAxis, -R], inY ? [R, perpAxis] : [perpAxis, R], { dash: true, ink: 'ink' });
  return b.build(alt);
}

// ---------------------------------------------------------------- area between curves

export const areaBetweenCurves = defineTopic({
  id: 'calc.area-between-curves',
  subject: 'calculus',
  category: 'Applications of Integration',
  title: 'Area Between Curves',
  description: 'Area of a region bounded by a curve and the x-axis, a parabola and a line, two parabolas, or a root and a line.',
  instruction: 'Find the area of each region described.',
  multipleChoice: true,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'graph', label: 'Show the region', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const KINDS: Record<Difficulty, string[]> = { easy: ['axis', 'bounded'], medium: ['line', 'line', 'bounded'], hard: ['parabolas', 'root', 'line'] };
    const kind = rng.pick(KINDS[difficulty]);
    let c1: Curve;
    let c2: Curve;
    let lo: number;
    let hi: number;
    let stated: number[] = [];
    let area: Frac;
    const steps: string[] = [];
    if (kind === 'root') {
      const mm = rng.int(1, 3);
      c1 = rootCurve('x');
      c2 = polyCurve(Poly.of(0, new Frac(1, mm)), 'x');
      c2 = { ...c2, tex: mm === 1 ? 'x' : `\\frac{x}{${mm}}` };
      lo = 0;
      hi = mm * mm;
      area = new Frac(mm ** 3, 6);
      steps.push(`The curves meet where $\\sqrt{x} = ${c2.tex}$: $x = 0$ and $x = ${hi}$.`, `$\\displaystyle A = \\int_{0}^{${hi}} \\left(\\sqrt{x} - ${c2.tex}\\right)dx = ${num(new Frac(2 * mm ** 3, 3))} - ${num(new Frac(mm ** 3, 2))} = ${num(area)}$`);
    } else if (kind === 'bounded') {
      // positive polynomial on [a, b] with the x-axis and two vertical lines
      const built = attempt('area-bounded', () => {
        const p = new Poly([rng.int(1, 6), rng.int(-3, 3), difficulty === 'easy' ? rng.int(0, 2) : rng.int(1, 2)]);
        const a = rng.int(-2, 2);
        const b = a + rng.int(1, 3);
        for (let i = 0; i <= 20; i++) if (p.evalNum(a + ((b - a) * i) / 20) <= 0) return null;
        return { p, a, b };
      });
      c1 = polyCurve(built.p, 'x');
      c2 = polyCurve(Poly.of(0), 'x');
      lo = built.a;
      hi = built.b;
      stated = [lo, hi];
      area = exactIntegral(built.p, lo, hi);
      steps.push(`The curve is above the $x$-axis on $[${lo}, ${hi}]$.`, `$\\displaystyle A = \\int_{${lo}}^{${hi}} (${built.p.toTex()})\\,dx = ${num(area)}$`);
    } else {
      // f − g = k(x − r1)(x − r2)
      const { r1, r2, k } = attempt('area-roots', () => {
        const r1 = rng.int(-4, 2);
        const r2 = r1 + rng.int(1, difficulty === 'easy' ? 4 : 5);
        return { r1, r2, k: rng.signedInt(1, difficulty === 'hard' ? 2 : 1, true) };
      });
      const gap = Poly.fromRoots([r1, r2]).scale(k);
      let g: Poly;
      if (kind === 'axis') g = Poly.of(0);
      else if (kind === 'line') g = Poly.of(rng.int(-4, 4), rng.signedInt(1, 3, true));
      else g = new Poly([rng.int(-4, 4), rng.int(-3, 3), rng.signedInt(1, 2, true)]);
      const f = g.add(gap);
      if (f.degree < 2 || f.c.some((c) => Math.abs(c.value) > 30)) return areaBetweenCurves.generate({ ...ctx, rng: rng.fork('big') });
      c1 = polyCurve(f, 'x');
      c2 = polyCurve(g, 'x');
      lo = r1;
      hi = r2;
      area = exactIntegral(gap, lo, hi).abs();
      steps.push(`Intersections: $${f.toTex()} = ${g.toTex()}$ gives $x = ${r1}$ and $x = ${r2}$.`, `$\\displaystyle A = \\int_{${r1}}^{${r2}} \\left|${gap.toTex()}\\right|dx = ${num(area)}$`);
    }
    const bounds = stated.length ? `, $x = ${lo}$, and $x = ${hi}$` : '';
    const question = `The region bounded by $y = ${c1.tex}$ and $y = ${c2.tex}$${bounds}.`.replace(` and $y = ${c2.tex}$,`, `, $y = ${c2.tex}$,`);
    const answer = m(num(area));
    const wrongs = [num(area.mul(2)), num(area.div(2)), num(area.add(hi - lo)), num(area.neg())];
    const diagram = ctx.options.graph === false ? undefined : regionFigure(c1, c2, lo, hi, false, null, `Shaded region between y = ${c1.tex} and y = ${c2.tex}`);
    return {
      question,
      answer,
      steps: [...steps, answer],
      diagram,
      distractors: distinctDistractors(answer, wrongs.map(m), (q) => m(num(area.add(offset(q))))),
      check: { kind: 'calculus.region', measure: 'area', bounds: [lo, hi] },
    };
  },
});

// ---------------------------------------------------------------- volumes of revolution

interface Solid {
  c1: Curve;
  c2: Curve;
  lo: Frac;
  hi: Frac;
  stated: number[];
  inY: boolean;
  /** axis of revolution: dep = k (k = 0 is the coordinate axis). */
  k: number;
  method: 'disk' | 'washer';
}

const POOLS: Record<Difficulty, { disk: string[]; washer: string[] }> = {
  easy: { disk: ['diskPoly', 'diskRoot', 'diskLine'], washer: ['washerLine', 'washerFlat', 'washerRoot'] },
  medium: { disk: ['diskY', 'diskPoly', 'diskLine'], washer: ['washerLine', 'washerRoot', 'washerFlat'] },
  hard: { disk: ['diskTop', 'diskY', 'diskRoot'], washer: ['washerShift', 'washerY', 'washerLine'] },
};

function buildSolid(rng: Rng, d: Difficulty, method: string): Solid {
  const kinds = method === 'disk' ? POOLS[d].disk : method === 'washer' ? POOLS[d].washer : [...POOLS[d].disk, ...POOLS[d].washer];
  const kind = rng.pick(kinds);
  const zero = (v: string) => polyCurve(Poly.of(0), v);
  const F = (n: number) => new Frac(n);
  // line y = m·s and parabola y = n·s², meeting at s = m/n
  const lineParab = (v: string) => {
    const mm = rng.int(1, 4);
    const n = rng.int(1, 3);
    return { c1: polyCurve(Poly.of(0, mm), v), c2: polyCurve(new Poly([0, 0, n]), v), lo: F(0), hi: new Frac(mm, n), top: (mm * mm) / n };
  };
  switch (kind) {
    case 'diskPoly': {
      const n = rng.int(1, 3);
      const b = rng.int(1, 3);
      return { c1: polyCurve(new Poly([...Array(rng.int(1, 2)).fill(0), n]), 'x'), c2: zero('x'), lo: F(0), hi: F(b), stated: [b], inY: false, k: 0, method: 'disk' };
    }
    case 'diskRoot': {
      const a = rng.int(0, 3);
      const b = a + rng.int(1, 5);
      return { c1: rootCurve('x'), c2: zero('x'), lo: F(a), hi: F(b), stated: a === 0 ? [b] : [a, b], inY: false, k: 0, method: 'disk' };
    }
    case 'diskLine': {
      const mm = rng.int(1, 3);
      const c = rng.int(1, 4);
      const a = rng.int(0, 2);
      const b = a + rng.int(1, 3);
      return { c1: polyCurve(Poly.of(c, mm), 'x'), c2: zero('x'), lo: F(a), hi: F(b), stated: [a, b], inY: false, k: 0, method: 'disk' };
    }
    case 'diskY': {
      // x = a·y² (or x = n·y) and x = 0 for 0 ≤ y ≤ b, about the y-axis
      const b = rng.int(1, 3);
      const c = rng.bool() ? new Poly([0, 0, rng.int(1, 2)]) : new Poly([0, rng.int(1, 3)]);
      return { c1: polyCurve(c, 'y'), c2: zero('y'), lo: F(0), hi: F(b), stated: [b], inY: true, k: 0, method: 'disk' };
    }
    case 'diskTop': {
      // region between y = a·x² and y = a·n², revolved about y = a·n²
      const n = rng.int(1, 3);
      const a = rng.int(1, 2);
      return { c1: polyCurve(new Poly([0, 0, a]), 'x'), c2: polyCurve(Poly.of(a * n * n), 'x'), lo: F(-n), hi: F(n), stated: [], inY: false, k: a * n * n, method: 'disk' };
    }
    case 'washerLine': {
      const r = lineParab('x');
      return { ...r, stated: [], inY: false, k: 0, method: 'washer' };
    }
    case 'washerFlat': {
      // y = c (c = a·n²) and y = a·x² on [−n, n], about the x-axis
      const n = rng.int(1, 3);
      const a = rng.int(1, 2);
      return { c1: polyCurve(Poly.of(a * n * n), 'x'), c2: polyCurve(new Poly([0, 0, a]), 'x'), lo: F(-n), hi: F(n), stated: [], inY: false, k: 0, method: 'washer' };
    }
    case 'washerRoot': {
      // y = √x and y = x/m on [0, m²]
      const mm = rng.int(1, 3);
      const line = polyCurve(Poly.of(0, new Frac(1, mm)), 'x');
      return { c1: rootCurve('x'), c2: { ...line, tex: mm === 1 ? 'x' : `\\frac{x}{${mm}}` }, lo: F(0), hi: F(mm * mm), stated: [], inY: false, k: 0, method: 'washer' };
    }
    case 'washerY': {
      const r = lineParab('y');
      return { ...r, stated: [], inY: true, k: 0, method: 'washer' };
    }
    case 'washerShift':
    default: {
      // y = m x and y = n x² about y = −c (below the region) or y = top + c (above)
      const r = lineParab('x');
      const c = rng.int(1, 3);
      const k = rng.bool() ? -c : Math.ceil(r.top) + c - 1;
      return { ...r, stated: [], inY: false, k, method: 'washer' };
    }
  }
}

export const volumesOfRevolution = defineTopic({
  id: 'calc.volumes-of-revolution',
  subject: 'calculus',
  category: 'Applications of Integration',
  title: 'Volumes of Solids of Revolution',
  description: 'Volumes by the disk and washer methods about the x-axis, the y-axis and other horizontal lines, exact in terms of π.',
  instruction: 'Find the exact volume of each solid of revolution.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'method',
      label: 'Method',
      default: 'any',
      choices: [
        { value: 'any', label: 'Disks and washers' },
        { value: 'disk', label: 'Disk method' },
        { value: 'washer', label: 'Washer method' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Show the region', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const s = buildSolid(rng, difficulty, strOpt(ctx, 'method'));
    const dep = s.inY ? 'x' : 'y';
    const ind = s.inY ? 'y' : 'x';
    const integrand = squareShift(s.c1, s.k).sub(squareShift(s.c2, s.k));
    const vol = exactIntegral(integrand, s.lo, s.hi).abs();
    const parts = [`$${dep} = ${s.c1.tex}$`, `$${dep} = ${s.c2.tex}$`, ...s.stated.map((v) => `$${ind} = ${v}$`)];
    const list = parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
    const axis = s.k === 0 ? `the $${ind}$-axis` : `the line $${dep} = ${s.k}$`;
    const question = `The region bounded by ${list} is revolved about ${axis}.`;
    const rOuter = (c: Curve) => (s.k === 0 ? c.tex : `${c.tex} ${s.k < 0 ? '+' : '-'} ${Math.abs(s.k)}`);
    const steps = [
      s.method === 'disk' ? 'Disk method: each cross-section is a disk.' : 'Washer method: each cross-section is a washer.',
      s.k === 0 && s.c2.tex === '0'
        ? `$\\displaystyle V = \\pi\\int_{${num(s.lo)}}^{${num(s.hi)}} \\left(${s.c1.tex}\\right)^{2}\\,d${ind}$`
        : `$\\displaystyle V = \\pi\\int_{${num(s.lo)}}^{${num(s.hi)}} \\left|\\left(${rOuter(s.c1)}\\right)^{2} - \\left(${rOuter(s.c2)}\\right)^{2}\\right|\\,d${ind}$`,
      `$V = ${piTex(vol)}$`,
    ];
    const answer = m(piTex(vol));
    // common mistakes: forgetting π, squaring the difference, using (R − r)², area instead of volume
    const diffSq = s.c1.poly && s.c2.poly ? exactIntegral(s.c1.poly.sub(s.c2.poly).powInt(2), s.lo, s.hi).abs() : vol.mul(2);
    const area = s.c1.poly && s.c2.poly ? exactIntegral(s.c1.poly.sub(s.c2.poly), s.lo, s.hi).abs() : vol.div(2);
    const wrongs = [num(vol), piTex(diffSq), piTex(area), piTex(vol.mul(2))];
    const diagram = ctx.options.graph === false ? undefined : regionFigure(s.c1, s.c2, s.lo.value, s.hi.value, s.inY, s.k === 0 ? null : s.k, `Region bounded by ${dep} = ${s.c1.tex} and ${dep} = ${s.c2.tex}`);
    return {
      question,
      answer,
      steps,
      diagram,
      distractors: distinctDistractors(answer, wrongs.map(m), (q) => m(piTex(vol.add(offset(q))))),
      check: { kind: 'calculus.region', measure: 'volume', bounds: [s.lo.value, s.hi.value] },
    };
  },
});

// ---------------------------------------------------------------- volumes by cross sections

type Shape = 'square' | 'semicircle' | 'equilateral' | 'rightIso';
const SHAPE_TEXT: Record<Shape, string> = {
  square: 'squares',
  semicircle: 'semicircles',
  equilateral: 'equilateral triangles',
  rightIso: 'isosceles right triangles with one leg in the base',
};

/** k·√3 as TeX. */
const sqrt3Tex = (k: Frac) => (k.d === 1 ? `${k.n === 1 ? '' : k.n === -1 ? '-' : k.n}\\sqrt{3}` : `\\frac{${k.n === 1 ? '' : k.n}\\sqrt{3}}{${k.d}}`);

export const crossSections = defineTopic({
  id: 'calc.cross-sections',
  subject: 'calculus',
  category: 'Applications of Integration',
  title: 'Volumes by Cross Sections',
  description: 'Solids with a known base region whose cross sections are squares, semicircles or triangles.',
  instruction: 'Find the volume of each solid.',
  multipleChoice: true,
  defaultCount: 6,
  options: [
    {
      type: 'select',
      id: 'shape',
      label: 'Cross sections',
      default: 'any',
      choices: [
        { value: 'any', label: 'Mixed' },
        { value: 'square', label: 'Squares' },
        { value: 'semicircle', label: 'Semicircles' },
        { value: 'equilateral', label: 'Equilateral triangles' },
      ],
    },
    { type: 'boolean', id: 'graph', label: 'Show the base region', default: true },
  ],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const sOpt = strOpt(ctx, 'shape');
    const shape = (sOpt === 'any' ? rng.pick<Shape>(difficulty === 'easy' ? ['square', 'semicircle'] : ['square', 'semicircle', 'equilateral', 'rightIso']) : sOpt) as Shape;
    const kind = rng.pick(difficulty === 'easy' ? ['root', 'line', 'parab'] : difficulty === 'medium' ? ['parab', 'line', 'root'] : ['parab', 'lineParab', 'root', 'line']);
    let c1: Curve;
    let c2: Curve;
    let lo: Frac;
    let hi: Frac;
    let stated: number[] = [];
    switch (kind) {
      case 'root': {
        const b = rng.int(1, 6);
        const a = difficulty === 'easy' ? 1 : rng.int(1, 3);
        c1 = a === 1 ? rootCurve('x') : { tex: `${a}\\sqrt{x}`, f: (x) => a * Math.sqrt(Math.max(0, x)), sq: Poly.of(0, a * a) };
        c2 = polyCurve(Poly.of(0), 'x');
        lo = new Frac(0);
        hi = new Frac(b);
        stated = [b];
        break;
      }
      case 'line': {
        // y = c − m x with the axes
        const mm = rng.int(1, 3);
        const k = rng.int(1, 3);
        c1 = polyCurve(Poly.of(mm * k, -mm), 'x');
        c2 = polyCurve(Poly.of(0), 'x');
        lo = new Frac(0);
        hi = new Frac(k);
        stated = [0];
        break;
      }
      case 'parab': {
        const n = rng.int(1, 3);
        const a = rng.int(1, 2);
        c1 = polyCurve(new Poly([a * n * n, 0, -a]), 'x');
        c2 = polyCurve(Poly.of(0), 'x');
        lo = new Frac(-n);
        hi = new Frac(n);
        break;
      }
      case 'lineParab':
      default: {
        const mm = rng.int(1, 4);
        const n = rng.int(1, 2);
        c1 = polyCurve(Poly.of(0, mm), 'x');
        c2 = polyCurve(new Poly([0, 0, n]), 'x');
        lo = new Frac(0);
        hi = new Frac(mm, n);
        break;
      }
    }
    const s2 = c1.poly && c2.poly ? c1.poly.sub(c2.poly).powInt(2) : c1.sq!;
    const I = exactIntegral(s2, lo, hi);
    const show = (sh: Shape, base: Frac) =>
      sh === 'square' ? num(base) : sh === 'semicircle' ? piTex(base.div(8)) : sh === 'equilateral' ? sqrt3Tex(base.div(4)) : num(base.div(2));
    const answer = m(show(shape, I));
    const area = (sh: Shape) => (sh === 'square' ? 's^{2}' : sh === 'semicircle' ? '\\frac{\\pi}{8}s^{2}' : sh === 'equilateral' ? '\\frac{\\sqrt{3}}{4}s^{2}' : '\\frac{1}{2}s^{2}');
    const bounds = stated.map((v) => `$x = ${v}$`);
    const parts = [`$y = ${c1.tex}$`, `$y = ${c2.tex}$`, ...bounds];
    const list = parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
    const sTex = c2.tex === '0' ? c1.tex : `(${c1.tex}) - (${c2.tex})`;
    const others = (['square', 'semicircle', 'equilateral', 'rightIso'] as Shape[]).filter((x) => x !== shape).map((x) => show(x, I));
    // semicircle with radius s instead of diameter s
    if (shape === 'semicircle') others.unshift(piTex(I.div(2)));
    const diagram = ctx.options.graph === false ? undefined : regionFigure(c1, c2, lo.value, hi.value, false, null, `Base region bounded by y = ${c1.tex} and y = ${c2.tex}`);
    return {
      question: `The base of a solid is the region bounded by ${list}. Cross sections perpendicular to the $x$-axis are ${SHAPE_TEXT[shape]}.`,
      answer,
      steps: [`Side (diameter) of a cross section: $s = ${sTex}$; area $A = ${area(shape)}$.`, `$\\displaystyle V = \\int_{${num(lo)}}^{${num(hi)}} A(x)\\,dx$`, answer],
      diagram,
      distractors: distinctDistractors(answer, others.map(m), (q) => m(show(shape, I.add(offset(q))))),
      check: { kind: 'calculus.region', measure: 'cross', bounds: [lo.value, hi.value] },
    };
  },
});

// ---------------------------------------------------------------- shell method

export const shellMethod = defineTopic({
  id: 'calc.shell-method',
  subject: 'calculus',
  category: 'Applications of Integration',
  title: 'Volumes by the Shell Method',
  description: 'Volumes of revolution with cylindrical shells, about the y-axis, the x-axis or another line.',
  instruction: 'Use the shell method to find the exact volume of each solid.',
  multipleChoice: true,
  defaultCount: 6,
  options: [{ type: 'boolean', id: 'graph', label: 'Show the region', default: true }],
  generate(ctx): ProblemContent {
    const { rng, difficulty } = ctx;
    const kind = rng.pick(difficulty === 'easy' ? ['cap', 'under'] : difficulty === 'medium' ? ['cap', 'lineParab', 'under', 'inY'] : ['lineParab', 'shifted', 'inY', 'shifted']);
    const inY = kind === 'inY';
    const v = inY ? 'y' : 'x';
    const dep = inY ? 'x' : 'y';
    let c1: Curve;
    let c2: Curve;
    let lo: number;
    let hi: number;
    let stated: number[] = [];
    let k = 0;
    switch (kind) {
      case 'cap':
      case 'inY': {
        // dep = m·s − s² and dep = 0 on [0, m]
        const mm = rng.int(1, 4);
        const a = rng.int(1, 2);
        c1 = polyCurve(new Poly([0, a * mm, -a]), v);
        c2 = polyCurve(Poly.of(0), v);
        lo = 0;
        hi = mm;
        break;
      }
      case 'under': {
        const a = rng.int(1, 3);
        const p = rng.int(1, 2);
        const b = rng.int(1, 3);
        c1 = polyCurve(new Poly([...Array(p).fill(0), a]), 'x');
        c2 = polyCurve(Poly.of(0), 'x');
        lo = 0;
        hi = b;
        stated = [b];
        break;
      }
      case 'lineParab': {
        const mm = rng.int(1, 4);
        c1 = polyCurve(Poly.of(0, mm), 'x');
        c2 = polyCurve(new Poly([0, 0, 1]), 'x');
        lo = 0;
        hi = mm;
        break;
      }
      case 'shifted':
      default: {
        const mm = rng.int(1, 3);
        c1 = polyCurve(Poly.of(0, mm), 'x');
        c2 = polyCurve(new Poly([0, 0, 1]), 'x');
        lo = 0;
        hi = mm;
        k = rng.bool() ? -rng.int(1, 3) : mm + rng.int(0, 2);
        break;
      }
    }
    const h = c1.poly!.sub(c2.poly!);
    const radius = Poly.of(-k, 1);
    const V = exactIntegral(radius.mul(h), lo, hi).abs().mul(2);
    const answer = m(piTex(V));
    const parts = [`$${dep} = ${c1.tex}$`, `$${dep} = ${c2.tex}$`, ...stated.map((x) => `$${v} = ${x}$`)];
    const list = parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
    const axis = k === 0 ? `the $${dep}$-axis` : `the line $${v} = ${k}$`;
    const rTex = k === 0 ? v : k < 0 ? `${v} + ${-k}` : `${k} - ${v}`;
    const hTex = c2.tex === '0' ? c1.tex : `${c1.tex} - ${c2.tex.startsWith('-') ? `(${c2.tex})` : c2.tex}`.replace(/ - x\^\{2\}$/, ' - x^{2}');
    // common mistakes: forgetting 2, using disks, wrong radius
    const disk = exactIntegral(c1.poly!.powInt(2).sub(c2.poly!.powInt(2)), lo, hi).abs();
    const wrongs = [piTex(V.div(2)), piTex(disk), num(V), piTex(exactIntegral(Poly.of(k, 1).mul(h), lo, hi).abs().mul(2))];
    const diagram = ctx.options.graph === false ? undefined : regionFigure(c1, c2, lo, hi, inY, null, `Region bounded by ${dep} = ${c1.tex} and ${dep} = ${c2.tex}`, k === 0 ? null : k);
    return {
      question: `The region bounded by ${list} is revolved about ${axis}.`,
      answer,
      steps: [`Shell radius $${rTex}$, height $${hTex}$.`, `$\\displaystyle V = 2\\pi\\int_{${lo}}^{${hi}} (${rTex})(${hTex})\\,d${v}$`.replace(`(${v})(`, `${v}(`), answer],
      diagram,
      distractors: distinctDistractors(answer, wrongs.map(m), (q) => m(piTex(V.add(offset(q))))),
      check: { kind: 'calculus.region', measure: 'shell', bounds: [lo, hi] },
    };
  },
});
