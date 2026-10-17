/**
 * Optional server-provided defaults (config.json next to index.html).
 * The YunoHost package writes it from the app settings; static hosting
 * without it simply uses the built-in defaults.
 */
import type { Paper } from '../engine/worksheet';

export interface SiteConfig {
  defaultPaper: Paper;
}

export const siteConfig: SiteConfig = { defaultPaper: 'letter' };

export async function loadSiteConfig(timeoutMs = 1500): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(new URL('config.json', document.baseURI), { cache: 'no-cache', signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const data = (await res.json()) as Partial<Record<keyof SiteConfig, unknown>>;
    if (data.defaultPaper === 'a4' || data.defaultPaper === 'letter') siteConfig.defaultPaper = data.defaultPaper;
  } catch {
    // offline, missing or malformed: keep defaults
  }
}
