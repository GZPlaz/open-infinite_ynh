/**
 * LaTeX export: a standalone .tex document (amsmath, multicol, TikZ) that
 * mirrors the worksheet, optionally followed by an answer key.
 */
import type { Diagram, DiagramItem, Ink, LabelPos } from '../diagram';
import { getTopic } from '../topics';
import { parseRich } from '../richtext';
import { choiceLetter, SPACING_PX, type ProblemInstance, type Worksheet } from '../worksheet';

export interface LatexOptions {
  /** Include the student worksheet. */
  worksheet: boolean;
  /** Include an answer key (after the worksheet, if both). */
  answerKey: boolean;
  /** Include worked steps in the answer key. */
  steps: boolean;
}

const TEXT_ESCAPES: Record<string, string> = {
  '\\': '\\textbackslash{}',
  '#': '\\#',
  $: '\\$',
  '%': '\\%',
  '&': '\\&',
  _: '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
  '°': '\\ensuremath{^\\circ}',
  π: '\\ensuremath{\\pi}',
  '×': '\\ensuremath{\\times}',
  '−': '-',
  '≈': '\\ensuremath{\\approx}',
};

export function escapeText(s: string): string {
  return s.replace(/[\\#$%&_{}~^°π×−≈]/g, (c) => TEXT_ESCAPES[c] ?? c);
}

/** Rich text (text + $math$) to LaTeX source. */
export function richToLatex(src: string): string {
  return parseRich(src)
    .map((s) => (s.kind === 'text' ? escapeText(s.value) : `$${s.value}$`))
    .join('');
}

// ---------------------------------------------------------------- TikZ

const INK: Record<Ink, string> = {
  ink: 'black',
  grid: 'black!22',
  axis: 'black!70',
  accent: 'red!80!black',
  muted: 'black!55',
};

const POS: Record<LabelPos, string> = {
  c: '',
  n: 'above',
  s: 'below',
  e: 'right',
  w: 'left',
  ne: 'above right',
  nw: 'above left',
  se: 'below right',
  sw: 'below left',
};

const f = (x: number) => (Math.abs(x) < 5e-4 ? '0' : x.toFixed(3).replace(/\.?0+$/, ''));
const pt = (p: readonly [number, number]) => `(${f(p[0])},${f(p[1])})`;

function style(it: { ink?: Ink; dash?: boolean; weight?: number }, extra: string[] = []): string {
  const opts = [...extra];
  if (it.ink && it.ink !== 'ink') opts.push(INK[it.ink]);
  if (it.dash) opts.push('dashed');
  opts.push(`line width=${f((it.weight ?? 1) * 0.6)}pt`);
  return `[${opts.join(', ')}]`;
}

function itemToTikz(it: DiagramItem): string {
  switch (it.t) {
    case 'path':
      return `\\draw${style(it)} ${it.pts.map(pt).join(' -- ')}${it.closed ? ' -- cycle' : ''};`;
    case 'circle':
      return `\\draw${style(it)} ${pt(it.c)} circle (${f(it.r)});`;
    case 'ellipse': {
      if (!it.part || it.part === 'full') return `\\draw${style(it)} ${pt(it.c)} ellipse (${f(it.rx)} and ${f(it.ry)});`;
      const [start, end] = it.part === 'upper' ? [0, 180] : [180, 360];
      const from: [number, number] = [it.c[0] + it.rx * Math.cos((start * Math.PI) / 180), it.c[1]];
      return `\\draw${style(it)} ${pt(from)} arc[start angle=${start}, end angle=${end}, x radius=${f(it.rx)}, y radius=${f(it.ry)}];`;
    }
    case 'arc': {
      const from: [number, number] = [it.c[0] + it.r * Math.cos((it.from * Math.PI) / 180), it.c[1] + it.r * Math.sin((it.from * Math.PI) / 180)];
      return `\\draw${style(it)} ${pt(from)} arc[start angle=${f(it.from)}, end angle=${f(it.to)}, radius=${f(it.r)}];`;
    }
    case 'dot':
      return it.open
        ? `\\filldraw[fill=white, draw=${INK[it.ink ?? 'ink']}] ${pt(it.p)} circle (1.8pt);`
        : `\\fill[${INK[it.ink ?? 'ink']}] ${pt(it.p)} circle (1.8pt);`;
    case 'arrow':
      return `\\draw${style(it, [it.both ? '<->' : '->', '>=stealth'])} ${pt(it.from)} -- ${pt(it.to)};`;
    case 'label': {
      const opts = [POS[it.pos], it.small ? 'font=\\scriptsize' : 'font=\\small', it.ink && it.ink !== 'ink' ? INK[it.ink] : '', 'inner sep=1.5pt'].filter(Boolean);
      return `\\node[${opts.join(', ')}] at ${pt(it.p)} {$${it.tex}$};`;
    }
  }
}

export function diagramToTikz(d: Diagram): string {
  const cm = (d.scale * 2.54) / 96;
  const body = d.items.map(itemToTikz).join('\n  ');
  return `\\begin{tikzpicture}[x=${f(cm)}cm, y=${f(cm)}cm, baseline=(current bounding box.north)]\n  ${body}\n\\end{tikzpicture}`;
}

// ---------------------------------------------------------------- document

function problemLatex(p: ProblemInstance, spacingCm: number): string {
  const parts = [richToLatex(p.question)];
  if (p.diagram) parts.push(`\\par\\smallskip ${diagramToTikz(p.diagram)}`);
  if (p.choices) parts.push(`\\par\\smallskip ${p.choices.map((c, i) => `${choiceLetter(i)})~${richToLatex(c)}`).join('\\quad ')}`);
  if (spacingCm > 0) parts.push(`\\par\\vspace{${f(spacingCm)}cm}`);
  return `\\item \\begin{minipage}[t]{\\linewidth}\n${parts.join('\n')}\n\\end{minipage}`;
}

function answerLatex(p: ProblemInstance, steps: boolean): string {
  let s = p.choices && p.correct !== undefined ? `${choiceLetter(p.correct)})~${richToLatex(p.answer)}` : richToLatex(p.answer);
  if (p.answerDiagram) s += `\\par\\smallskip ${diagramToTikz(p.answerDiagram)}`;
  if (steps && p.steps?.length) s += `\n\\begin{itemize}[leftmargin=1.2em, itemsep=0pt, label={}]\\footnotesize\n${p.steps.map((st) => `  \\item ${richToLatex(st)}`).join('\n')}\n\\end{itemize}`;
  return `\\item ${s}`;
}

export function worksheetToLatex(ws: Worksheet, opts: LatexOptions): string {
  const cols = ws.layout.columns;
  const spacingCm = (SPACING_PX[ws.layout.spacing] * 2.54) / 96;
  const fieldLine = [
    ws.header.name ? 'Name: \\rule{2.6in}{0.4pt}' : '',
    ws.header.date ? 'Date: \\rule{1.1in}{0.4pt}' : '',
    ws.header.period ? 'Period: \\rule{0.5in}{0.4pt}' : '',
  ].filter(Boolean);
  const out: string[] = [];
  out.push('% Generated by OpenInfinite (client-side math worksheet generator)');
  out.push(`\\documentclass[${ws.layout.fontSize === 'large' ? '12pt' : ws.layout.fontSize === 'small' ? '10pt' : '11pt'}]{article}`);
  out.push(`\\usepackage[${ws.layout.paper === 'a4' ? 'a4paper' : 'letterpaper'}, margin=0.6in]{geometry}`);
  out.push('\\usepackage{amsmath, amssymb}');
  out.push('\\usepackage{multicol}');
  out.push('\\usepackage{enumitem}');
  out.push('\\usepackage{tikz}');
  out.push('\\setlength{\\parindent}{0pt}');
  out.push('\\setlength{\\columnsep}{1.5em}');
  out.push(ws.layout.footer ? '\\pagestyle{plain}' : '\\pagestyle{empty}');
  out.push('\\begin{document}');

  const header = (key: boolean) => {
    if (fieldLine.length && !key) out.push(`\\noindent ${fieldLine.join(' \\hfill ')}`);
    out.push('\\begin{center}');
    out.push(`{\\Large\\bfseries ${escapeText(ws.title)}${key ? ' --- Answer Key' : ''}}`);
    if (ws.subtitle) out.push(`\\\\[2pt] ${escapeText(ws.subtitle)}`);
    out.push('\\end{center}');
    if (ws.header.score && !key) out.push('\\hfill Score: \\rule{0.8in}{0.4pt}\\par');
  };

  if (opts.worksheet) {
    header(false);
    let n = 1;
    for (const s of ws.sections) {
      if (!s.problems.length) continue;
      out.push(`\n\\medskip\\textbf{${escapeText(s.instruction || getTopic(s.topicId)?.title || '')}}\\par\\smallskip`);
      if (cols > 1) out.push(`\\begin{multicols}{${cols}}`);
      out.push(`\\begin{enumerate}[label=\\arabic*), start=${n}, leftmargin=*, itemsep=1em]`);
      s.problems.forEach((p) => out.push(problemLatex(p, spacingCm)));
      out.push('\\end{enumerate}');
      if (cols > 1) out.push('\\end{multicols}');
      n += s.problems.length;
    }
  }

  if (opts.answerKey) {
    if (opts.worksheet) out.push('\n\\newpage');
    header(true);
    out.push('\\begin{multicols}{2}');
    out.push('\\begin{enumerate}[label=\\arabic*), leftmargin=*]');
    for (const s of ws.sections) for (const p of s.problems) out.push(answerLatex(p, opts.steps));
    out.push('\\end{enumerate}');
    out.push('\\end{multicols}');
  }
  out.push('\\end{document}');
  return `${out.join('\n')}\n`;
}
