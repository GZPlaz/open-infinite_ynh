/** Verifiers for the alg2-quadratics-functions pack. */
import { expect } from 'vitest';
import type { Diagram } from '../../src/engine/diagram';
import { closeC, evalReal, evaluate, listItems, mathSegments, onlyMath, splitTop, type C } from '../evaluator';
import { chainHolds, curvePoints, sides, type Verifier } from '../verify';

const P = 'alg2-quadratics-functions';

const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** Coefficients of a (rendered) quadratic g from three samples. */
function quadCoeffs(g: (x: number) => number): [number, number, number] {
  const c = g(0);
  const p = g(1);
  const q = g(-1);
  return [(p + q) / 2 - c, (p - q) / 2, c];
}

/** Answer parts like `Vertex: $…$`, keyed by the lowercase label. */
function labelled(answer: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of answer.split('; ')) {
    const i = part.indexOf(':');
    out.set(part.slice(0, i).trim().toLowerCase(), part.slice(i + 1).trim());
  }
  return out;
}

function tupleOf(tex: string): number[] {
  return listItems(tex).map((t) => evalReal(t));
}

function curveOn(d: Diagram | undefined, f: (x: number) => number): void {
  const pts = curvePoints(d);
  expect(pts.length, 'curve drawn').toBeGreaterThan(5);
  for (const [x, y] of pts) expect(near(y, f(x), 1e-7), `curve point (${x}, ${y}) vs ${f(x)}`).toBe(true);
}

function pointInPolygon(x: number, y: number, pts: ReadonlyArray<readonly [number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!;
    const [xj, yj] = pts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- functions

interface Defs {
  fns: Map<string, { v: string; body: string }>;
}

function parseDefs(question: string): Defs {
  const fns = new Map<string, { v: string; body: string }>();
  for (const seg of mathSegments(question)) {
    const mm = /^([a-z])\(([a-z])\) = (.+)$/.exec(seg.trim());
    if (mm) fns.set(mm[1]!, { v: mm[2]!, body: mm[3]! });
  }
  return { fns };
}

function call(defs: Defs, name: string, arg: C): C {
  const d = defs.fns.get(name);
  expect(d, `function ${name} defined`).toBeTruthy();
  return evaluate(d!.body, { vars: { [d!.v]: arg } });
}

const cadd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
const csub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cdiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

/** Evaluate a request such as `f(g(2))`, `(f + g)(x)`, `\left(\frac{f}{g}\right)(3)`, `f(x + 1)`. */
function request(defs: Defs, s: string, env: Record<string, number>): C {
  s = s.trim();
  let mm = /^\\left\(\\frac\{([a-z])\}\{([a-z])\}\\right\)\((.*)\)$/.exec(s);
  if (mm) {
    const x = request(defs, mm[3]!, env);
    return cdiv(call(defs, mm[1]!, x), call(defs, mm[2]!, x));
  }
  mm = /^\(([a-z]) (\+|-|\\cdot|\\circ) ([a-z])\)\((.*)\)$/.exec(s);
  if (mm) {
    const x = request(defs, mm[4]!, env);
    const [f, op, g] = [mm[1]!, mm[2]!, mm[3]!];
    if (op === '\\circ') return call(defs, f, call(defs, g, x));
    const a = call(defs, f, x);
    const b = call(defs, g, x);
    return op === '+' ? cadd(a, b) : op === '-' ? csub(a, b) : cmul(a, b);
  }
  mm = /^([a-z])\((.*)\)$/.exec(s);
  if (mm && defs.fns.has(mm[1]!)) return call(defs, mm[1]!, request(defs, mm[2]!, env));
  return evaluate(s, { vars: env });
}

const FUNC_POINTS = [0.37, 1.61, 2.83, -1.29, 4.07];

export const VERIFIERS: Record<string, Verifier> = {
  /** y = f(x): curve, vertex, axis, intercepts read from the rendered answer. */
  [`${P}.quadGraph`](p) {
    const [l, r] = sides(onlyMath(p.question));
    expect(l.trim()).toBe('y');
    const f = (x: number) => evalReal(r, { vars: { x } });
    curveOn(p.answerDiagram, f);
    const parts = labelled(p.answer);
    const [h, k] = tupleOf(onlyMath(parts.get('vertex')!));
    expect(near(f(h!), k!), `vertex value ${p.answer}`).toBe(true);
    const [a, b, c] = quadCoeffs(f);
    expect(near(h!, -b / (2 * a)), `vertex x for ${p.question}`).toBe(true);
    const axis = splitTop(onlyMath(parts.get('axis of symmetry')!), ['=']).parts;
    expect(axis[0]).toBe('x');
    expect(near(evalReal(axis[1]!), h!)).toBe(true);
    if (parts.has('y-intercept')) {
      const [x0, y0] = tupleOf(onlyMath(parts.get('y-intercept')!));
      expect(x0).toBe(0);
      expect(near(y0!, f(0))).toBe(true);
      const D = b * b - 4 * a * c;
      const xs = parts.get('x-intercepts') ?? parts.get('x-intercept')!;
      if (/none/i.test(xs)) expect(D, `${p.question} has x-intercepts`).toBeLessThan(-1e-9);
      else {
        const items = splitTop(onlyMath(xs), [',']).parts.map(tupleOf);
        expect(items.length, `x-intercept count for ${p.question}`).toBe(Math.abs(D) < 1e-9 ? 1 : 2);
        for (const [x, y] of items) {
          expect(y).toBe(0);
          expect(Math.abs(f(x!)), `f(${x}) = 0`).toBeLessThan(1e-7);
        }
        if (items.length === 2) expect(near(items[0]![0]!, items[1]![0]!)).toBe(false);
      }
    }
  },

  /** y < f(x): boundary curve, dashing, and the shaded region sampled on a grid. */
  [`${P}.quadIneq`](p) {
    const q = onlyMath(p.question);
    const { parts, rels } = splitTop(q, ['\\le', '\\ge', '<', '>']);
    expect(rels.length).toBe(1);
    expect(parts[0]).toBe('y');
    const rel = rels[0]!;
    const rhs = parts[1]!;
    const strict = rel === '<' || rel === '>';
    const xs: number[] = [];
    const fs: number[] = [];
    for (let i = 0; i <= 1000; i++) {
      const x = -10 + i * 0.02;
      xs.push(x);
      fs.push(evalReal(rhs, { vars: { x } }));
    }
    const f = (x: number) => evalReal(rhs, { vars: { x } });
    curveOn(p.answerDiagram, f);
    const curves = (p.answerDiagram?.items ?? []).filter((it) => it.t === 'path' && it.role === 'curve');
    curves.forEach((c) => expect(Boolean((c as { dash?: boolean }).dash), `boundary dashed iff strict (${q})`).toBe(strict));
    expect(/dashed/i.test(p.answer)).toBe(strict);
    expect(/below/i.test(p.answer)).toBe(rel === '<' || rel === '\\le');
    const polys = (p.answerDiagram?.items ?? []).filter((it) => it.t === 'path' && it.fill && it.closed).map((it) => (it as { pts: Array<readonly [number, number]> }).pts);
    expect(polys.length, 'shaded region').toBeGreaterThan(0);
    let tested = 0;
    for (let gx = 0; gx < 18; gx++) {
      for (let gy = 0; gy < 18; gy++) {
        const i = 15 + gx * 55;
        const x = xs[i]!;
        const y = -9.6 + gy * 1.13;
        // skip points close to the boundary
        let clear = true;
        const s0 = Math.sign(y - fs[i]!);
        for (let j = Math.max(0, i - 10); j <= Math.min(1000, i + 10); j++) {
          if (Math.abs(y - fs[j]!) < 0.3 || Math.sign(y - fs[j]!) !== s0) clear = false;
        }
        if (!clear) continue;
        tested++;
        const shaded = polys.some((pts) => pointInPolygon(x, y, pts));
        expect(shaded, `(${x}, ${y}) shading vs ${q}`).toBe(chainHolds(q, { x, y }));
      }
    }
    expect(tested).toBeGreaterThan(50);
  },

  /** `$c = …$; $x^2 + bx + c = (x + h)^2$` */
  [`${P}.completeSquare`](p) {
    const v = p.check!.variable as string;
    const q = onlyMath(p.question);
    const [cSeg, sqSeg] = mathSegments(p.answer);
    const [cl, cr] = sides(cSeg!);
    expect(cl).toBe('c');
    const cv = evalReal(cr);
    const [l, r] = sides(sqSeg!);
    for (const t of [-2.7, -1.3, 0.6, 1.7, 3.1]) {
      const want = evalReal(q, { vars: { [v]: t, c: cv } });
      expect(near(evalReal(l, { vars: { [v]: t } }), want), `${q} with c = ${cv}`).toBe(true);
      expect(near(evalReal(r, { vars: { [v]: t } }), want), `${sqSeg} at ${t}`).toBe(true);
    }
  },

  [`${P}.discriminant`](p) {
    const v = p.check!.variable as string;
    const [l, r] = sides(onlyMath(p.question));
    const g = (x: number) => evalReal(l, { vars: { [v]: x } }) - evalReal(r, { vars: { [v]: x } });
    const [a, b, c] = quadCoeffs(g);
    expect(Math.abs(a)).toBeGreaterThan(1e-9);
    const D = Math.round(b * b - 4 * a * c);
    const task = p.check!.task as string;
    if (task !== 'describe') {
      const [dl, dr] = sides(mathSegments(p.answer)[0]!);
      expect(dl).toBe('D');
      expect(evalReal(dr), p.answer).toBe(D);
    }
    if (task !== 'value') {
      const want = D < 0 ? 'two imaginary' : D === 0 ? 'one rational' : Number.isInteger(Math.sqrt(D)) ? 'two rational' : 'two irrational';
      expect(p.answer, p.question).toContain(want);
    }
  },

  /** Function evaluation / operations: the answer's left side is the request; its right side its value. */
  [`${P}.funcEval`](p) {
    const defs = parseDefs(p.question);
    const segs = mathSegments(p.question);
    const req = segs[segs.length - 1]!;
    const [al, ar] = sides(mathSegments(p.answer)[0]!);
    expect(al.replace(/\s+/g, ''), 'answer names the request').toBe(req.replace(/\s+/g, ''));
    const vars = new Set([...defs.fns.values()].map((d) => d.v));
    const bare = req
      .replace(/^\\left\(\\frac\{[a-z]\}\{[a-z]\}\\right\)|^\([a-z] [^)]*\)/, '')
      .replace(/[a-z](?=\()/g, '')
      .replace(/\\[a-zA-Z]+/g, '');
    const usesVar = [...vars].some((v) => bare.includes(v));
    const pts = usesVar ? FUNC_POINTS : [0];
    for (const t of pts) {
      const env = Object.fromEntries([...vars].map((v) => [v, t]));
      const want = request(defs, req, env);
      const got = evaluate(ar, { vars: env });
      expect(closeC(want, got, 1e-7), `${req} = ${ar} at ${t}: ${JSON.stringify(want)} vs ${JSON.stringify(got)}`).toBe(true);
    }
  },

  /** f⁻¹: f(g(t)) = t on the stated domain (and g(f(t)) = t when unrestricted); restrictions are tight. */
  [`${P}.inverse`](p) {
    const [ql, qr] = sides(onlyMath(p.question));
    const name = /^([a-z])\(x\)$/.exec(ql)![1]!;
    const segs = mathSegments(p.answer);
    const [al, ar] = sides(segs[0]!);
    expect(al.replace(/\s+/g, '')).toBe(`${name}^{-1}\\left(x\\right)`);
    const f = (x: number | C) => evaluate(qr, { vars: { x } });
    const g = (x: number | C) => evaluate(ar, { vars: { x } });
    const restriction = segs[1];
    if (restriction) {
      const mm = /^x \\ge (.+)$/.exec(restriction)!;
      const lo = evalReal(mm[1]!);
      for (const t of [lo + 0.3, lo + 1.1, lo + 2.7, lo + 4.2]) expect(closeC(f(g(t)), { re: t, im: 0 }, 1e-7), `f(g(${t}))`).toBe(true);
      // below the restriction g is not an inverse
      expect(closeC(f(g(lo - 1.3)), { re: lo - 1.3, im: 0 }, 1e-7), 'restriction is needed').toBe(false);
      // the restriction is the range of f
      expect(near(f(g(lo)).re, lo)).toBe(true);
    } else {
      for (const t of [-2.7, -1.3, 0.6, 1.7, 3.1]) {
        expect(closeC(f(g(t)), { re: t, im: 0 }, 1e-7), `f(g(${t})) for f = ${qr}, g = ${ar}`).toBe(true);
        expect(closeC(g(f(t)), { re: t, im: 0 }, 1e-7), `g(f(${t}))`).toBe(true);
      }
    }
  },

  /** "Are f and g inverses?" */
  [`${P}.inverseVerify`](p) {
    const defs = parseDefs(p.question);
    const F = (x: C | number) => call(defs, 'f', typeof x === 'number' ? { re: x, im: 0 } : x);
    const G = (x: C | number) => call(defs, 'g', typeof x === 'number' ? { re: x, im: 0 } : x);
    const pts = [-2.7, -1.3, 0.6, 1.7, 3.1];
    const isInv = pts.every((t) => closeC(F(G(t)), { re: t, im: 0 }, 1e-7) && closeC(G(F(t)), { re: t, im: 0 }, 1e-7));
    if (p.answer.startsWith('Yes')) expect(isInv, p.question).toBe(true);
    else {
      expect(p.answer.startsWith('No')).toBe(true);
      expect(isInv, p.question).toBe(false);
      const [l, r] = sides(mathSegments(p.answer)[0]!);
      expect(l).toBe('f(g(x))');
      for (const t of pts) expect(closeC(F(G(t)), evaluate(r, { vars: { x: t } }), 1e-7), `${p.answer} at ${t}`).toBe(true);
    }
  },
};
