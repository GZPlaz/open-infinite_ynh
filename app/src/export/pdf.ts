/**
 * Client-side PDF: each rendered page is rasterised with html2canvas and
 * placed full-bleed on a jsPDF page. Both libraries are loaded on demand so
 * they cost nothing until someone exports.
 */
import type { Paper } from '../engine/worksheet';
import { downloadBlob } from './download';

export interface PdfProgress {
  page: number;
  total: number;
}

export async function pagesToPdf(
  pages: HTMLElement[],
  opts: { paper: Paper; title: string; filename: string; onProgress?: (p: PdfProgress) => void },
): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  await document.fonts?.ready;
  const pdf = new jsPDF({ unit: 'pt', format: opts.paper === 'a4' ? 'a4' : 'letter', orientation: 'portrait', compress: true });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  for (let i = 0; i < pages.length; i++) {
    opts.onProgress?.({ page: i + 1, total: pages.length });
    // let the progress message paint before the (synchronous-heavy) rasterisation
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const el = pages[i]!;
    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      width: el.offsetWidth,
      height: el.offsetHeight,
      windowWidth: Math.max(document.documentElement.clientWidth, el.offsetWidth + 40),
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas, 'PNG', 0, 0, W, H, undefined, 'FAST');
  }
  pdf.setProperties({ title: opts.title, creator: 'OpenInfinite' });
  downloadBlob(pdf.output('blob'), opts.filename);
}
