/**
 * Application state: the worksheet (with undo/redo history) and view settings.
 * All generation happens synchronously in the reducer — it is fast and pure.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { randomSeed } from '../engine/rng';
import { getTopic } from '../engine/topics';
import type { Difficulty, OptionValues } from '../engine/types';
import {
  createSection,
  emptyWorksheet,
  generateProblem,
  MAX_PROBLEMS_PER_SECTION,
  moveItem,
  regenerateAll,
  regenerateOne,
  regenerateSection,
  resizeSection,
  syncSection,
  type HeaderFields,
  type Layout,
  type ProblemFormat,
  type ProblemInstance,
  type Section,
  type Worksheet,
} from '../engine/worksheet';
import { siteConfig } from './siteConfig';
import { loadCurrent, loadView, saveCurrent, saveView } from './storage';

export type ViewMode = 'student' | 'teacher';

export interface ViewSettings {
  mode: ViewMode;
  showSteps: boolean;
}

export interface SectionPatch {
  count?: number;
  difficulty?: Difficulty;
  format?: ProblemFormat;
  options?: OptionValues;
  instruction?: string;
}

export type Action =
  | { type: 'load'; worksheet: Worksheet }
  | { type: 'meta'; title?: string; subtitle?: string }
  | { type: 'header'; patch: Partial<HeaderFields> }
  | { type: 'layout'; patch: Partial<Layout> }
  | { type: 'addSections'; topicIds: string[]; difficulty: Difficulty; format: ProblemFormat; count?: number }
  | { type: 'removeSection'; id: string }
  | { type: 'moveSection'; id: string; delta: number }
  | { type: 'updateSection'; id: string; patch: SectionPatch }
  | { type: 'regenerateSection'; id: string }
  | { type: 'regenerateAll'; seed?: number }
  | { type: 'regenerateProblem'; sectionId: string; uid: string }
  | { type: 'restoreProblem'; sectionId: string; uid: string }
  | { type: 'moveProblem'; sectionId: string; from: number; to: number }
  | { type: 'deleteProblem'; sectionId: string; uid: string }
  | { type: 'editProblem'; sectionId: string; uid: string; patch: Partial<ProblemInstance> }
  | { type: 'view'; patch: Partial<ViewSettings> }
  | { type: 'undo' }
  | { type: 'redo' };

export interface State {
  ws: Worksheet;
  view: ViewSettings;
  past: Worksheet[];
  future: Worksheet[];
}

const HISTORY = 60;

function mapSection(ws: Worksheet, id: string, fn: (s: Section) => Section): Worksheet {
  return { ...ws, sections: ws.sections.map((s) => (s.id === id ? fn(s) : s)) };
}

function clampCount(n: number): number {
  return Math.max(1, Math.min(MAX_PROBLEMS_PER_SECTION, Math.round(n) || 1));
}

/** Pure worksheet transitions. */
export function worksheetReducer(ws: Worksheet, action: Action): Worksheet {
  switch (action.type) {
    case 'load':
      return action.worksheet;
    case 'meta':
      return { ...ws, title: action.title ?? ws.title, subtitle: action.subtitle ?? ws.subtitle };
    case 'header':
      return { ...ws, header: { ...ws.header, ...action.patch } };
    case 'layout':
      return { ...ws, layout: { ...ws.layout, ...action.patch } };
    case 'addSections': {
      const added: Section[] = [];
      for (const id of action.topicIds) {
        const topic = getTopic(id);
        if (!topic) continue;
        added.push(
          createSection(topic, ws, {
            difficulty: action.difficulty,
            format: action.format === 'mc' && topic.multipleChoice ? 'mc' : 'free',
            count: clampCount(action.count ?? topic.defaultCount),
          }),
        );
      }
      return { ...ws, sections: [...ws.sections, ...added] };
    }
    case 'removeSection':
      return { ...ws, sections: ws.sections.filter((s) => s.id !== action.id) };
    case 'moveSection': {
      const i = ws.sections.findIndex((s) => s.id === action.id);
      return { ...ws, sections: moveItem(ws.sections, i, i + action.delta) };
    }
    case 'updateSection':
      return mapSection(ws, action.id, (s) => {
        const p = action.patch;
        const next: Section = {
          ...s,
          count: p.count !== undefined ? clampCount(p.count) : s.count,
          difficulty: p.difficulty ?? s.difficulty,
          format: p.format ?? s.format,
          options: p.options ? { ...s.options, ...p.options } : s.options,
          instruction: p.instruction ?? s.instruction,
          customInstruction: p.instruction !== undefined ? true : s.customInstruction,
        };
        // Only settings that change problem content trigger regeneration of the slots.
        const regenerate = p.difficulty !== undefined || p.format !== undefined || p.options !== undefined;
        if (regenerate) return syncSection(next, ws.seed);
        return p.count !== undefined ? resizeSection(next, ws.seed) : next;
      });
    case 'regenerateSection':
      return mapSection(ws, action.id, regenerateSection);
    case 'regenerateAll':
      return regenerateAll(ws, action.seed ?? randomSeed());
    case 'regenerateProblem':
      return mapSection(ws, action.sectionId, (s) => regenerateOne(s, action.uid));
    case 'restoreProblem':
      return mapSection(ws, action.sectionId, (s) => {
        const topic = getTopic(s.topicId);
        if (!topic) return s;
        return {
          ...s,
          problems: s.problems.map((p) =>
            p.uid === action.uid ? generateProblem({ topic, difficulty: s.difficulty, format: s.format, options: s.options }, p.seed, undefined, p.uid) : p,
          ),
        };
      });
    case 'moveProblem':
      return mapSection(ws, action.sectionId, (s) => ({ ...s, problems: moveItem(s.problems, action.from, action.to) }));
    case 'deleteProblem':
      return mapSection(ws, action.sectionId, (s) => {
        const problems = s.problems.filter((p) => p.uid !== action.uid);
        return problems.length ? { ...s, problems, count: problems.length } : s;
      });
    case 'editProblem':
      return mapSection(ws, action.sectionId, (s) => ({
        ...s,
        problems: s.problems.map((p) => (p.uid === action.uid ? { ...p, ...action.patch, edited: true } : p)),
      }));
    default:
      return ws;
  }
}

/** Consecutive text edits are coalesced into one history entry. */
const COALESCE = new Set<Action['type']>(['meta']);

let lastAction: Action['type'] | null = null;

export function reducer(state: State, action: Action): State {
  if (action.type === 'view') return { ...state, view: { ...state.view, ...action.patch } };
  if (action.type === 'undo') {
    const prev = state.past[state.past.length - 1];
    if (!prev) return state;
    lastAction = null;
    return { ...state, ws: prev, past: state.past.slice(0, -1), future: [state.ws, ...state.future].slice(0, HISTORY) };
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    if (!next) return state;
    lastAction = null;
    return { ...state, ws: next, past: [...state.past, state.ws].slice(-HISTORY), future: state.future.slice(1) };
  }
  const ws = worksheetReducer(state.ws, action);
  if (ws === state.ws) return state;
  const coalesce = COALESCE.has(action.type) && lastAction === action.type;
  lastAction = action.type;
  return {
    ...state,
    ws,
    past: coalesce ? state.past : [...state.past, state.ws].slice(-HISTORY),
    future: [],
  };
}

/** The worksheet shown on first launch: one section for each of the two flagship generators. */
export function starterWorksheet(): Worksheet {
  let ws = emptyWorksheet();
  ws = { ...ws, title: 'Algebra Practice', layout: { ...ws.layout, paper: siteConfig.defaultPaper } };
  return worksheetReducer(
    worksheetReducer(ws, { type: 'addSections', topicIds: ['alg1.linear.multistep'], difficulty: 'medium', format: 'free', count: 8 }),
    { type: 'addSections', topicIds: ['alg2.quadratic.formula'], difficulty: 'medium', format: 'free', count: 6 },
  );
}

const DEFAULT_VIEW: ViewSettings = { mode: 'student', showSteps: true };

function init(): State {
  return {
    ws: loadCurrent() ?? starterWorksheet(),
    view: loadView(DEFAULT_VIEW),
    past: [],
    future: [],
  };
}

const StateCtx = createContext<State | null>(null);
const DispatchCtx = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  // Autosave (debounced) so a refresh never loses work.
  useEffect(() => {
    const t = setTimeout(() => saveCurrent(state.ws), 400);
    return () => clearTimeout(t);
  }, [state.ws]);
  useEffect(() => saveView(state.view), [state.view]);

  return (
    <DispatchCtx.Provider value={dispatch}>
      <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
    </DispatchCtx.Provider>
  );
}

export function useStore(): State {
  const s = useContext(StateCtx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

export function useDispatch(): Dispatch<Action> {
  const d = useContext(DispatchCtx);
  if (!d) throw new Error('useDispatch outside StoreProvider');
  return d;
}

/** Convenience: section + topic by id. */
export function useSection(id: string) {
  const { ws } = useStore();
  return useMemo(() => {
    const section = ws.sections.find((s) => s.id === id);
    return { section, topic: section ? getTopic(section.topicId) : undefined };
  }, [ws, id]);
}
