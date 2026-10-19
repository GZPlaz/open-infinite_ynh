/** Verifiers for the alg2-explog pack (exponential and logarithmic functions). */
import { expect } from 'vitest';
import { close, closeC, evaluate, evalReal, listItems, mathSegments, onlyMath, splitTop, stripUnits, type C } from '../evaluator';
import { curvePoints, rhs, sides, type Verifier } from '../verify';

const TEXT_OR = '\\text{ or }';

/** Real value of a LaTeX expression, or null when undefined / non-real. */
function realOrNull(tex: string, vars: Record<string, number> = {}): number | null {
  try {
    const v = evaluate(tex, { vars });
    if (!Number.isFinite(v.re) || Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) return null;
    return v.re;
  } catch {
    return null;
  }
}

function seg(rich: string, label: RegExp): string | null {
  const mm = label.exec(rich);
  return mm ? mm[1]! : null;
}

/** Brace group starting at s[i] === '{'; returns [content, index after]. */
function group(s: string, i: number): [string, number] {
  expect(s[i], `brace group in ${s}`).toBe('{');
  let depth = 0;
  let j = i;
  do {
    if (s[j] === '{') depth++;
    else if (s[j] === '}') depth--;
    j++;
  } while (depth > 0 && j < s.length);
  return [s.slice(i + 1, j - 1), j];
}

interface Parts {
  form: 'log' | 'exp';
  B: string;
  A: string;
  C: string;
}

/** `\log_{B} A = C` or `B^{C} = A` (also `\ln`, `\log`). */
function parseForm(tex: string): Parts {
  const [l, r] = sides(tex);
  if (l.startsWith('\\ln')) return { form: 'log', B: 'e', A: l.slice(3).trim(), C: r };
  if (l.startsWith('\\log_')) {
    const [B, j] = group(l, 5);
    return { form: 'log', B, A: l.slice(j).trim(), C: r };
  }
  if (l.startsWith('\\log')) return { form: 'log', B: '10', A: l.slice(4).trim(), C: r };
  // exponential: last top-level ^
  let depth = 0;
  let at = -1;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i]!;
    if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    else if (ch === '^' && depth === 0) at = i;
  }
  expect(at, `exponential form ${tex}`).toBeGreaterThan(0);
  const [C] = group(l, at + 1);
  return { form: 'exp', B: l.slice(0, at), A: r, C };
}

/** Values of an equation's two sides minus each other (complex), or null. */
function residual(eq: string, v: string, x: number): C | null {
  const [l, r] = sides(eq);
  try {
    const a = evaluate(l, { vars: { [v]: x } });
    const b = evaluate(r, { vars: { [v]: x } });
    return { re: a.re - b.re, im: a.im - b.im };
  } catch {
    return null;
  }
}

function realResidual(eq: string, v: string, x: number): number | null {
  const [l, r] = sides(eq);
  const a = realOrNull(l, { [v]: x });
  const b = realOrNull(r, { [v]: x });
  return a === null || b === null ? null : a - b;
}

function scaleAt(eq: string, v: string, x: number): number {
  const [l, r] = sides(eq);
  return Math.max(1, Math.abs(realOrNull(l, { [v]: x }) ?? 1), Math.abs(realOrNull(r, { [v]: x }) ?? 1));
}

/** Arguments of every \log / \ln in an expression (parenthesised or a single token). */
function logArgs(tex: string): string[] {
  const out: string[] = [];
  const re = /\\(?:log(?:_\{[^{}]*\})?|ln) /g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(tex))) {
    const rest = tex.slice(mm.index + mm[0].length);
    if (rest.startsWith('(')) {
      let depth = 0;
      let j = 0;
      do {
        if (rest[j] === '(') depth++;
        else if (rest[j] === ')') depth--;
        j++;
      } while (depth > 0 && j < rest.length);
      out.push(rest.slice(0, j));
    } else {
      const t = /^[a-zA-Z0-9.]+(\^\{[^{}]*\})?/.exec(rest);
      if (t) out.push(t[0]);
    }
  }
  return out;
}

export const VERIFIERS: Record<string, Verifier> = {
  /** Exponential / logarithmic graph: stated features + plotted curve + dashed asymptote. */
  'alg2-explog.graph'(p) {
    const f = rhs(onlyMath(p.question));
    const fx = (x: number) => realOrNull(f, { x });
    const isExp = p.check!.type === 'exp';
    const asym = seg(p.answer, /Asymptote: \$([xy]) = ([^$]*)\$/);
    expect(asym, p.answer).toBe(isExp ? 'y' : 'x');
    const V = evalReal(/Asymptote: \$[xy] = ([^$]*)\$/.exec(p.answer)![1]!);
    if (isExp) {
      const ends = [fx(-60), fx(60)].filter((y): y is number => y !== null);
      expect(ends.some((y) => Math.abs(y - V) < 1e-6), `${f}: asymptote y = ${V}`).toBe(true);
      const yi = listItems(seg(p.answer, /y-intercept: \$([^$]*)\$/)!).map((t) => evalReal(t));
      expect(yi[0]).toBe(0);
      expect(close(yi[1]!, fx(0)!), `${f}: y-intercept`).toBe(true);
      const range = seg(p.answer, /range: \$([^$]*)\$/);
      if (range !== null) {
        const mm = /^y ([<>]) (.*)$/.exec(range)!;
        expect(close(evalReal(mm[2]!), V)).toBe(true);
        expect(mm[1] === '>', `${f}: range side`).toBe(fx(0)! > V);
        expect(p.answer).toMatch(/domain: all real numbers/);
      }
    } else {
      expect(fx(V - 0.5), `${f} undefined left of x = ${V}`).toBeNull();
      expect(Math.abs(fx(V + 1e-7)!), `${f} blows up at x = ${V}`).toBeGreaterThan(4);
      const xi = listItems(seg(p.answer, /x-intercept: \$([^$]*)\$/)!).map((t) => evalReal(t));
      expect(xi[1]).toBe(0);
      expect(Math.abs(fx(xi[0]!)!), `${f}: x-intercept`).toBeLessThan(1e-9);
      const dom = seg(p.answer, /domain: \$([^$]*)\$/);
      if (dom !== null) {
        const mm = /^x > (.*)$/.exec(dom)!;
        expect(close(evalReal(mm[1]!), V)).toBe(true);
        expect(p.answer).toMatch(/range: all real numbers/);
      }
    }
    const pts = curvePoints(p.answerDiagram);
    expect(pts.length, 'curve drawn').toBeGreaterThan(20);
    for (const [x, y] of pts) {
      const fy = fx(x);
      expect(fy !== null && Math.abs(fy - y) <= 1e-6 * Math.max(1, Math.abs(y)), `(${x}, ${y}) not on y = ${f}`).toBe(true);
    }
    const dashed = (p.answerDiagram?.items ?? []).filter((it) => it.t === 'path' && it.dash);
    const k = isExp ? 1 : 0;
    expect(
      dashed.some((it) => it.t === 'path' && it.pts.every((q) => Math.abs(q[k] - V) < 1e-9)),
      `dashed asymptote at ${isExp ? 'y' : 'x'} = ${V}`,
    ).toBe(true);
  },

  /**
   * Equation solutions, exact and/or rounded. check: { variable, solutions,
   * extraneous?, places?, equation? }. Exact items must satisfy the equation;
   * an `\approx` item must be within half a unit of a sign change of it.
   */
  'alg2-explog.solve'(p) {
    const c = p.check!;
    const v = c.variable as string;
    const eq = (c.equation as string | undefined) ?? onlyMath(p.question);
    const places = (c.places as number | undefined) ?? 3;
    const half = 0.5 * 10 ** -places + 1e-9;
    const none = /no solution/i.test(p.answer);
    const got: Array<{ x: number; approx: boolean }> = [];
    if (!none) {
      for (const sgm of mathSegments(p.answer)) {
        for (const alt of splitTop(sgm, [TEXT_OR]).parts) {
          const pre = new RegExp(`^${v}\\s*(=|\\\\approx)`).exec(alt.trim());
          const firstRel = pre?.[1] ?? '=';
          const t = pre ? alt.trim().slice(pre[0].length) : alt;
          for (const item of listItems(t)) {
            const { parts, rels } = splitTop(stripUnits(item), ['=', '\\approx']);
            let exact: number | null = null;
            let approx: number | null = null;
            parts.forEach((part, i) => {
              const isApprox = (i === 0 ? firstRel : rels[i - 1]) === '\\approx';
              const x = evalReal(part);
              if (isApprox) {
                approx = x;
                const lo = realResidual(eq, v, x - half);
                const hi = realResidual(eq, v, x + half);
                const mid = realResidual(eq, v, x);
                const ok = (mid !== null && Math.abs(mid) < 1e-9 * scaleAt(eq, v, x)) || (lo !== null && hi !== null && lo * hi <= 0);
                expect(ok, `${eq}: no root within ${half} of ${x}`).toBe(true);
                if (exact !== null) expect(Math.abs(exact - x), `${item}: rounding`).toBeLessThanOrEqual(half);
              } else {
                exact = x;
                const r = residual(eq, v, x);
                expect(r !== null && closeC(r, { re: 0, im: 0 }, 1e-8 * scaleAt(eq, v, x)), `${eq} at ${v} = ${x}`).toBe(true);
                expect(realResidual(eq, v, x), `${eq}: both sides real at ${x}`).not.toBeNull();
              }
            });
            got.push(exact !== null ? { x: exact, approx: false } : { x: approx!, approx: true });
          }
        }
      }
    }
    const want = c.solutions as number[];
    expect(got.length, `${p.question} → ${p.answer}: count`).toBe(want.length);
    const left = [...want];
    for (const g of got) {
      const k = left.findIndex((w) => Math.abs(w - g.x) <= (g.approx ? half : 1e-6 * Math.max(1, Math.abs(w))));
      expect(k, `${p.answer}: unexpected ${g.x}`).toBeGreaterThanOrEqual(0);
      left.splice(k, 1);
    }
    const args = logArgs(eq);
    const inDomain = (x: number) => args.every((t) => (realOrNull(t, { [v]: x }) ?? -1) > 0);
    for (const g of got) if (!g.approx) expect(inDomain(g.x), `${eq}: ${v} = ${g.x} outside the domain`).toBe(true);
    for (const x of (c.extraneous as number[] | undefined) ?? []) {
      const r = realResidual(eq, v, x);
      expect(!inDomain(x) || r === null || Math.abs(r) > 1e-6, `${x} should be extraneous for ${eq}`).toBe(true);
    }
  },

  /** Exponential ↔ logarithmic form: same base, argument and exponent; true when numeric. */
  'alg2-explog.forms'(p) {
    const q = parseForm(onlyMath(p.question));
    const a = parseForm(onlyMath(p.answer));
    expect(a.form, `${p.question} → ${p.answer}`).not.toBe(q.form);
    const env: Record<string, number> = { x: 2.37, n: 1.91, k: 3.13, m: 2.71, p: 1.37, r: 2.13, v: 1.77, w: 2.93 };
    for (const key of ['B', 'A', 'C'] as const) {
      const x = evalReal(q[key], { vars: env });
      const y = evalReal(a[key], { vars: env });
      expect(close(x, y), `${key}: ${q[key]} vs ${a[key]}`).toBe(true);
    }
    const letters = /[a-df-zA-Z]/.test([q.A, q.B, q.C].join(' ').replace(/\\[a-zA-Z]+/g, ''));
    if (!letters) {
      const B = evalReal(q.B);
      expect(close(B ** evalReal(q.C), evalReal(q.A), 1e-9), `${p.question} is true`).toBe(true);
      const lhs = evalReal(sides(onlyMath(p.answer))[0]);
      expect(close(lhs, evalReal(sides(onlyMath(p.answer))[1]), 1e-9), `${p.answer} is true`).toBe(true);
    }
  },

  /** Numeric answer equals the question's expression (exactly, or within rounding for \approx). */
  'alg2-explog.num'(p) {
    const q = evalReal(onlyMath(p.question));
    const { parts, rels } = splitTop(onlyMath(p.answer), ['=', '\\approx']);
    const a = evalReal(parts.at(-1)!);
    if (rels.at(-1) === '\\approx') {
      const places = (p.check!.places as number | undefined) ?? 3;
      expect(Math.abs(a - q), `${p.question} → ${p.answer}`).toBeLessThanOrEqual(0.5 * 10 ** -places + 1e-9);
      expect(close(a, q, 1e-12), 'rounded value marked with \\approx').toBe(Math.abs(a - q) < 1e-12);
    } else expect(close(a, q, 1e-9), `${p.question} → ${p.answer}`).toBe(true);
  },

  /** log_b N written in terms of given logs: evaluate both with a concrete base. */
  'alg2-explog.terms'(p) {
    const segs = mathSegments(p.question);
    const target = segs.at(-1)!;
    const baseEnv = { b: 4.3 };
    const env: Record<string, number> = {};
    for (const s of segs.slice(0, -1)) {
      const [l, r] = sides(s);
      env[r.trim()] = evalReal(l, { vars: baseEnv });
    }
    expect(Object.keys(env).length, p.question).toBeGreaterThanOrEqual(2);
    const ans = onlyMath(p.answer);
    expect(ans, 'answer uses only the given values').not.toMatch(/\\log|\\ln/);
    expect(close(evalReal(ans, { vars: env }), evalReal(target, { vars: baseEnv }), 1e-9), `${p.question} → ${p.answer}`).toBe(true);
  },

  /**
   * Growth / decay word problem. The expected value is recomputed from the
   * model parameters (each given value must appear in the question) and
   * compared with the displayed answer within its rounding.
   */
  'alg2-explog.word'(p) {
    const c = p.check! as Record<string, number | string | boolean | string[]>;
    for (const g of (c.given as string[]) ?? []) expect(p.question, `question shows ${g}`).toContain(g);
    const P = c.P as number;
    const A = c.A as number;
    const t = c.t as number;
    let want: number;
    if (c.model === 'continuous') {
      const r = c.r as number;
      want = { A: P * Math.exp(r * t), t: Math.log(A / P) / r, r: Math.log(A / P) / t, P: A / Math.exp(r * t) }[c.unknown as 'A']!;
    } else {
      const g = c.g as number;
      const per = c.period as number;
      want = { A: P * g ** (t / per), t: (per * Math.log(A / P)) / Math.log(g), r: (A / P) ** (1 / t) - 1, P: A / g ** (t / per) }[c.unknown as 'A']!;
    }
    if (c.absolute) want = Math.abs(want);
    if (c.percent) want *= 100;
    const tex = onlyMath(p.answer).replace(/\{,\}/g, '').replace(/\\%/g, '');
    const { parts } = splitTop(tex, ['=', '\\approx']);
    const got = evalReal(parts.at(-1)!);
    const tol = 0.5 * 10 ** -(c.places as number) + 1e-9 * Math.max(1, Math.abs(want));
    expect(Math.abs(got - want), `${p.question} → ${p.answer} (want ${want})`).toBeLessThanOrEqual(tol);
  },
};
