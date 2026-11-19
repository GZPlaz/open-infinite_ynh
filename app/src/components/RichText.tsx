import katex from 'katex';
import { memo, useMemo } from 'react';
import { hasTable, parseBlocks, parseRich } from '../engine/richtext';

export type MathOutput = 'html' | 'htmlAndMathml';

const cache = new Map<string, string>();
const CACHE_LIMIT = 4000;

/** KaTeX → HTML, memoised (the same expressions are rendered for measuring and for display). */
export function renderMath(tex: string, output: MathOutput, display = false): string {
  const key = `${output}|${display ? 1 : 0}|${tex}`;
  let html = cache.get(key);
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false, displayMode: display, output, strict: 'ignore' });
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, html);
  }
  return html;
}

interface Props {
  text: string;
  output?: MathOutput;
  className?: string;
}

/**
 * Text with inline `$…$` math. Text segments are rendered as React text
 * (escaped). Lines written `| a | b |` become a table (see parseBlocks).
 */
export const RichText = memo(function RichText({ text, output = 'htmlAndMathml', className }: Props) {
  if (hasTable(text)) return <RichBlocks text={text} output={output} className={className} />;
  return <InlineRich text={text} output={output} className={className} />;
});

const RichBlocks = memo(function RichBlocks({ text, output = 'htmlAndMathml', className }: Props) {
  const blocks = useMemo(() => parseBlocks(text), [text]);
  return (
    <div className={className}>
      {blocks.map((b, i) =>
        b.kind === 'inline' ? (
          <div key={i}>
            <InlineRich text={b.text} output={output} />
          </div>
        ) : (
          <table key={i} className="rt-table">
            <thead>
              <tr>
                {b.header.map((h, j) => (
                  <th key={j}>
                    <InlineRich text={h} output={output} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, j) => (
                <tr key={j}>
                  {r.map((c, k) => (
                    <td key={k}>
                      <InlineRich text={c} output={output} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ),
      )}
    </div>
  );
});

const InlineRich = memo(function InlineRich({ text, output = 'htmlAndMathml', className }: Props) {
  const segments = useMemo(() => parseRich(text), [text]);
  return (
    <span className={className}>
      {segments.map((s, i) => {
        if (s.kind === 'math') {
          // Punctuation right after math is typeset inside it, so it can't wrap onto its own line
          // while the expression itself keeps its normal break points.
          const next = segments[i + 1];
          const glue = next?.kind === 'text' ? /^[.,;:!?)]+/.exec(next.value)?.[0] : undefined;
          const tex = glue ? `${s.value}\\text{${glue}}` : s.value;
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(tex, output) }} />;
        }
        const prev = segments[i - 1];
        const value = prev?.kind === 'math' ? s.value.replace(/^[.,;:!?)]+/, '') : s.value;
        return value ? <span key={i}>{value}</span> : null;
      })}
    </span>
  );
});
