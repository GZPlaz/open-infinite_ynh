import { useEffect, useState } from 'react';
import { choiceLetter, type ProblemInstance, type Section } from '../engine/worksheet';
import { useDispatch } from '../state/store';
import { Dialog } from './Dialog';
import { RichText } from './RichText';

interface Props {
  target: { section: Section; problem: ProblemInstance } | null;
  onClose: () => void;
}

interface Draft {
  question: string;
  answer: string;
  steps: string;
  choices: string[];
  correct: number;
  showFigure: boolean;
}

function toDraft(p: ProblemInstance): Draft {
  return {
    question: p.question,
    answer: p.answer,
    steps: (p.steps ?? []).join('\n'),
    choices: p.choices ? [...p.choices] : [],
    correct: p.correct ?? 0,
    showFigure: Boolean(p.diagram),
  };
}

/** Hand-edit a problem. Text uses $…$ for inline LaTeX, rendered live below each field. */
export function ProblemEditor({ target, onClose }: Props) {
  const dispatch = useDispatch();
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => setDraft(target ? toDraft(target.problem) : null), [target]);

  if (!target || !draft) return <Dialog open={false} title="" onClose={onClose}>{null}</Dialog>;
  const { section, problem } = target;
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = () => {
    const patch: Partial<ProblemInstance> = {
      question: draft.question,
      answer: draft.choices.length ? draft.choices[draft.correct] ?? draft.answer : draft.answer,
      steps: draft.steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    if (draft.choices.length) {
      patch.choices = draft.choices;
      patch.correct = draft.correct;
    }
    if (!draft.showFigure) {
      patch.diagram = undefined;
      patch.answerDiagram = undefined;
    }
    dispatch({ type: 'editProblem', sectionId: section.id, uid: problem.uid, patch });
    onClose();
  };

  return (
    <Dialog
      open
      title="Edit problem"
      onClose={onClose}
      wide
      footer={
        <>
          <button
            type="button"
            className="btn btn-quiet"
            title="Discard edits and regenerate this problem from its seed"
            onClick={() => {
              dispatch({ type: 'restoreProblem', sectionId: section.id, uid: problem.uid });
              onClose();
            }}
          >
            Restore generated
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <p className="hint">
        Write math between dollar signs using LaTeX, e.g. <code>Solve $2x + 3 = 11$</code>. A literal dollar sign is <code>\$</code>.
      </p>
      <div className="editor-grid">
        <label className="field">
          <span>Question</span>
          <textarea rows={3} value={draft.question} onChange={(e) => set({ question: e.target.value })} />
        </label>
        <div className="preview-box" aria-live="polite">
          <RichText text={draft.question} />
        </div>
        {draft.choices.length ? (
          <fieldset className="editor-choices">
            <legend>Choices (select the correct one)</legend>
            {draft.choices.map((c, i) => (
              <div key={i} className="editor-choice">
                <label className="check">
                  <input type="radio" name="correct" checked={draft.correct === i} onChange={() => set({ correct: i })} />
                  {choiceLetter(i)})
                </label>
                <input type="text" value={c} onChange={(e) => set({ choices: draft.choices.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Choice ${choiceLetter(i)}`} />
                <span className="preview-inline">
                  <RichText text={c} />
                </span>
              </div>
            ))}
          </fieldset>
        ) : (
          <>
            <label className="field">
              <span>Answer</span>
              <textarea rows={2} value={draft.answer} onChange={(e) => set({ answer: e.target.value })} />
            </label>
            <div className="preview-box answer-preview">
              <RichText text={draft.answer} />
            </div>
          </>
        )}
        <label className="field">
          <span>Worked solution (one step per line)</span>
          <textarea rows={5} value={draft.steps} onChange={(e) => set({ steps: e.target.value })} />
        </label>
        <div className="preview-box steps-preview">
          {draft.steps
            .split('\n')
            .filter((s) => s.trim())
            .map((s, i) => (
              <div key={i}>
                <RichText text={s} />
              </div>
            ))}
        </div>
        {problem.diagram && (
          <label className="check">
            <input type="checkbox" checked={draft.showFigure} onChange={(e) => set({ showFigure: e.target.checked })} />
            Show the figure
          </label>
        )}
      </div>
    </Dialog>
  );
}
