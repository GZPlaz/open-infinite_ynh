/**
 * Test-only numeric evaluator for the LaTeX subset the generators emit.
 *
 * It lets the test-suite check answer keys end-to-end: parse the *rendered*
 * question and answer strings and verify them numerically (plugging solutions
 * back in, comparing expressions at random points, numeric derivatives, …).
 * Complex arithmetic is supported so complex quadratic roots can be checked.
 */

export interface C {
  re: number;
  im: number;
}

const c = (re: number, im = 0): C => ({ re, im });
const cadd = (a: C, b: C): C => c(a.re + b.re, a.im + b.im);
const csub = (a: C, b: C): C => c(a.re - b.re, a.im - b.im);
const cmul = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const cdiv = (a: C, b: C): C => {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) return c(NaN, NaN);
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d);
};
const cabs = (a: C): number => Math.hypot(a.re, a.im);
const cexp = (a: C): C => c(Math.exp(a.re) * Math.cos(a.im), Math.exp(a.re) * Math.sin(a.im));
const cln = (a: C): C => c(Math.log(cabs(a)), Math.atan2(a.im, a.re));
function cpow(a: C, b: C): C {
  if (b.im === 0 && Number.isInteger(b.re) && Math.abs(b.re) <= 64) {
    let r = c(1);
    for (let i = 0; i < Math.abs(b.re); i++) r = cmul(r, a);
    return b.re < 0 ? cdiv(c(1), r) : r;
  }
  if (a.im === 0 && b.im === 0 && a.re >= 0) return c(a.re ** b.re);
  if (a.re === 0 && a.im === 0) return c(0);
  return cexp(cmul(b, cln(a)));
}
function csqrt(a: C): C {
  if (a.im === 0) return a.re >= 0 ? c(Math.sqrt(a.re)) : c(0, Math.sqrt(-a.re));
  const r = cabs(a);
  return c(Math.sqrt((r + a.re) / 2), Math.sign(a.im) * Math.sqrt((r - a.re) / 2));
}
function cnthroot(a: C, n: number): C {
  if (a.im === 0 && n % 2 === 1) return c(Math.sign(a.re) * Math.abs(a.re) ** (1 / n));
  return cpow(a, c(1 / n));
}
const real = (f: (x: number) => number) => (a: C): C => {
  if (Math.abs(a.im) > 1e-12) throw new Error('complex argument to real function');
  return c(f(a.re));
};

const FUNCS: Record<string, (a: C) => C> = {
  sin: real(Math.sin),
  cos: real(Math.cos),
  tan: real(Math.tan),
  sec: real((x) => 1 / Math.cos(x)),
  csc: real((x) => 1 / Math.sin(x)),
  cot: real((x) => 1 / Math.tan(x)),
  ln: cln,
  log: real(Math.log10),
  arcsin: real(Math.asin),
  arccos: real(Math.acos),
  arctan: real(Math.atan),
};
const INVERSE: Record<string, string> = { sin: 'arcsin', cos: 'arccos', tan: 'arctan' };

type Tok = { k: 'num'; v: number } | { k: 'var'; v: string } | { k: 'cmd'; v: string } | { k: 'sym'; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch) || ch === '&') {
      i++;
      continue;
    }
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+|.)/.exec(src.slice(i))!;
      const name = m[1]!;
      i += m[0].length;
      if (name === 'left' || name === 'right' || name === 'displaystyle') continue;
      if ([',', ';', '!', ' ', ':', 'quad', 'qquad'].includes(name)) continue;
      if (name === 'text' || name === 'mathrm' || name === 'operatorname') {
        // \text{…}: skip the braced argument entirely (units, words)
        if (src[i] === '{') {
          let depth = 0;
          do {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
          } while (depth > 0 && i < src.length);
        }
        continue;
      }
      if (name === '{' || name === '}') out.push({ k: 'sym', v: name === '{' ? '(' : ')' });
      else if (name === 'lvert' || name === 'rvert' || name === 'vert' || name === '|') out.push({ k: 'sym', v: '|' });
      else if (name === 'dfrac' || name === 'tfrac') out.push({ k: 'cmd', v: 'frac' });
      else if (name === 'lt') out.push({ k: 'sym', v: '<' });
      else if (name === 'gt') out.push({ k: 'sym', v: '>' });
      else out.push({ k: 'cmd', v: name });
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^[0-9]*\.?[0-9]+|^[0-9]+/.exec(src.slice(i))!;
      out.push({ k: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out.push({ k: 'var', v: ch });
      i++;
      continue;
    }
    out.push({ k: 'sym', v: ch });
    i++;
  }
  return out;
}

export interface EvalOptions {
  /** Variable values; `e` and `i` are constants unless overridden. */
  vars?: Record<string, number | C>;
  /** Choice for every ± (and the opposite for ∓). */
  pm?: 1 | -1;
  /** Read `2\frac{1}{3}` as a mixed number instead of a product. */
  mixed?: boolean;
}

class Parser {
  private p = 0;
  private absDepth = 0;
  constructor(
    private readonly toks: Tok[],
    private readonly opts: EvalOptions,
  ) {}

  private peek(o = 0): Tok | undefined {
    return this.toks[this.p + o];
  }
  private isSym(v: string, o = 0): boolean {
    const t = this.peek(o);
    return t?.k === 'sym' && t.v === v;
  }
  private isCmd(v: string, o = 0): boolean {
    const t = this.peek(o);
    return t?.k === 'cmd' && t.v === v;
  }
  private expectSym(v: string): void {
    if (!this.isSym(v)) throw new Error(`expected '${v}' at token ${this.p}: ${JSON.stringify(this.peek())}`);
    this.p++;
  }

  parseAll(): C {
    const v = this.expr();
    if (this.p !== this.toks.length) throw new Error(`trailing tokens at ${this.p}: ${JSON.stringify(this.toks.slice(this.p))}`);
    return v;
  }

  private pmSign(): number {
    return this.opts.pm ?? 1;
  }

  expr(): C {
    let acc: C;
    if (this.isSym('-')) {
      this.p++;
      acc = cmul(c(-1), this.term());
    } else if (this.isSym('+')) {
      this.p++;
      acc = this.term();
    } else if (this.isCmd('pm') || this.isCmd('mp')) {
      const s = this.isCmd('pm') ? this.pmSign() : -this.pmSign();
      this.p++;
      acc = cmul(c(s), this.term());
    } else acc = this.term();
    for (;;) {
      if (this.isSym('+')) {
        this.p++;
        acc = cadd(acc, this.term());
      } else if (this.isSym('-')) {
        this.p++;
        acc = csub(acc, this.term());
      } else if (this.isCmd('pm') || this.isCmd('mp')) {
        const s = this.isCmd('pm') ? this.pmSign() : -this.pmSign();
        this.p++;
        acc = cadd(acc, cmul(c(s), this.term()));
      } else return acc;
    }
  }

  private startsPrimary(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'var') return true;
    if (t.k === 'sym') return t.v === '(' || t.v === '[' || t.v === '{' || (t.v === '|' && this.absDepth === 0);
    return ['frac', 'sqrt', 'pi', 'infty', 'binom'].includes(t.v) || t.v in FUNCS;
  }

  private term(): C {
    let acc = this.factor();
    for (;;) {
      if (this.isCmd('cdot') || this.isCmd('times')) {
        this.p++;
        acc = cmul(acc, this.factor());
      } else if (this.isCmd('div') || this.isSym('/')) {
        this.p++;
        acc = cdiv(acc, this.factor());
      } else if (this.startsPrimary()) {
        acc = cmul(acc, this.power());
      } else return acc;
    }
  }

  private factor(): C {
    if (this.isSym('-')) {
      this.p++;
      return cmul(c(-1), this.factor());
    }
    return this.power();
  }

  private power(): C {
    let base = this.primary();
    while (this.isSym('!')) {
      this.p++;
      base = c(factorial(base.re));
    }
    if (this.isSym('^')) {
      this.p++;
      if (this.isCmd('circ') || (this.isSym('{') && this.isCmd('circ', 1))) {
        this.p += this.isCmd('circ') ? 1 : 3;
        return cmul(base, c(Math.PI / 180));
      }
      return cpow(base, this.arg());
    }
    return base;
  }

  /** Braced group or a single token (as in x^2). */
  private arg(): C {
    if (this.isSym('{')) {
      this.p++;
      const v = this.expr();
      this.expectSym('}');
      return v;
    }
    const t = this.peek();
    if (t?.k === 'num') {
      this.p++;
      // x^23 means x^2·3 in TeX; generators must brace multi-digit exponents
      if (String(t.v).length > 1) throw new Error(`unbraced multi-digit exponent ^${t.v}`);
      return c(t.v);
    }
    if (t?.k === 'var') {
      this.p++;
      return this.lookup(t.v);
    }
    return this.primary();
  }

  private lookup(name: string): C {
    const v = this.opts.vars?.[name];
    if (v !== undefined) return typeof v === 'number' ? c(v) : v;
    if (name === 'e') return c(Math.E);
    if (name === 'i') return c(0, 1);
    throw new Error(`unbound variable ${name}`);
  }

  private primary(): C {
    const t = this.peek();
    if (!t) throw new Error('unexpected end of input');
    if (t.k === 'num') {
      this.p++;
      if (this.opts.mixed && this.isCmd('frac')) {
        const f = this.primary();
        return cadd(c(t.v), f);
      }
      return c(t.v);
    }
    if (t.k === 'var') {
      this.p++;
      let name = t.v;
      if (this.isSym('_')) {
        this.p++;
        if (this.isSym('{')) {
          this.p++;
          let sub = '';
          while (!this.isSym('}')) {
            const s = this.peek()!;
            sub += String(s.v);
            this.p++;
          }
          this.p++;
          name += `_${sub}`;
        } else {
          name += `_${String(this.peek()!.v)}`;
          this.p++;
        }
      }
      return this.lookup(name);
    }
    if (t.k === 'sym') {
      if (t.v === '(' || t.v === '[' || t.v === '{') {
        this.p++;
        const v = this.expr();
        this.expectSym(t.v === '(' ? ')' : t.v === '[' ? ']' : '}');
        return v;
      }
      if (t.v === '|') {
        this.p++;
        this.absDepth++;
        const v = this.expr();
        this.absDepth--;
        this.expectSym('|');
        return c(cabs(v));
      }
      throw new Error(`unexpected '${t.v}' at token ${this.p}`);
    }
    // commands
    this.p++;
    switch (t.v) {
      case 'frac': {
        const a = this.arg();
        const b = this.arg();
        return cdiv(a, b);
      }
      case 'sqrt': {
        let index = 2;
        if (this.isSym('[')) {
          this.p++;
          index = this.expr().re;
          this.expectSym(']');
        }
        const a = this.arg();
        return index === 2 ? csqrt(a) : cnthroot(a, index);
      }
      case 'binom': {
        const n = this.arg().re;
        const k = this.arg().re;
        return c(factorial(n) / (factorial(k) * factorial(n - k)));
      }
      case 'pi':
        return c(Math.PI);
      case 'infty':
        return c(Infinity);
      default: {
        if (!(t.v in FUNCS)) throw new Error(`unsupported command \\${t.v}`);
        let name = t.v;
        let post: C | null = null;
        let base: C | null = null;
        if (name === 'log' && this.isSym('_')) {
          // \log_{b} x and \log_b x
          this.p++;
          base = this.arg();
        }
        if (this.isSym('^')) {
          this.p++;
          const e = this.arg();
          if (e.re === -1 && INVERSE[name]) name = INVERSE[name]!;
          else post = e;
        }
        const a = this.isSym('(') || this.isSym('{') ? this.primary() : this.power();
        const v = base ? cdiv(cln(a), cln(base)) : FUNCS[name]!(a);
        return post ? cpow(v, post) : v;
      }
    }
  }
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error(`factorial of ${n}`);
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Evaluate a LaTeX expression. */
export function evaluate(tex: string, opts: EvalOptions = {}): C {
  return new Parser(tokenize(tex), opts).parseAll();
}

/** Evaluate and require a real result. */
export function evalReal(tex: string, opts: EvalOptions = {}): number {
  const v = evaluate(tex, opts);
  if (Math.abs(v.im) > 1e-9 * Math.max(1, Math.abs(v.re))) throw new Error(`non-real value for ${tex}`);
  return v.re;
}

/** Split at top-level (not inside any brackets) occurrences of the given relation tokens. */
export function splitTop(tex: string, rels: readonly string[]): { parts: string[]; rels: string[] } {
  const parts: string[] = [];
  const found: string[] = [];
  let depth = 0;
  let last = 0;
  const sorted = [...rels].sort((a, b) => b.length - a.length);
  for (let i = 0; i < tex.length; i++) {
    const ch = tex[i]!;
    if (ch === '\\' && /^\\(left|right)/.test(tex.slice(i))) continue;
    if ('({['.includes(ch)) depth++;
    else if (')}]'.includes(ch)) depth--;
    if (depth !== 0) continue;
    const rel = sorted.find((r) => tex.startsWith(r, i) && !(r.startsWith('\\') && /[a-zA-Z]/.test(tex[i + r.length] ?? '')));
    if (rel) {
      parts.push(tex.slice(last, i));
      found.push(rel);
      i += rel.length - 1;
      last = i + 1;
    }
  }
  parts.push(tex.slice(last));
  return { parts: parts.map((s) => s.trim()), rels: found };
}

export const RELATIONS = ['\\le', '\\ge', '\\leq', '\\geq', '\\neq', '<', '>', '='] as const;

/** All `$…$` math segments of a rich-text string. */
export function mathSegments(rich: string): string[] {
  const out: string[] = [];
  const re = /(?<!\\)\$([^$]+)\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rich))) out.push(m[1]!);
  return out;
}

/** The single math segment of a rich-text string (throws if there is not exactly one). */
export function onlyMath(rich: string): string {
  const segs = mathSegments(rich);
  if (segs.length !== 1) throw new Error(`expected one math segment in: ${rich}`);
  return segs[0]!;
}

/** Remove `\text{ cm}^{2}`-style units. */
export function stripUnits(tex: string): string {
  return tex.replace(/\\text\{[^}]*\}(\^\{?\d\}?)?/g, '').trim();
}

/** Split a `\left\{ a, b \right\}` set or `(a, b)` tuple into its top-level items. */
export function listItems(tex: string): string[] {
  let s = tex.trim();
  s = s.replace(/^\\left\\\{|^\\\{/, '').replace(/\\right\\\}$|\\\}$/, '');
  s = s.replace(/^\\left\(|^\(/, '').replace(/\\right\)$|\)$/, '');
  s = s.replace(/^\\left\\langle|^\\langle/, '').replace(/\\right\\rangle$|\\rangle$/, '');
  return splitTop(s, [',']).parts;
}

export function close(a: number, b: number, tol = 1e-6): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b;
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
}

export function closeC(a: C, b: C, tol = 1e-6): boolean {
  return cabs(csub(a, b)) <= tol * Math.max(1, cabs(a), cabs(b));
}

export { cabs };
