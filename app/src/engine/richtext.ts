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

/**
 * Block structure of rich text: runs of lines written `| cell | cell |` form a
 * table (first row = header); everything else is inline rich text. Cells are
 * rich text themselves; a `|` inside `$…$` does not split a cell.
 */
export type Block = { kind: 'inline'; text: string } | { kind: 'table'; header: string[]; rows: string[][] };

const TABLE_LINE = /^\s*\|.*\|\s*$/;

export function hasTable(src: string): boolean {
  return src.split('\n').some((l) => TABLE_LINE.test(l));
}

export function splitCells(line: string): string[] {
  const s = line.trim().slice(1, -1);
  const cells: string[] = [];
  let buf = '';
  let inMath = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\\' && s[i + 1] === '$') {
      buf += '\\$';
      i++;
      continue;
    }
    if (ch === '$') inMath = !inMath;
    if (ch === '|' && !inMath) {
      cells.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  cells.push(buf.trim());
  return cells;
}

export function parseBlocks(src: string): Block[] {
  const out: Block[] = [];
  let inline: string[] = [];
  let table: string[][] = [];
  const flushInline = () => {
    const text = inline.join('\n').trim();
    if (text) out.push({ kind: 'inline', text });
    inline = [];
  };
  const flushTable = () => {
    if (table.length) out.push({ kind: 'table', header: table[0]!, rows: table.slice(1) });
    table = [];
  };
  for (const line of src.split('\n')) {
    if (TABLE_LINE.test(line)) {
      flushInline();
      table.push(splitCells(line));
    } else {
      flushTable();
      inline.push(line);
    }
  }
  flushTable();
  flushInline();
  return out;
}
