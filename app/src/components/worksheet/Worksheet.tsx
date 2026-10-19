/**
 * The printable worksheet: real, fixed-size pages.
 *
 * Every block (header, section instructions, rows of problems) is first
 * rendered into an invisible measuring column at the page's content width;
 * the measured heights are then packed into pages. Screen preview, browser
 * printing and PDF export all use these same pages, so page breaks match.
 */
import { createContext, memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { getTopic } from '../../engine/topics';
import { SPACING_PX, choiceLetter, type Layout, type ProblemInstance, type Section, type Worksheet } from '../../engine/worksheet';
import { DiagramSvg } from '../DiagramSvg';
import { RichText, type MathOutput } from '../RichText';

export const PAPER = {
  letter: { w: 816, h: 1056, css: 'letter', label: 'US Letter' },
  a4: { w: 794, h: 1123, css: 'A4', label: 'A4' },
} as const;
export const MARGIN = 48;
export const FOOTER_H = 26;

export interface ProblemActions {
  regenerate(section: Section, p: ProblemInstance): void;
  edit(section: Section, p: ProblemInstance): void;
  remove(section: Section, p: ProblemInstance): void;
  move(section: Section, from: number, to: number): void;
}

interface RenderCtx {
  mode: 'student' | 'teacher';
  showSteps: boolean;
  layout: Layout;
  output: MathOutput;
  actions?: ProblemActions;
  cellWidth: number;
}

const Ctx = createContext<RenderCtx | null>(null);

type Block =
  | { kind: 'header'; key: string }
  | { kind: 'instruction'; key: string; section: Section }
  | { kind: 'row'; key: string; section: Section; items: Array<{ p: ProblemInstance; n: number; index: number }> };

function buildBlocks(ws: Worksheet): Block[] {
  const blocks: Block[] = [{ kind: 'header', key: 'header' }];
  let n = 1;
  for (const section of ws.sections) {
    if (!section.problems.length) continue;
    blocks.push({ kind: 'instruction', key: `i:${section.id}`, section });
    const cols = ws.layout.columns;
    for (let r = 0; r * cols < section.problems.length; r++) {
      const items = section.problems.slice(r * cols, r * cols + cols).map((p, j) => ({ p, n: n + r * cols + j, index: r * cols + j }));
      blocks.push({ kind: 'row', key: `r:${section.id}:${r}`, section, items });
    }
    n += section.problems.length;
  }
  return blocks;
}

/** Greedy packing; an instruction never ends a page (it moves with its first row). */
export function paginate(blocks: ReadonlyArray<{ key: string; kind: string }>, heights: ReadonlyMap<string, number>, available: number): string[][] {
  const pages: string[][] = [[]];
  let used = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const h = heights.get(b.key) ?? 0;
    const next = blocks[i + 1];
    const withNext = h + (next ? heights.get(next.key) ?? 0 : 0);
    const need = b.kind === 'instruction' && next?.kind === 'row' && withNext <= available ? withNext : h;
    if (used + need > available && pages[pages.length - 1]!.length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1]!.push(b.key);
    used += h;
  }
  return pages;
}

// ---------------------------------------------------------------- blocks

function Header({ ws }: { ws: Worksheet }) {
  const { mode } = useContext(Ctx)!;
  const f = ws.header;
  return (
    <header className="ws-header">
      {(f.name || f.date || f.period) && (
        <div className="ws-fields">
          {f.name && (
            <span className="ws-field ws-field-name">
              Name <span className="ws-blank" />
            </span>
          )}
          <span className="ws-fields-right">
            {f.date && (
              <span className="ws-field">
                Date <span className="ws-blank ws-blank-md" />
              </span>
            )}
            {f.period && (
              <span className="ws-field">
                Period <span className="ws-blank ws-blank-sm" />
              </span>
            )}
          </span>
        </div>
      )}
      <div className="ws-title-row">
        <div className="ws-titles">
          <h1 className="ws-title">{ws.title || 'Worksheet'}</h1>
          {ws.subtitle && <div className="ws-subtitle">{ws.subtitle}</div>}
        </div>
        {mode === 'teacher' ? (
          <div className="ws-key-badge">Answer Key</div>
        ) : (
          f.score && (
            <div className="ws-score">
              Score <span className="ws-blank ws-blank-sm" />
            </div>
          )
        )}
      </div>
    </header>
  );
}

function Instruction({ section }: { section: Section }) {
  return <div className="ws-instruction">{section.instruction || getTopic(section.topicId)?.title}</div>;
}

const ProblemCell = memo(function ProblemCell({ section, p, n, index }: { section: Section; p: ProblemInstance; n: number; index: number }) {
  const { mode, showSteps, layout, output, actions, cellWidth } = useContext(Ctx)!;
  const teacher = mode === 'teacher';
  const spacing = SPACING_PX[layout.spacing];
  const diagram = teacher && p.answerDiagram ? p.answerDiagram : p.diagram;
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);

  const dnd = actions
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (dragging?.sectionId !== section.id) return;
          e.preventDefault();
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          setDropSide(e.clientX - r.left < r.width / 2 ? 'before' : 'after');
        },
        onDragLeave: () => setDropSide(null),
        onDrop: (e: React.DragEvent) => {
          setDropSide(null);
          if (!dragging || dragging.sectionId !== section.id) return;
          e.preventDefault();
          const from = dragging.index;
          let to = dropSide === 'after' ? index + 1 : index;
          if (from < to) to -= 1;
          dragging = null;
          if (from !== to) actions.move(section, from, to);
        },
      }
    : {};

  return (
    <div className={`ws-problem${dropSide ? ` ws-drop-${dropSide}` : ''}${p.edited ? ' ws-edited' : ''}`} {...dnd}>
      <div className="ws-num">{n})</div>
      <div className="ws-body">
        <div className="ws-question">
          <RichText text={p.question} output={output} />
        </div>
        {diagram && (
          <div className="ws-figure">
            <DiagramSvg diagram={diagram} maxWidth={cellWidth - 40} />
          </div>
        )}
        {p.choices && (
          <ol className="ws-choices">
            {p.choices.map((c, i) => (
              <li key={i} className={teacher && i === p.correct ? 'ws-choice ws-choice-correct' : 'ws-choice'}>
                <span className="ws-choice-letter">{choiceLetter(i)})</span> <RichText text={c} output={output} />
              </li>
            ))}
          </ol>
        )}
        {teacher ? (
          <div className="ws-key" style={{ minHeight: spacing }}>
            {!p.choices && (
              <div className="ws-answer">
                <RichText text={p.answer} output={output} />
              </div>
            )}
            {showSteps && p.steps && p.steps.length > 0 && (
              <ol className="ws-steps">
                {p.steps.map((s, i) => (
                  <li key={i}>
                    <RichText text={s} output={output} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : (
          spacing > 0 && <div className="ws-work" style={{ height: spacing }} />
        )}
      </div>
      {actions && (
        <div className="ws-tools" role="toolbar" aria-label={`Problem ${n}`}>
          <span
            className="ws-tool ws-drag"
            draggable
            title="Drag to reorder"
            aria-hidden="true"
            onDragStart={(e) => {
              dragging = { sectionId: section.id, index };
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(n));
              const cell = (e.currentTarget as HTMLElement).closest('.ws-problem');
              if (cell) e.dataTransfer.setDragImage(cell, 12, 12);
            }}
            onDragEnd={() => (dragging = null)}
          >
            ⠿
          </span>
          <button type="button" className="ws-tool" title="Move earlier" aria-label={`Move problem ${n} earlier`} disabled={index === 0} onClick={() => actions.move(section, index, index - 1)}>
            ↑
          </button>
          <button type="button" className="ws-tool" title="Move later" aria-label={`Move problem ${n} later`} disabled={index === section.problems.length - 1} onClick={() => actions.move(section, index, index + 1)}>
            ↓
          </button>
          <button type="button" className="ws-tool" title="New problem" aria-label={`Regenerate problem ${n}`} onClick={() => actions.regenerate(section, p)}>
            ⟳
          </button>
          <button type="button" className="ws-tool" title="Edit question and answer" aria-label={`Edit problem ${n}`} onClick={() => actions.edit(section, p)}>
            ✎
          </button>
          <button type="button" className="ws-tool ws-tool-danger" title="Remove" aria-label={`Remove problem ${n}`} disabled={section.problems.length <= 1} onClick={() => actions.remove(section, p)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
});

/** The problem being dragged (module scope: HTML5 drag data is not readable during dragover). */
let dragging: { sectionId: string; index: number } | null = null;

function BlockView({ block, ws }: { block: Block; ws: Worksheet }) {
  if (block.kind === 'header') return <Header ws={ws} />;
  if (block.kind === 'instruction') return <Instruction section={block.section} />;
  return (
    <div className="ws-row" style={{ gridTemplateColumns: `repeat(${ws.layout.columns}, minmax(0, 1fr))` }}>
      {block.items.map(({ p, n, index }) => (
        <ProblemCell key={p.uid} section={block.section} p={p} n={n} index={index} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- document

/** Off-screen host for measuring layers, outside any zoom/transform and hidden in print. */
function measureHost(): HTMLElement {
  let el = document.getElementById('ws-measure-host');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ws-measure-host';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

export interface WorksheetDocumentProps {
  ws: Worksheet;
  mode: 'student' | 'teacher';
  showSteps: boolean;
  output?: MathOutput;
  actions?: ProblemActions;
  /** Called after every (re)pagination with the number of pages. */
  onPaginated?: (pages: number) => void;
  /** Extra class on each page (e.g. for export). */
  pageClassName?: string;
}

export function WorksheetDocument({ ws, mode, showSteps, output = 'htmlAndMathml', actions, onPaginated, pageClassName }: WorksheetDocumentProps) {
  const paper = PAPER[ws.layout.paper];
  const contentW = paper.w - 2 * MARGIN;
  const footer = ws.layout.footer ? FOOTER_H : 0;
  const available = paper.h - 2 * MARGIN - footer;
  const blocks = useMemo(() => buildBlocks(ws), [ws]);
  const byKey = useMemo(() => new Map(blocks.map((b) => [b.key, b])), [blocks]);
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<string[][]>([]);
  const [fontsEpoch, setFontsEpoch] = useState(0);

  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let alive = true;
    const bump = () => alive && setFontsEpoch((e) => e + 1);
    fonts.ready.then(bump);
    fonts.addEventListener?.('loadingdone', bump);
    return () => {
      alive = false;
      fonts.removeEventListener?.('loadingdone', bump);
    };
  }, []);

  useLayoutEffect(() => {
    const el = measureRef.current;
    // The measuring layer is display:none while printing; never paginate from zero heights.
    if (!el || el.getClientRects().length === 0 || window.matchMedia?.('print').matches) return;
    const heights = new Map<string, number>();
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const key = child.dataset.key;
      if (key) heights.set(key, child.getBoundingClientRect().height);
    }
    const next = paginate(blocks, heights, available);
    setPages((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [blocks, available, mode, showSteps, fontsEpoch, contentW, ws.layout.spacing, ws.layout.fontSize, output]);

  useEffect(() => {
    if (pages.length) onPaginated?.(pages.length);
  }, [pages, onPaginated]);

  const cellWidth = (contentW - (ws.layout.columns - 1) * 16) / ws.layout.columns;
  const ctx: RenderCtx = { mode, showSteps, layout: ws.layout, output, actions, cellWidth };
  const docClass = `ws-doc ws-font-${ws.layout.fontSize} ws-mode-${mode}`;

  return (
    <Ctx.Provider value={ctx}>
      {createPortal(
        <div className={`${docClass} ws-measure`} ref={measureRef} style={{ width: contentW }}>
          <Ctx.Provider value={{ ...ctx, actions: undefined }}>
            {blocks.map((b) => (
              <div key={b.key} className="ws-block" data-key={b.key}>
                <BlockView block={b} ws={ws} />
              </div>
            ))}
          </Ctx.Provider>
        </div>,
        measureHost(),
      )}
      {pages.map((keys, i) => (
        <section key={i} className={`ws-page ${pageClassName ?? ''}`} style={{ width: paper.w, height: paper.h }} aria-label={`Page ${i + 1} of ${pages.length}`}>
          <div className={docClass} style={{ padding: MARGIN, paddingBottom: MARGIN }}>
            <div className="ws-page-content" style={{ height: available }}>
              {keys.map((k) => {
                const b = byKey.get(k);
                return b ? (
                  <div key={k} className="ws-block">
                    <BlockView block={b} ws={ws} />
                  </div>
                ) : null;
              })}
            </div>
            {ws.layout.footer && (
              <footer className="ws-footer" style={{ height: FOOTER_H }}>
                <span>{mode === 'teacher' ? `${ws.title} — Answer Key` : ws.title}</span>
                <span>
                  Page {i + 1} of {pages.length}
                </span>
                <span className="ws-footer-brand">Made with OpenInfinite</span>
              </footer>
            )}
          </div>
        </section>
      ))}
    </Ctx.Provider>
  );
}

export function PagesFrame({ children }: { children: ReactNode }) {
  return <div className="ws-pages">{children}</div>;
}
