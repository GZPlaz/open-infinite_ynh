import katex from 'katex';
import { memo, useMemo } from 'react';
import { parseRich } from '../engine/richtext';

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

/** Text with inline `$…$` math. Text segments are rendered as React text (escaped). */
export const RichText = memo(function RichText({ text, output = 'htmlAndMathml', className }: Props) {
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
