import { useState, type ReactNode } from 'react';
import type { Columns, FontSize, Paper, Spacing } from '../engine/worksheet';
import { useDispatch, useStore } from '../state/store';
import { SectionCard } from './SectionCard';
import { PAPER } from './worksheet/Worksheet';

function Panel({ title, children, defaultOpen = true, extra }: { title: string; children: ReactNode; defaultOpen?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="panel">
      <h2 className="panel-head">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">{open ? '▾' : '▸'}</span> {title}
        </button>
        {extra}
      </h2>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
}

function Segmented<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button key={String(v)} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Seed input that applies on Enter / blur (not on every keystroke). */
function SeedField() {
  const { ws } = useStore();
  const dispatch = useDispatch();
  const [draft, setDraft] = useState<string | null>(null);
  const apply = () => {
    if (draft === null) return;
    const v = Number(draft);
    if (Number.isInteger(v) && v >= 0 && v <= 4294967295 && v !== ws.seed) dispatch({ type: 'regenerateAll', seed: v });
    setDraft(null);
  };
  return (
    <div className="field-row field-row-end">
      <label className="field grow">
        <span>Worksheet seed</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft ?? String(ws.seed)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
          onBlur={apply}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
        />
      </label>
      <button type="button" className="btn" onClick={() => dispatch({ type: 'regenerateAll' })}>
        New version
      </button>
    </div>
  );
}

const SPACING: Array<[Spacing, string]> = [
  ['none', 'None'],
  ['small', 'S'],
  ['medium', 'M'],
  ['large', 'L'],
  ['xlarge', 'XL'],
];

export function Sidebar({ onAddTopics }: { onAddTopics: () => void }) {
  const { ws } = useStore();
  const dispatch = useDispatch();
  const total = ws.sections.reduce((n, s) => n + s.problems.length, 0);
  let first = 1;

  return (
    <div className="sidebar-inner">
      <Panel title="Worksheet">
        <label className="field">
          <span>Title</span>
          <input type="text" value={ws.title} maxLength={200} onChange={(e) => dispatch({ type: 'meta', title: e.target.value })} />
        </label>
        <label className="field">
          <span>Subtitle (optional)</span>
          <input type="text" value={ws.subtitle} maxLength={200} placeholder="Teacher, class, unit…" onChange={(e) => dispatch({ type: 'meta', subtitle: e.target.value })} />
        </label>
        <div className="field">
          <span>Header fields</span>
          <div className="check-row">
            {(
              [
                ['name', 'Name'],
                ['date', 'Date'],
                ['period', 'Period'],
                ['score', 'Score'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className="check">
                <input type="checkbox" checked={ws.header[k]} onChange={(e) => dispatch({ type: 'header', patch: { [k]: e.target.checked } })} />
                {label}
              </label>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Layout">
        <Segmented<Columns>
          label="Columns"
          value={ws.layout.columns}
          options={[
            [1, '1'],
            [2, '2'],
            [3, '3'],
          ]}
          onChange={(columns) => dispatch({ type: 'layout', patch: { columns } })}
        />
        <Segmented<Spacing> label="Work space under each problem" value={ws.layout.spacing} options={SPACING} onChange={(spacing) => dispatch({ type: 'layout', patch: { spacing } })} />
        <div className="field-row">
          <Segmented<Paper>
            label="Paper"
            value={ws.layout.paper}
            options={[
              ['letter', PAPER.letter.label],
              ['a4', PAPER.a4.label],
            ]}
            onChange={(paper) => dispatch({ type: 'layout', patch: { paper } })}
          />
          <Segmented<FontSize>
            label="Text size"
            value={ws.layout.fontSize}
            options={[
              ['small', 'S'],
              ['normal', 'M'],
              ['large', 'L'],
            ]}
            onChange={(fontSize) => dispatch({ type: 'layout', patch: { fontSize } })}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={ws.layout.footer} onChange={(e) => dispatch({ type: 'layout', patch: { footer: e.target.checked } })} />
          Page numbers in the footer
        </label>
      </Panel>

      <Panel title={`Topics · ${total} problem${total === 1 ? '' : 's'}`}>
        <div className="sections">
          {ws.sections.map((s, i) => {
            const card = <SectionCard key={s.id} section={s} index={i} total={ws.sections.length} firstNumber={first} />;
            first += s.problems.length;
            return card;
          })}
          {!ws.sections.length && <p className="muted">No topics yet. Add one to start building your worksheet.</p>}
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={onAddTopics}>
          + Add topics
        </button>
      </Panel>

      <Panel title="Versions" defaultOpen={false}>
        <p className="hint">Every problem comes from a seed. Enter the same seed to rebuild the same worksheet, or a new one for a different version.</p>
        <SeedField />
      </Panel>
    </div>
  );
}
