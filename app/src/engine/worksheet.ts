/**
 * Worksheet document model and the (pure) operations on it.
 *
 * A worksheet is a list of sections; each section is one topic with its own
 * count, difficulty, format and options. Every problem keeps the seed it was
 * generated from, so changing a section's settings re-derives the same slots
 * deterministically, and a saved JSON file reproduces the worksheet exactly.
 */
import type { Diagram } from './diagram';
import { instructionFor, resolveOptions } from './generator';
import { hashSeed, randomSeed, Rng } from './rng';
import { getTopic } from './topics';
import type { Difficulty, OptionValues, ProblemContent, RichText, TopicGenerator } from './types';

export type ProblemFormat = 'free' | 'mc';
export type Spacing = 'none' | 'small' | 'medium' | 'large' | 'xlarge';
export type Columns = 1 | 2 | 3;
export type Paper = 'letter' | 'a4';
export type FontSize = 'small' | 'normal' | 'large';

export interface ProblemInstance {
  uid: string;
  seed: number;
  question: RichText;
  answer: RichText;
  steps?: RichText[];
  /** Multiple-choice options (answer included), already shuffled. */
  choices?: RichText[];
  /** Index of the correct entry in `choices`. */
  correct?: number;
  diagram?: Diagram;
  answerDiagram?: Diagram;
  /** Set once a teacher edits the problem by hand; edited problems survive setting changes. */
  edited?: boolean;
}

export interface Section {
  id: string;
  topicId: string;
  count: number;
  difficulty: Difficulty;
  format: ProblemFormat;
  options: OptionValues;
  instruction: string;
  /** True once the instruction was edited by hand (then it no longer follows the options). */
  customInstruction?: boolean;
  problems: ProblemInstance[];
}

export interface HeaderFields {
  name: boolean;
  date: boolean;
  period: boolean;
  score: boolean;
}

export interface Layout {
  columns: Columns;
  spacing: Spacing;
  paper: Paper;
  fontSize: FontSize;
  /** Print "Page n of N" and the app name in the footer. */
  footer: boolean;
}

export interface Worksheet {
  format: 'openinfinite-worksheet';
  version: 1;
  title: string;
  /** Optional second header line (teacher, class, school…). */
  subtitle: string;
  seed: number;
  header: HeaderFields;
  layout: Layout;
  sections: Section[];
}

export const SPACING_PX: Record<Spacing, number> = { none: 0, small: 48, medium: 110, large: 190, xlarge: 300 };

export const MAX_PROBLEMS_PER_SECTION = 60;

export function uid(): string {
  return randomSeed().toString(36) + randomSeed().toString(36);
}

export function emptyWorksheet(seed = randomSeed()): Worksheet {
  return {
    format: 'openinfinite-worksheet',
    version: 1,
    title: 'Practice Worksheet',
    subtitle: '',
    seed,
    header: { name: true, date: true, period: true, score: false },
    layout: { columns: 2, spacing: 'medium', paper: 'letter', fontSize: 'normal', footer: true },
    sections: [],
  };
}

// ---------------------------------------------------------------- generation

interface SectionSettings {
  topic: TopicGenerator;
  difficulty: Difficulty;
  format: ProblemFormat;
  options: OptionValues;
}

function contentKey(p: ProblemContent): string {
  return `${p.question}\u0000${p.answer}`;
}

function errorProblem(topic: TopicGenerator, seed: number, err: unknown): ProblemContent {
  console.error(`[openinfinite] ${topic.id} failed for seed ${seed}`, err);
  return {
    question: `Could not generate a problem for “${topic.title}”. Try regenerating it.`,
    answer: '—',
  };
}

/** Generate the problem for `seed`, nudging the seed until it differs from every key in `taken`. */
export function generateProblem(
  settings: SectionSettings,
  seed: number,
  taken: Set<string> = new Set(),
  keepUid?: string,
): ProblemInstance {
  const { topic, difficulty, format } = settings;
  const options = resolveOptions(topic.options, settings.options);
  let content: ProblemContent | null = null;
  let used = seed;
  for (let attempt = 0; attempt < 25; attempt++) {
    used = attempt === 0 ? seed : hashSeed(seed, attempt);
    try {
      content = topic.generate({ rng: new Rng(used), difficulty, options });
    } catch (err) {
      content = errorProblem(topic, used, err);
    }
    if (!taken.has(contentKey(content))) break;
  }
  const c = content!;
  taken.add(contentKey(c));
  const p: ProblemInstance = {
    uid: keepUid ?? uid(),
    seed: used,
    question: c.question,
    answer: c.answer,
  };
  if (c.steps?.length) p.steps = c.steps;
  if (c.diagram) p.diagram = c.diagram;
  if (c.answerDiagram) p.answerDiagram = c.answerDiagram;
  if (format === 'mc' && topic.multipleChoice && (c.distractors?.length ?? 0) >= 3) {
    const rng = new Rng(hashSeed(used, 'choices'));
    const choices = rng.shuffle([c.answer, ...c.distractors!.slice(0, 3)]);
    p.choices = choices;
    p.correct = choices.indexOf(c.answer);
  }
  return p;
}

function settingsOf(section: Section): SectionSettings | null {
  const topic = getTopic(section.topicId);
  if (!topic) return null;
  return { topic, difficulty: section.difficulty, format: section.format, options: section.options };
}

function slotSeed(wsSeed: number, section: Section, index: number): number {
  return hashSeed(wsSeed, section.id, section.topicId, index);
}

/**
 * Re-derive every non-edited problem from its seed (after a settings change)
 * and grow/shrink the list to `section.count`.
 */
export function syncSection(section: Section, wsSeed: number): Section {
  const settings = settingsOf(section);
  if (!settings) return section;
  const options = resolveOptions(settings.topic.options, section.options);
  const taken = new Set<string>();
  section.problems.filter((p) => p.edited).forEach((p) => taken.add(`${p.question}\u0000${p.answer}`));
  const kept = section.problems.slice(0, section.count);
  const problems = kept.map((p) => (p.edited ? p : generateProblem({ ...settings, options }, p.seed, taken, p.uid)));
  for (let i = problems.length; i < section.count; i++) {
    problems.push(generateProblem({ ...settings, options }, slotSeed(wsSeed, section, i), taken));
  }
  const instruction = section.customInstruction ? section.instruction : instructionFor(settings.topic, options);
  return { ...section, options, instruction, problems };
}

/** Grow or shrink to `section.count`, keeping the existing problems untouched. */
export function resizeSection(section: Section, wsSeed: number): Section {
  const settings = settingsOf(section);
  if (!settings || section.problems.length === section.count) return section;
  if (section.problems.length > section.count) return { ...section, problems: section.problems.slice(0, section.count) };
  const taken = new Set(section.problems.map((p) => `${p.question}\u0000${p.answer}`));
  const problems = section.problems.slice();
  for (let i = problems.length; problems.length < section.count; i++) {
    problems.push(generateProblem(settings, slotSeed(wsSeed, section, i), taken));
  }
  return { ...section, problems };
}

export function createSection(topic: TopicGenerator, ws: Worksheet, partial: Partial<Section> = {}): Section {
  const options = resolveOptions(topic.options, partial.options);
  const section: Section = {
    id: uid(),
    topicId: topic.id,
    count: topic.defaultCount,
    difficulty: 'medium',
    format: 'free',
    instruction: instructionFor(topic, options),
    ...partial,
    options,
    problems: [],
  };
  return syncSection(section, ws.seed);
}

/** Brand-new problems everywhere (including edited ones) from a new master seed. */
export function regenerateAll(ws: Worksheet, seed = randomSeed()): Worksheet {
  const sections = ws.sections.map((s, i) => {
    const settings = settingsOf(s);
    if (!settings) return s;
    const taken = new Set<string>();
    const problems = Array.from({ length: s.count }, (_, j) =>
      generateProblem(settings, hashSeed(seed, i, s.topicId, j), taken),
    );
    return { ...s, problems };
  });
  return { ...ws, seed, sections };
}

/** New problems for one section; hand-edited problems are kept. */
export function regenerateSection(section: Section): Section {
  const settings = settingsOf(section);
  if (!settings) return section;
  const taken = new Set<string>();
  section.problems.filter((p) => p.edited).forEach((p) => taken.add(`${p.question}\u0000${p.answer}`));
  const problems = section.problems.map((p) => (p.edited ? p : generateProblem(settings, randomSeed(), taken)));
  return { ...section, problems };
}

/** A new problem in the same slot (replaces edits too — it was asked for explicitly). */
export function regenerateOne(section: Section, problemUid: string): Section {
  const settings = settingsOf(section);
  if (!settings) return section;
  const taken = new Set<string>();
  section.problems.forEach((p) => taken.add(`${p.question}\u0000${p.answer}`));
  const problems = section.problems.map((p) =>
    p.uid === problemUid ? generateProblem(settings, randomSeed(), taken, p.uid) : p,
  );
  return { ...section, problems };
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items.slice();
  const out = items.slice();
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it!);
  return out;
}

/** Every problem in display order with its global 1-based number. */
export function numbered(ws: Worksheet): Array<{ section: Section; problem: ProblemInstance; number: number }> {
  const out: Array<{ section: Section; problem: ProblemInstance; number: number }> = [];
  let n = 1;
  for (const section of ws.sections) for (const problem of section.problems) out.push({ section, problem, number: n++ });
  return out;
}

export function choiceLetter(i: number): string {
  return String.fromCharCode(65 + i);
}
