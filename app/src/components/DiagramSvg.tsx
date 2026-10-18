/**
 * Renders an engine Diagram as inline SVG.
 *
 * Only presentation attributes are used (no CSS classes): html2canvas rasterises
 * SVG by loading it as an image, and document stylesheets do not apply there.
 */
import { memo, type ReactNode } from 'react';
import { LABEL_GAP_PX, LABEL_PX, LABEL_SMALL_PX, type Diagram, type DiagramItem, type Ink, type Pt } from '../engine/diagram';

const COLORS: Record<Ink, string> = {
  ink: '#111111',
  grid: '#c9ccd1',
  axis: '#4a4f57',
  accent: '#c62828',
  muted: '#5f6670',
};

const FONT = "KaTeX_Main, 'Times New Roman', Times, serif";

interface Props {
  diagram: Diagram;
  /** Upper bound on the rendered width in px (the figure scales down to fit). */
  maxWidth?: number;
}

export const DiagramSvg = memo(function DiagramSvg({ diagram, maxWidth }: Props) {
  const { box, scale, items } = diagram;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  // SVG y grows downwards: map (x, y) → (x, -y)
  const P = (p: Pt) => `${num(p[0])},${num(-p[1])}`;
  const px = (n: number) => n / scale;
  let widthPx = w * scale;
  let heightPx = h * scale;
  if (maxWidth && widthPx > maxWidth) {
    heightPx *= maxWidth / widthPx;
    widthPx = maxWidth;
  }
  // stroke widths are specified in px of the *unscaled* figure
  const k = widthPx / (w * scale);
  const stroke = (weight = 1) => px(weight) / Math.max(k, 0.6);

  const nodes: ReactNode[] = [];
  items.forEach((it, i) => {
    try {
      nodes.push(render(it, i));
    } catch {
      // a malformed item (e.g. from an imported file) must not break the page
    }
  });

  function render(it: DiagramItem, key: number): ReactNode {
    const color = COLORS[it.ink ?? 'ink'];
    switch (it.t) {
      case 'path': {
        const common = {
          key,
          points: it.pts.map(P).join(' '),
          fill: it.fill ? COLORS[it.fill] : 'none',
          fillOpacity: it.fill ? 0.16 : undefined,
          stroke: it.noStroke ? 'none' : color,
          strokeWidth: stroke(it.weight),
          strokeDasharray: it.dash ? `${px(4)} ${px(3)}` : undefined,
          strokeLinejoin: 'round' as const,
          strokeLinecap: 'round' as const,
        };
        return it.closed ? <polygon {...common} /> : <polyline {...common} />;
      }
      case 'circle':
        return (
          <circle key={key} cx={num(it.c[0])} cy={num(-it.c[1])} r={num(it.r)} fill="none" stroke={color} strokeWidth={stroke(it.weight)} strokeDasharray={it.dash ? `${px(4)} ${px(3)}` : undefined} />
        );
      case 'ellipse': {
        const [cx, cy] = [it.c[0], -it.c[1]];
        const dash = it.dash ? `${px(4)} ${px(3)}` : undefined;
        if (!it.part || it.part === 'full') {
          return <ellipse key={key} cx={num(cx)} cy={num(cy)} rx={num(it.rx)} ry={num(it.ry)} fill="none" stroke={color} strokeWidth={stroke(it.weight)} strokeDasharray={dash} />;
        }
        // upper half (y up) = the half with smaller SVG y
        const sweep = it.part === 'upper' ? 0 : 1;
        const d = `M ${num(cx + it.rx)} ${num(cy)} A ${num(it.rx)} ${num(it.ry)} 0 0 ${sweep} ${num(cx - it.rx)} ${num(cy)}`;
        return <path key={key} d={d} fill="none" stroke={color} strokeWidth={stroke(it.weight)} strokeDasharray={dash} />;
      }
      case 'arc': {
        const a0 = (it.from * Math.PI) / 180;
        const a1 = (it.to * Math.PI) / 180;
        const x0 = it.c[0] + it.r * Math.cos(a0);
        const y0 = it.c[1] + it.r * Math.sin(a0);
        const x1 = it.c[0] + it.r * Math.cos(a1);
        const y1 = it.c[1] + it.r * Math.sin(a1);
        const large = Math.abs(it.to - it.from) > 180 ? 1 : 0;
        // counter-clockwise in y-up space is clockwise (sweep = 0) after the flip
        const sweep = it.to > it.from ? 0 : 1;
        const d = `M ${num(x0)} ${num(-y0)} A ${num(it.r)} ${num(it.r)} 0 ${large} ${sweep} ${num(x1)} ${num(-y1)}`;
        return <path key={key} d={d} fill="none" stroke={color} strokeWidth={stroke(it.weight ?? 0.9)} />;
      }
      case 'dot':
        return <circle key={key} cx={num(it.p[0])} cy={num(-it.p[1])} r={px(3.2)} fill={it.open ? '#ffffff' : color} stroke={color} strokeWidth={stroke(1.3)} />;
      case 'arrow': {
        const [x0, y0] = [it.from[0], -it.from[1]];
        const [x1, y1] = [it.to[0], -it.to[1]];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const ux = (x1 - x0) / len;
        const uy = (y1 - y0) / len;
        const head = (tx: number, ty: number, dx: number, dy: number) => {
          const s = px(7);
          const wv = px(3.2);
          return `${num(tx)},${num(ty)} ${num(tx - dx * s - dy * wv)},${num(ty - dy * s + dx * wv)} ${num(tx - dx * s + dy * wv)},${num(ty - dy * s - dx * wv)}`;
        };
        const inset = px(5);
        return (
          <g key={key}>
            <line
              x1={num(it.both ? x0 + ux * inset : x0)}
              y1={num(it.both ? y0 + uy * inset : y0)}
              x2={num(x1 - ux * inset)}
              y2={num(y1 - uy * inset)}
              stroke={color}
              strokeWidth={stroke(it.weight)}
            />
            <polygon points={head(x1, y1, ux, uy)} fill={color} />
            {it.both && <polygon points={head(x0, y0, -ux, -uy)} fill={color} />}
          </g>
        );
      }
      case 'label': {
        const fs = px(it.small ? LABEL_SMALL_PX : LABEL_PX);
        const gap = px(LABEL_GAP_PX);
        const pos = it.pos;
        let x = it.p[0];
        let y = -it.p[1];
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        if (pos.includes('e')) {
          x += gap;
          anchor = 'start';
        } else if (pos.includes('w')) {
          x -= gap;
          anchor = 'end';
        }
        // baseline offsets approximating the font's ascent (0.72em) and descent
        if (pos.includes('n')) y -= gap + fs * 0.12;
        else if (pos.includes('s')) y += gap + fs * 0.78;
        else y += fs * 0.35;
        return (
          <text key={key} x={num(x)} y={num(y)} fontSize={num(fs)} fontFamily={FONT} textAnchor={anchor} fill={color} fontStyle={/^[a-zA-Zθ]′*$/.test(it.text) ? 'italic' : undefined}>
            {it.text}
          </text>
        );
      }
    }
  }

  return (
    <svg
      className="diagram"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${num(box.x0)} ${num(-box.y1)} ${num(w)} ${num(h)}`}
      width={num(widthPx)}
      height={num(heightPx)}
      role="img"
      aria-label={diagram.alt}
    >
      {nodes}
    </svg>
  );
});

function num(x: number): string {
  return Number.isFinite(x) ? String(Math.round(x * 1000) / 1000) : '0';
}
