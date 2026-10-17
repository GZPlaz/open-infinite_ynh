import { useEffect, useRef, useState } from 'react';
import { worksheetFromJson, WorksheetFormatError } from '../engine/export/json';
import { emptyWorksheet } from '../engine/worksheet';
import { siteConfig } from '../state/siteConfig';
import { deleteFromLibrary, listLibrary, saveToLibrary, type LibraryEntry } from '../state/storage';
import { useDispatch, useStore } from '../state/store';
import { Dialog } from './Dialog';

/** Saved worksheets and templates, kept in this browser (localStorage). */
export function LibraryDialog({ open, onClose, notify }: { open: boolean; onClose: () => void; notify: (msg: string) => void }) {
  const { ws } = useStore();
  const dispatch = useDispatch();
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEntries(listLibrary());
      setName(ws.title);
    }
  }, [open, ws.title]);

  const load = (data: string, label: string) => {
    try {
      const { worksheet, warnings } = worksheetFromJson(data);
      dispatch({ type: 'load', worksheet });
      notify(warnings.length ? `Opened “${label}”. ${warnings.join(' ')}` : `Opened “${label}”.`);
      onClose();
    } catch (e) {
      notify(e instanceof WorksheetFormatError ? e.message : 'Could not open this worksheet.');
    }
  };

  const save = () => {
    const existing = entries.find((e) => e.name === name.trim());
    const entry = saveToLibrary(name, ws, existing?.id);
    if (!entry) notify('Could not save: browser storage is full or disabled.');
    else {
      setEntries(listLibrary());
      notify(`Saved “${entry.name}” in this browser.`);
    }
  };

  return (
    <Dialog open={open} title="My worksheets" onClose={onClose} wide>
      <div className="library-save">
        <label className="field grow">
          <span>Save the current worksheet as</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <button type="button" className="btn btn-primary" onClick={save}>
          {entries.some((e) => e.name === name.trim()) ? 'Replace' : 'Save'}
        </button>
      </div>
      <p className="hint">Saved worksheets stay in this browser only. Use “Export → Worksheet file (.json)” to move them between devices.</p>
      {entries.length ? (
        <ul className="library-list">
          {entries.map((e) => (
            <li key={e.id}>
              <div className="library-meta">
                <span className="library-name">{e.name}</span>
                <span className="muted">
                  {e.problemCount} problems · {new Date(e.savedAt).toLocaleString()}
                </span>
              </div>
              <button type="button" className="btn" onClick={() => load(e.data, e.name)}>
                Open
              </button>
              <button
                type="button"
                className="icon-btn icon-danger"
                aria-label={`Delete ${e.name}`}
                onClick={() => {
                  deleteFromLibrary(e.id);
                  setEntries(listLibrary());
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nothing saved yet.</p>
      )}
      <div className="library-import">
        <button
          type="button"
          className="btn"
          onClick={() => {
            const fresh = emptyWorksheet();
            dispatch({ type: 'load', worksheet: { ...fresh, layout: { ...fresh.layout, paper: siteConfig.defaultPaper } } });
            notify('Started a new blank worksheet. Undo brings the previous one back.');
            onClose();
          }}
        >
          New blank worksheet
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Open a worksheet file (.json)…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) load(await f.text(), f.name);
          }}
        />
      </div>
    </Dialog>
  );
}
