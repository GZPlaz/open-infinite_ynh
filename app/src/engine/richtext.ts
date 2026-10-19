/** Rich text: plain text with inline LaTeX between single `$` (literal dollar: `\$`). */

export type Segment = { kind: 'text'; value: string } | { kind: 'math'; value: string };

export function parseRich(src: string): Segment[] {
  const out: Segment[] = [];
  let buf = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '\\' && src[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }
    if (ch === '$') {
      // find the closing unescaped $
      let j = i + 1;
      while (j < src.length && !(src[j] === '$' && src[j - 1] !== '\\')) j++;
      if (j >= src.length) {
        // unmatched: treat the rest as text
        buf += src.slice(i);
        break;
      }
      if (buf) out.push({ kind: 'text', value: buf });
      buf = '';
      out.push({ kind: 'math', value: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) out.push({ kind: 'text', value: buf });
  return out;
}

/** Plain-text approximation (for file names, alt text, search). */
export function richToPlain(src: string): string {
  return parseRich(src)
    .map((s) => (s.kind === 'text' ? s.value : s.value.replace(/\\[a-zA-Z]+|[{}]/g, ' ').replace(/\s+/g, ' ').trim()))
    .join('');
}
