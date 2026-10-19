/** Saving and loading worksheets as JSON (also the format of the local template library). */
import { getTopic } from '../topics';
import { DIFFICULTIES } from '../types';
import type { Diagram } from '../diagram';
import { emptyWorksheet, MAX_PROBLEMS_PER_SECTION, type ProblemInstance, type Section, type Worksheet } from '../worksheet';

export function worksheetToJson(ws: Worksheet): string {
  return JSON.stringify(ws, null, 2);
}

export class WorksheetFormatError extends Error {}

const strings = (x: unknown): string[] | undefined =>
  Array.isArray(x) && x.every((v) => typeof v === 'string') ? (x as string[]) : undefined;

const ITEM_KINDS = new Set(['path', 'circle', 'ellipse', 'arc', 'dot', 'arrow', 'label']);

function sanitizeDiagram(d: unknown): Diagram | undefined {
  if (!isObj(d) || !isObj(d.box) || !Array.isArray(d.items)) return undefined;
  const nums = [d.box.x0, d.box.y0, d.box.x1, d.box.y1, d.scale];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n)) || (d.scale as number) <= 0) return undefined;
  if (!d.items.every((it) => isObj(it) && ITEM_KINDS.has(it.t as string))) return undefined;
  if (d.items.length > 5000) return undefined;
  return d as unknown as Diagram;
}

function sanitizeProblem(p: Record<string, unknown>): ProblemInstance {
  const out: ProblemInstance = {
    uid: str(p.uid) || Math.random().toString(36).slice(2),
    seed: typeof p.seed === 'number' ? p.seed >>> 0 : 0,
    question: str(p.question),
    answer: str(p.answer),
  };
  const steps = strings(p.steps);
  if (steps) out.steps = steps;
  const choices = strings(p.choices);
  if (choices && typeof p.correct === 'number' && Number.isInteger(p.correct) && p.correct >= 0 && p.correct < choices.length) {
    out.choices = choices;
    out.correct = p.correct;
  }
  const diagram = sanitizeDiagram(p.diagram);
  if (diagram) out.diagram = diagram;
  const answerDiagram = sanitizeDiagram(p.answerDiagram);
  if (answerDiagram) out.answerDiagram = answerDiagram;
  if (p.edited === true) out.edited = true;
  return out;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, fallback = ''): string => (typeof x === 'string' ? x : fallback);

/**
 * Parse and sanitise a worksheet file. Unknown topics are dropped with a
 * warning instead of failing the whole import.
 */
export function worksheetFromJson(text: string): { worksheet: Worksheet; warnings: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new WorksheetFormatError('This file is not valid JSON.');
  }
  if (!isObj(raw) || raw.format !== 'openinfinite-worksheet') throw new WorksheetFormatError('This is not an OpenInfinite worksheet file.');
  if (raw.version !== 1) throw new WorksheetFormatError(`Unsupported worksheet version: ${String(raw.version)}.`);
  const warnings: string[] = [];
  const base = emptyWorksheet(typeof raw.seed === 'number' ? raw.seed >>> 0 : undefined);
  const header = isObj(raw.header) ? raw.header : {};
  const layout = isObj(raw.layout) ? raw.layout : {};
  const ws: Worksheet = {
    ...base,
    title: str(raw.title, base.title).slice(0, 200),
    subtitle: str(raw.subtitle).slice(0, 200),
    header: {
      name: header.name !== false,
      date: header.date !== false,
      period: header.period !== false,
      score: header.score === true,
    },
    layout: {
      columns: layout.columns === 1 || layout.columns === 3 ? layout.columns : 2,
      spacing: (['none', 'small', 'medium', 'large', 'xlarge'] as const).find((s) => s === layout.spacing) ?? 'medium',
      paper: layout.paper === 'a4' ? 'a4' : 'letter',
      fontSize: (['small', 'normal', 'large'] as const).find((s) => s === layout.fontSize) ?? 'normal',
      footer: layout.footer !== false,
    },
    sections: [],
  };
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  for (const s of sections) {
    if (!isObj(s)) continue;
    const topic = getTopic(str(s.topicId));
    if (!topic) {
      warnings.push(`Skipped a section with an unknown topic (“${str(s.topicId, '?')}”).`);
      continue;
    }
    const problems = (Array.isArray(s.problems) ? s.problems : [])
      .filter(isObj)
      .slice(0, MAX_PROBLEMS_PER_SECTION)
      .map((p) => sanitizeProblem(p));
    const section: Section = {
      id: str(s.id) || Math.random().toString(36).slice(2),
      topicId: topic.id,
      count: problems.length,
      difficulty: DIFFICULTIES.find((d) => d === s.difficulty) ?? 'medium',
      format: s.format === 'mc' && topic.multipleChoice ? 'mc' : 'free',
      options: isObj(s.options) ? (s.options as Section['options']) : {},
      instruction: str(s.instruction, topic.title),
      problems,
    };
    if (s.customInstruction === true) section.customInstruction = true;
    ws.sections.push(section);
  }
  return { worksheet: ws, warnings };
}
