import { useMemo, useState } from 'react';
import { categoriesFor, topicsFor } from '../engine/topics';
import { DIFFICULTIES, SUBJECTS, type Difficulty, type SubjectId } from '../engine/types';
import type { ProblemFormat } from '../engine/worksheet';
import { useDispatch } from '../state/store';
import { Dialog } from './Dialog';

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export function TopicPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [format, setFormat] = useState<ProblemFormat>('free');

  const [subjectId, setSubjectId] = useState<SubjectId>(SUBJECTS[0]!.id);

  /** Searching spans every subject; otherwise the active subject tab is shown. */
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    return SUBJECTS.filter((s) => q || s.id === subjectId)
      .map((s) => ({
        subject: s,
        categories: categoriesFor(s.id)
          .map(({ category, topics }) => ({
            category,
            topics: topics.filter((t) => {
              const hay = `${t.title} ${t.description} ${category} ${s.title}`.toLowerCase();
              return words.every((w) => hay.includes(w));
            }),
          }))
          .filter((c) => c.topics.length),
      }))
      .filter((g) => g.categories.length);
  }, [query, subjectId]);

  const pickedIn = (id: SubjectId) => topicsFor(id).filter((t) => picked.includes(t.id)).length;
  const setAll = (ids: string[], on: boolean) => setPicked((p) => (on ? [...new Set([...p, ...ids])] : p.filter((id) => !ids.includes(id))));

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const close = () => {
    setPicked([]);
    setQuery('');
    onClose();
  };
  const add = () => {
    if (!picked.length) return;
    dispatch({ type: 'addSections', topicIds: picked, difficulty, format });
    close();
  };

  return (
    <Dialog
      open={open}
      title="Add topics"
      onClose={close}
      wide
      footer={
        <>
          <div className="picker-defaults">
            <label>
              Difficulty{' '}
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {DIFF_LABEL[d]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Format{' '}
              <select value={format} onChange={(e) => setFormat(e.target.value as ProblemFormat)}>
                <option value="free">Free response</option>
                <option value="mc">Multiple choice</option>
              </select>
            </label>
          </div>
          <button type="button" className="btn" onClick={close}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!picked.length} onClick={add}>
            Add {picked.length || ''} {picked.length === 1 ? 'topic' : 'topics'}
          </button>
        </>
      }
    >
      <input
        type="search"
        className="picker-search"
        placeholder="Search topics (e.g. factoring, volume, derivatives)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search topics"
        autoFocus
      />
      {!query.trim() && (
        <div className="picker-tabs" role="tablist" aria-label="Subjects">
          {SUBJECTS.map((s) => {
            const n = pickedIn(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === subjectId}
                className={`picker-tab${s.id === subjectId ? ' is-active' : ''}`}
                onClick={() => setSubjectId(s.id)}
              >
                {s.title}
                <span className="picker-count">{n ? `${n}/` : ''}{topicsFor(s.id).length}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="picker-groups">
        {groups.map(({ subject, categories }) => {
          const ids = categories.flatMap((c) => c.topics.map((t) => t.id));
          const all = ids.every((id) => picked.includes(id));
          return (
            <section key={subject.id} className="picker-subject" aria-label={subject.title}>
              <label className="picker-all picker-subject-all">
                <input type="checkbox" checked={all} onChange={() => setAll(ids, !all)} />
                {query.trim() ? subject.title : `All ${subject.title} topics`}
              </label>
              <div className="picker-categories">
                {categories.map(({ category, topics }) => {
                  const catIds = topics.map((t) => t.id);
                  const catAll = catIds.every((id) => picked.includes(id));
                  return (
                    <fieldset key={category} className="picker-group">
                      <legend>
                        <label className="picker-all">
                          <input type="checkbox" checked={catAll} onChange={() => setAll(catIds, !catAll)} />
                          {category || 'Other'}
                        </label>
                      </legend>
                      {topics.map((t) => (
                        <label key={t.id} className={`picker-topic${picked.includes(t.id) ? ' is-picked' : ''}`}>
                          <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
                          <span>
                            <span className="picker-title">{t.title}</span>
                            <span className="picker-desc">{t.description}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!groups.length && <p className="muted">No topics match “{query}”.</p>}
      </div>
    </Dialog>
  );
}
