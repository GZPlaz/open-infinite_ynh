import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ProblemInstance, Section } from './engine/worksheet';
import { ExportDialog, type RenderJob } from './components/ExportDialog';
import { LibraryDialog } from './components/LibraryDialog';
import { ProblemEditor } from './components/ProblemEditor';
import { RenderStage } from './components/RenderStage';
import { Sidebar } from './components/Sidebar';
import { TopicPicker } from './components/TopicPicker';
import { PAPER, WorksheetDocument, type ProblemActions } from './components/worksheet/Worksheet';
import { useDispatch, useStore } from './state/store';

interface Toast {
  id: number;
  text: string;
  undo?: boolean;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, undo = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, undo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), undo ? 7000 : 4500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  return { toasts, push, dismiss };
}

/** Scaled, scrollable page preview. */
function Preview({ actions }: { actions: ProblemActions }) {
  const { ws, view } = useStore();
  const outer = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState(1);
  const paper = PAPER[ws.layout.paper];

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = width ? Math.min(1, (width - 32) / paper.w) : 1;
  const gap = 24;
  return (
    <div className="preview" ref={outer}>
      <div className="preview-scaler" style={{ width: paper.w * scale, height: (pages * (paper.h + gap) - gap) * scale }}>
        <div className="preview-pages" style={{ width: paper.w, transform: `scale(${scale})` }}>
          <WorksheetDocument ws={ws} mode={view.mode} showSteps={view.showSteps} actions={actions} onPaginated={setPages} />
        </div>
      </div>
    </div>
  );
}

export function App() {
  const { ws, view, past, future } = useStore();
  const dispatch = useDispatch();
  const { toasts, push, dismiss } = useToasts();
  const [picker, setPicker] = useState(false);
  const [library, setLibrary] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<{ section: Section; problem: ProblemInstance } | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [tab, setTab] = useState<'build' | 'preview'>('build');

  const actions = useMemo<ProblemActions>(
    () => ({
      regenerate: (s, p) => dispatch({ type: 'regenerateProblem', sectionId: s.id, uid: p.uid }),
      edit: (section, problem) => setEditing({ section, problem }),
      remove: (s, p) => dispatch({ type: 'deleteProblem', sectionId: s.id, uid: p.uid }),
      move: (s, from, to) => dispatch({ type: 'moveProblem', sectionId: s.id, from, to }),
    }),
    [dispatch],
  );

  const regenerateAll = () => {
    const edited = ws.sections.some((s) => s.problems.some((p) => p.edited));
    dispatch({ type: 'regenerateAll' });
    push(edited ? 'New problems everywhere, including your edited ones.' : 'Generated a new version of every problem.', true);
  };

  // Undo / redo shortcuts (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  // Match the printed page size to the chosen paper.
  useEffect(() => {
    let el = document.getElementById('page-size-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'page-size-style';
      document.head.appendChild(el);
    }
    el.textContent = `@page { size: ${PAPER[ws.layout.paper].css} portrait; margin: 0; }`;
  }, [ws.layout.paper]);

  const finishJob = useCallback(
    (msg?: string) => {
      setJob(null);
      if (msg) push(msg);
    },
    [push],
  );

  const teacher = view.mode === 'teacher';
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="favicon.svg" alt="" width={28} height={28} />
          <span>
            Open<b>Infinite</b>
          </span>
        </div>
        <div className="topbar-group" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={!teacher} className={`toggle${!teacher ? ' on' : ''}`} onClick={() => dispatch({ type: 'view', patch: { mode: 'student' } })}>
            Student
          </button>
          <button type="button" role="radio" aria-checked={teacher} className={`toggle${teacher ? ' on' : ''}`} onClick={() => dispatch({ type: 'view', patch: { mode: 'teacher' } })}>
            Answer key
          </button>
        </div>
        <label className={`check topbar-check${teacher ? '' : ' is-disabled'}`}>
          <input type="checkbox" checked={view.showSteps} disabled={!teacher} onChange={(e) => dispatch({ type: 'view', patch: { showSteps: e.target.checked } })} />
          Worked solutions
        </label>
        <span className="spacer" />
        <div className="topbar-group">
          <button type="button" className="btn" onClick={regenerateAll} title="Replace every problem with a new one (new seed)">
            ⟳ Regenerate all
          </button>
          <button type="button" className="icon-btn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!past.length} onClick={() => dispatch({ type: 'undo' })}>
            ↶
          </button>
          <button type="button" className="icon-btn" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!future.length} onClick={() => dispatch({ type: 'redo' })}>
            ↷
          </button>
        </div>
        <div className="topbar-group">
          <button type="button" className="btn" onClick={() => setLibrary(true)}>
            My worksheets
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setExporting(true)} disabled={job !== null}>
            Export &amp; print
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="Sections">
        <button type="button" className={tab === 'build' ? 'on' : ''} onClick={() => setTab('build')}>
          Build
        </button>
        <button type="button" className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>
          Preview
        </button>
      </nav>

      <main className={`workspace tab-${tab}`}>
        <aside className="sidebar" aria-label="Worksheet settings">
          <Sidebar onAddTopics={() => setPicker(true)} />
        </aside>
        <Preview actions={actions} />
      </main>

      <TopicPicker open={picker} onClose={() => setPicker(false)} />
      <LibraryDialog open={library} onClose={() => setLibrary(false)} notify={push} />
      <ExportDialog open={exporting} onClose={() => setExporting(false)} onRender={setJob} />
      <ProblemEditor target={editing} onClose={() => setEditing(null)} />
      {job && <RenderStage job={job} onDone={finishJob} />}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span>{t.text}</span>
            {t.undo && (
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  dispatch({ type: 'undo' });
                  dismiss(t.id);
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
