import { useMemo, useState } from 'react';
import { topicsFor } from '../engine/topics';
import { DIFFICULTIES, SUBJECTS, type Difficulty } from '../engine/types';
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

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUBJECTS.map((s) => ({
      subject: s,
      topics: topicsFor(s.id).filter((t) => !q || `${t.title} ${t.description} ${s.title}`.toLowerCase().includes(q)),
    })).filter((g) => g.topics.length);
  }, [query]);

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
      <div className="picker-groups">
        {groups.map(({ subject, topics }) => {
          const all = topics.every((t) => picked.includes(t.id));
          return (
            <fieldset key={subject.id} className="picker-group">
              <legend>
                <label className="picker-all">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={() =>
                      setPicked((p) => (all ? p.filter((id) => !topics.some((t) => t.id === id)) : [...new Set([...p, ...topics.map((t) => t.id)])]))
                    }
                  />
                  {subject.title}
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
        {!groups.length && <p className="muted">No topics match “{query}”.</p>}
      </div>
    </Dialog>
  );
}
