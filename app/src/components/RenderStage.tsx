/**
 * Renders the worksheet off-screen (PDF) or for the printer only (print),
 * in the requested views, then runs the export once every view has paginated.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { slug } from '../export/download';
import { pagesToPdf } from '../export/pdf';
import { useStore } from '../state/store';
import type { RenderJob } from './ExportDialog';
import { PAPER, WorksheetDocument } from './worksheet/Worksheet';

interface Props {
  job: RenderJob;
  onDone: (message?: string) => void;
}

export function RenderStage({ job, onDone }: Props) {
  const { ws } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState<Record<string, number>>({});
  const [progress, setProgress] = useState<string>('Laying out pages…');
  const started = useRef(false);

  const onPaginated = useCallback((mode: string, n: number) => setReady((r) => (r[mode] === n ? r : { ...r, [mode]: n })), []);

  useEffect(() => {
    if (started.current || job.modes.some((m) => !ready[m])) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      await document.fonts?.ready;
      // two frames so the final layout is painted
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      if (cancelled || !ref.current) return;
      const pages = Array.from(ref.current.querySelectorAll<HTMLElement>('.ws-page'));
      if (job.kind === 'print') {
        document.documentElement.classList.add('printing-stage');
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          document.documentElement.classList.remove('printing-stage');
          window.removeEventListener('afterprint', finish);
          onDone();
        };
        window.addEventListener('afterprint', finish);
        window.print();
        // print() blocks in most browsers; this is a safety net for those that skip afterprint
        setTimeout(finish, 3000);
        return;
      }
      try {
        const suffix = job.modes.length === 2 ? '' : job.modes[0] === 'teacher' ? '-key' : '';
        await pagesToPdf(pages, {
          paper: ws.layout.paper,
          title: ws.title,
          filename: `${slug(ws.title)}${suffix}.pdf`,
          onProgress: ({ page, total }) => setProgress(`Rendering page ${page} of ${total}…`),
        });
        onDone(`Saved ${pages.length}-page PDF.`);
      } catch (e) {
        console.error(e);
        onDone('PDF export failed. Try “Print → Save as PDF” instead.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, job, ws, onDone]);

  const paper = PAPER[ws.layout.paper];
  return (
    <>
      <div ref={ref} className={job.kind === 'print' ? 'print-stage' : 'pdf-stage'} style={{ width: paper.w }} aria-hidden="true">
        {job.modes.map((mode) => (
          <WorksheetDocument
            key={mode}
            ws={ws}
            mode={mode}
            showSteps={job.showSteps}
            output={job.kind === 'pdf' ? 'html' : 'htmlAndMathml'}
            onPaginated={(n) => onPaginated(mode, n)}
          />
        ))}
      </div>
      {job.kind === 'pdf' && (
        <div className="busy-overlay" role="status" aria-live="polite">
          <div className="busy-box">
            <span className="spinner" aria-hidden="true" />
            Creating PDF — {progress}
          </div>
        </div>
      )}
    </>
  );
}
