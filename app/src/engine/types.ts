/**
 * Core contracts of the OpenInfinite problem engine.
 *
 * A *topic generator* is a pure function of (seeded RNG, difficulty, options)
 * that returns one problem: question, final answer, worked steps, distractors
 * for multiple choice, and optional figures. Everything runs in the browser.
 */
import type { Diagram } from './diagram';
import type { Rng } from './rng';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/**
 * Text with inline LaTeX between single dollar signs, e.g. `Solve $2x + 3 = 7$.`
 * A literal dollar sign is written `\$`.
 */
export type RichText = string;

export type SubjectId = 'prealgebra' | 'algebra1' | 'algebra2' | 'geometry' | 'trigonometry' | 'precalculus' | 'calculus';

export interface Subject {
  id: SubjectId;
  title: string;
}

export const SUBJECTS: readonly Subject[] = [
  { id: 'prealgebra', title: 'Pre-Algebra' },
  { id: 'algebra1', title: 'Algebra 1' },
  { id: 'algebra2', title: 'Algebra 2' },
  { id: 'geometry', title: 'Geometry' },
  { id: 'trigonometry', title: 'Trigonometry' },
  { id: 'precalculus', title: 'Precalculus' },
  { id: 'calculus', title: 'Calculus' },
];

export interface BooleanOptionDef {
  type: 'boolean';
  id: string;
  label: string;
  default: boolean;
  help?: string;
}

export interface SelectOptionDef {
  type: 'select';
  id: string;
  label: string;
  default: string;
  choices: ReadonlyArray<{ value: string; label: string }>;
  help?: string;
}

export type OptionDef = BooleanOptionDef | SelectOptionDef;
export type OptionValue = boolean | string;
export type OptionValues = Record<string, OptionValue>;

export interface ProblemContent {
  question: RichText;
  answer: RichText;
  /** Worked solution, one line per step. */
  steps?: RichText[];
  /** Plausible wrong answers (common mistakes) used to build multiple-choice options. */
  distractors?: RichText[];
  /** Figure shown with the question. */
  diagram?: Diagram;
  /** Figure that replaces `diagram` in the answer key (e.g. a graphed solution). */
  answerDiagram?: Diagram;
  /** Machine-checkable facts used by the test-suite; never rendered or saved. */
  check?: Record<string, unknown>;
}

export interface GeneratorContext {
  rng: Rng;
  difficulty: Difficulty;
  /** Topic options with defaults already filled in. */
  options: OptionValues;
}

export interface TopicGenerator {
  /** Stable id, saved in worksheet files — never rename. */
  id: string;
  subject: SubjectId;
  title: string;
  description: string;
  /** Grouping inside the subject in the topic picker, e.g. "Conic Sections". */
  category?: string;
  /** Section heading printed above the problems. */
  instruction: string | ((options: OptionValues) => string);
  options: readonly OptionDef[];
  /** True when `generate` always returns at least three distractors. */
  multipleChoice: boolean;
  defaultCount: number;
  generate(ctx: GeneratorContext): ProblemContent;
}
