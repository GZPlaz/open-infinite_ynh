/**
 * Browser-local persistence (localStorage). Every access is guarded: storage
 * can be disabled, full, or unavailable in private windows.
 */
import { worksheetFromJson, worksheetToJson } from '../engine/export/json';
import type { Worksheet } from '../engine/worksheet';

const CURRENT_KEY = 'openinfinite:v1:current';
const VIEW_KEY = 'openinfinite:v1:view';
const LIBRARY_KEY = 'openinfinite:v1:library';

export interface LibraryEntry {
  id: string;
  name: string;
  savedAt: string;
  problemCount: number;
  /** Serialised worksheet JSON. */
  data: string;
}

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadCurrent(): Worksheet | null {
  const raw = read(CURRENT_KEY);
  if (!raw) return null;
  try {
    return worksheetFromJson(raw).worksheet;
  } catch {
    return null;
  }
}

export function saveCurrent(ws: Worksheet): boolean {
  return write(CURRENT_KEY, worksheetToJson(ws));
}

export function loadView<T extends object>(fallback: T): T {
  const raw = read(VIEW_KEY);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...v };
  } catch {
    return fallback;
  }
}

export function saveView(view: object): void {
  write(VIEW_KEY, JSON.stringify(view));
}

export function listLibrary(): LibraryEntry[] {
  const raw = read(LIBRARY_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list) ? (list.filter((e) => e && typeof e.id === 'string' && typeof e.data === 'string') as LibraryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLibrary(entries: LibraryEntry[]): boolean {
  return write(LIBRARY_KEY, JSON.stringify(entries));
}

export function saveToLibrary(name: string, ws: Worksheet, replaceId?: string): LibraryEntry | null {
  const entries = listLibrary();
  const entry: LibraryEntry = {
    id: replaceId ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || ws.title,
    savedAt: new Date().toISOString(),
    problemCount: ws.sections.reduce((n, s) => n + s.problems.length, 0),
    data: worksheetToJson(ws),
  };
  const next = replaceId ? entries.map((e) => (e.id === replaceId ? entry : e)) : [entry, ...entries];
  return writeLibrary(next) ? entry : null;
}

export function deleteFromLibrary(id: string): void {
  writeLibrary(listLibrary().filter((e) => e.id !== id));
}

export function renameInLibrary(id: string, name: string): void {
  writeLibrary(listLibrary().map((e) => (e.id === id ? { ...e, name } : e)));
}
