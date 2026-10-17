import { useState } from 'react';
import { worksheetToJson } from '../engine/export/json';
import { worksheetToLatex } from '../engine/export/latex';
import { downloadText, slug } from '../export/download';
import type { ViewMode } from '../state/store';
import { useStore } from '../state/store';
import { Dialog } from './Dialog';

export type ExportFormat = 'pdf' | 'print' | 'latex' | 'json';
export type ExportContent = 'worksheet' | 'key' | 'both';

export interface RenderJob {
  kind: 'pdf' | 'print';
  modes: ViewMode[];
  showSteps: boolean;
}

const MODES: Record<ExportContent, ViewMode[]> = {
  worksheet: ['student'],
  key: ['teacher'],
  both: ['student', 'teacher'],
};

const FORMATS: Array<{ id: ExportFormat; label: string; help: string }> = [
  { id: 'pdf', label: 'PDF', help: 'Rendered in your browser, page for page as previewed.' },
  { id: 'print', label: 'Print', help: 'Uses your browser’s print dialog (or “Save as PDF”).' },
  { id: 'latex', label: 'LaTeX (.tex)', help: 'Standalone document with TikZ figures, for editing in a LaTeX editor.' },
  { id: 'json', label: 'Worksheet file (.json)', help: 'Exact copy of this worksheet. Open it later or on another device.' },
];

export function ExportDialog({ open, onClose, onRender }: { open: boolean; onClose: () => void; onRender: (job: RenderJob) => void }) {
  const { ws, view } = useStore();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [content, setContent] = useState<ExportContent>('both');
  const [steps, setSteps] = useState(view.showSteps);
  const name = slug(ws.title);

  const run = () => {
    if (format === 'json') {
      downloadText(worksheetToJson(ws), `${name}.openinfinite.json`, 'application/json');
    } else if (format === 'latex') {
      const tex = worksheetToLatex(ws, { worksheet: content !== 'key', answerKey: content !== 'worksheet', steps });
      downloadText(tex, `${name}${content === 'key' ? '-key' : ''}.tex`, 'application/x-tex');
    } else {
      onRender({ kind: format, modes: MODES[content], showSteps: steps });
    }
    onClose();
  };

  const action = format === 'pdf' ? 'Download PDF' : format === 'print' ? 'Print…' : format === 'latex' ? 'Download .tex' : 'Download .json';

  return (
    <Dialog
      open={open}
      title="Export & print"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={run}>
            {action}
          </button>
        </>
      }
    >
      <fieldset className="radio-list">
        <legend>Format</legend>
        {FORMATS.map((f) => (
          <label key={f.id} className={`radio-card${format === f.id ? ' is-on' : ''}`}>
            <input type="radio" name="format" checked={format === f.id} onChange={() => setFormat(f.id)} />
            <span>
              <span className="radio-title">{f.label}</span>
              <span className="radio-help">{f.help}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {format !== 'json' && (
        <>
          <fieldset className="radio-inline">
            <legend>Include</legend>
            {(
              [
                ['worksheet', 'Worksheet'],
                ['key', 'Answer key'],
                ['both', 'Both'],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className="check">
                <input type="radio" name="content" checked={content === id} onChange={() => setContent(id)} />
                {label}
              </label>
            ))}
          </fieldset>
          {content !== 'worksheet' && (
            <label className="check">
              <input type="checkbox" checked={steps} onChange={(e) => setSteps(e.target.checked)} />
              Show worked solutions in the answer key
            </label>
          )}
        </>
      )}
    </Dialog>
  );
}
