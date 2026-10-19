import { describe, expect, it } from 'vitest';
import { worksheetFromJson, worksheetToJson, WorksheetFormatError } from '../src/engine/export/json';
import { richToLatex, worksheetToLatex } from '../src/engine/export/latex';
import { parseRich } from '../src/engine/richtext';
import { TOPICS } from '../src/engine/topics';
import { emptyWorksheet, moveItem, regenerateAll } from '../src/engine/worksheet';
import { paginate } from '../src/components/worksheet/Worksheet';
import { reducer, starterWorksheet, worksheetReducer, type State } from '../src/state/store';

function fullWorksheet() {
  let ws = emptyWorksheet(12345);
  ws = worksheetReducer(ws, { type: 'addSections', topicIds: TOPICS.map((t) => t.id), difficulty: 'medium', format: 'free', count: 4 });
  return ws;
}

describe('worksheet model', () => {
  it('is deterministic for a given master seed', () => {
    const a = regenerateAll(fullWorksheet(), 99);
    const b = regenerateAll(fullWorksheet(), 99);
    const strip = (w: typeof a) => w.sections.map((s) => s.problems.map((p) => [p.question, p.answer, p.seed]));
    expect(strip(a)).toEqual(strip(b));
    expect(strip(regenerateAll(a, 100))).not.toEqual(strip(a));
  });

  it('avoids duplicate problems within a section', () => {
    let ws = emptyWorksheet(7);
    ws = worksheetReducer(ws, { type: 'addSections', topicIds: ['alg1.factoring'], difficulty: 'easy', format: 'free', count: 40 });
    const qs = ws.sections[0]!.problems.map((p) => p.question);
    expect(new Set(qs).size).toBe(qs.length);
  });

  it('resizes without touching existing problems', () => {
    const ws = starterWorksheet();
    const s = ws.sections[0]!;
    const grown = worksheetReducer(ws, { type: 'updateSection', id: s.id, patch: { count: s.count + 3 } });
    expect(grown.sections[0]!.problems.slice(0, s.count)).toEqual(s.problems);
    expect(grown.sections[0]!.problems).toHaveLength(s.count + 3);
    const shrunk = worksheetReducer(grown, { type: 'updateSection', id: s.id, patch: { count: 2 } });
    expect(shrunk.sections[0]!.problems).toEqual(s.problems.slice(0, 2));
  });

  it('keeps hand-edited problems when settings change', () => {
    const ws = starterWorksheet();
    const s = ws.sections[0]!;
    const p = s.problems[1]!;
    const edited = worksheetReducer(ws, { type: 'editProblem', sectionId: s.id, uid: p.uid, patch: { question: 'Mine' } });
    const harder = worksheetReducer(edited, { type: 'updateSection', id: s.id, patch: { difficulty: 'hard' } });
    expect(harder.sections[0]!.problems[1]!.question).toBe('Mine');
    expect(harder.sections[0]!.problems[0]!.question).not.toBe(s.problems[0]!.question);
  });

  it('switches to multiple choice with the correct answer among the choices', () => {
    const ws = starterWorksheet();
    const s = ws.sections[0]!;
    const mc = worksheetReducer(ws, { type: 'updateSection', id: s.id, patch: { format: 'mc' } });
    for (const p of mc.sections[0]!.problems) {
      expect(p.choices).toHaveLength(4);
      expect(p.choices![p.correct!]).toBe(p.answer);
    }
  });

  it('reorders problems', () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(moveItem([1, 2], 0, 5)).toEqual([1, 2]);
  });

  it('supports undo and redo', () => {
    const init: State = { ws: starterWorksheet(), view: { mode: 'student', showSteps: true }, past: [], future: [] };
    const s1 = reducer(init, { type: 'regenerateAll', seed: 5 });
    expect(s1.ws).not.toBe(init.ws);
    const s2 = reducer(s1, { type: 'undo' });
    expect(s2.ws).toBe(init.ws);
    const s3 = reducer(s2, { type: 'redo' });
    expect(s3.ws).toBe(s1.ws);
  });
});

describe('pagination', () => {
  const blocks = [
    { key: 'header', kind: 'header' },
    { key: 'i1', kind: 'instruction' },
    { key: 'r1', kind: 'row' },
    { key: 'r2', kind: 'row' },
    { key: 'i2', kind: 'instruction' },
    { key: 'r3', kind: 'row' },
  ];
  it('packs greedily and keeps instructions with their first row', () => {
    const h = new Map(Object.entries({ header: 100, i1: 30, r1: 300, r2: 300, i2: 30, r3: 300 }));
    expect(paginate(blocks, h, 800)).toEqual([['header', 'i1', 'r1', 'r2'], ['i2', 'r3']]);
  });
  it('puts an oversized block on its own page instead of looping', () => {
    const h = new Map(Object.entries({ header: 100, i1: 30, r1: 2000, r2: 10, i2: 10, r3: 10 }));
    expect(paginate(blocks, h, 800)).toEqual([['header', 'i1'], ['r1'], ['r2', 'i2', 'r3']]);
  });
});

describe('JSON files', () => {
  it('round-trips a worksheet exactly', () => {
    const ws = fullWorksheet();
    const { worksheet, warnings } = worksheetFromJson(worksheetToJson(ws));
    expect(warnings).toEqual([]);
    expect(worksheet).toEqual(JSON.parse(worksheetToJson(ws)));
  });

  it('rejects foreign files and drops unknown topics', () => {
    expect(() => worksheetFromJson('{"hello": 1}')).toThrow(WorksheetFormatError);
    expect(() => worksheetFromJson('not json')).toThrow(WorksheetFormatError);
    const ws = starterWorksheet();
    const raw = JSON.parse(worksheetToJson(ws));
    raw.sections[0].topicId = 'nope';
    raw.sections[1].problems[0].diagram = { box: 'bad', items: 3 };
    const { worksheet, warnings } = worksheetFromJson(JSON.stringify(raw));
    expect(worksheet.sections).toHaveLength(1);
    expect(warnings[0]).toMatch(/unknown topic/);
    expect(worksheet.sections[0]!.problems[0]!.diagram).toBeUndefined();
  });
});

describe('rich text and LaTeX', () => {
  it('parses math segments and escaped dollars', () => {
    expect(parseRich('Cost \\$5: $x + 1$.')).toEqual([
      { kind: 'text', value: 'Cost $5: ' },
      { kind: 'math', value: 'x + 1' },
      { kind: 'text', value: '.' },
    ]);
  });

  it('escapes text but not math', () => {
    expect(richToLatex('50% of $x_1$ & co, rotate 90°')).toBe('50\\% of $x_1$ \\& co, rotate 90\\ensuremath{^\\circ}');
  });

  it('produces a complete document', () => {
    const tex = worksheetToLatex(fullWorksheet(), { worksheet: true, answerKey: true, steps: true });
    expect(tex).toMatch(/^% Generated by OpenInfinite/);
    expect(tex).toContain('\\begin{document}');
    expect(tex.trim().endsWith('\\end{document}')).toBe(true);
    expect(tex).toContain('\\begin{tikzpicture}');
    expect(tex).toContain('Answer Key');
  });
});
