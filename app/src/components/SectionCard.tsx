import { useState } from 'react';
import { DIFFICULTIES, SUBJECTS, type Difficulty } from '../engine/types';
import { MAX_PROBLEMS_PER_SECTION, type Section } from '../engine/worksheet';
import { getTopic } from '../engine/topics';
import { useDispatch, type SectionPatch } from '../state/store';

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

interface Props {
  section: Section;
  index: number;
  total: number;
  firstNumber: number;
}

export function SectionCard({ section, index, total, firstNumber }: Props) {
  const dispatch = useDispatch();
  const topic = getTopic(section.topicId);
  const [open, setOpen] = useState(true);
  if (!topic) return null;
  const subject = SUBJECTS.find((s) => s.id === topic.subject)?.title;
  const update = (patch: SectionPatch) => dispatch({ type: 'updateSection', id: section.id, patch });
  const last = firstNumber + section.problems.length - 1;
  const idBase = `sec-${section.id}`;

  return (
    <article className="section-card" aria-labelledby={`${idBase}-title`}>
      <header className="section-head">
        <button type="button" className="section-toggle" aria-expanded={open} aria-controls={`${idBase}-body`} onClick={() => setOpen((o) => !o)}>
          <span className="section-caret" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="section-titles">
            <span id={`${idBase}-title`} className="section-title">
              {topic.title}
            </span>
            <span className="section-sub">
              {subject} · #{firstNumber}
              {last > firstNumber ? `–${last}` : ''}
            </span>
          </span>
        </button>
        <div className="section-actions">
          <button type="button" className="icon-btn" title="Move section up" aria-label="Move section up" disabled={index === 0} onClick={() => dispatch({ type: 'moveSection', id: section.id, delta: -1 })}>
            ↑
          </button>
          <button type="button" className="icon-btn" title="Move section down" aria-label="Move section down" disabled={index === total - 1} onClick={() => dispatch({ type: 'moveSection', id: section.id, delta: 1 })}>
            ↓
          </button>
          <button type="button" className="icon-btn" title="New problems for this section" aria-label="Regenerate section" onClick={() => dispatch({ type: 'regenerateSection', id: section.id })}>
            ⟳
          </button>
          <button type="button" className="icon-btn icon-danger" title="Remove section" aria-label="Remove section" onClick={() => dispatch({ type: 'removeSection', id: section.id })}>
            ✕
          </button>
        </div>
      </header>
      {open && (
        <div className="section-body" id={`${idBase}-body`}>
          <div className="field-row">
            <label className="field field-count">
              <span>Problems</span>
              <span className="stepper">
                <button type="button" aria-label="Fewer problems" onClick={() => update({ count: section.count - 1 })} disabled={section.count <= 1}>
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={MAX_PROBLEMS_PER_SECTION}
                  value={section.count}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 1) update({ count: v });
                  }}
                />
                <button type="button" aria-label="More problems" onClick={() => update({ count: section.count + 1 })} disabled={section.count >= MAX_PROBLEMS_PER_SECTION}>
                  +
                </button>
              </span>
            </label>
            <div className="field">
              <span id={`${idBase}-diff`}>Difficulty</span>
              <div className="segmented" role="radiogroup" aria-labelledby={`${idBase}-diff`}>
                {DIFFICULTIES.map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={section.difficulty === d} className={section.difficulty === d ? 'on' : ''} onClick={() => update({ difficulty: d })}>
                    {DIFF_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="field">
            <span id={`${idBase}-fmt`}>Format</span>
            <div className="segmented" role="radiogroup" aria-labelledby={`${idBase}-fmt`}>
              <button type="button" role="radio" aria-checked={section.format === 'free'} className={section.format === 'free' ? 'on' : ''} onClick={() => update({ format: 'free' })}>
                Free response
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={section.format === 'mc'}
                className={section.format === 'mc' ? 'on' : ''}
                disabled={!topic.multipleChoice}
                onClick={() => update({ format: 'mc' })}
              >
                Multiple choice
              </button>
            </div>
          </div>
          {topic.options.length > 0 && (
            <div className="options">
              {topic.options.map((o) =>
                o.type === 'boolean' ? (
                  <label key={o.id} className="check" title={o.help}>
                    <input type="checkbox" checked={section.options[o.id] === true} onChange={(e) => update({ options: { [o.id]: e.target.checked } })} />
                    {o.label}
                  </label>
                ) : (
                  <label key={o.id} className="field" title={o.help}>
                    <span>{o.label}</span>
                    <select value={String(section.options[o.id])} onChange={(e) => update({ options: { [o.id]: e.target.value } })}>
                      {o.choices.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
            </div>
          )}
          <label className="field">
            <span>Instructions</span>
            <input type="text" value={section.instruction} onChange={(e) => update({ instruction: e.target.value })} />
          </label>
        </div>
      )}
    </article>
  );
}
