import { EmptyState } from "./primitives";

export interface BarDatum {
  label: string;
  title?: string;
  value: number;
}

/** Vertical bar chart (SVG, no chart library). */
export function BarChart({
  data,
  format = String,
  height = 190,
  emptyText = "No data for this period yet."
}: {
  data: BarDatum[];
  format?: (v: number) => string;
  height?: number;
  emptyText?: string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (!max) return <EmptyState text={emptyText} />;
  const W = 640;
  const H = height;
  const top = 18;
  const bottom = 26;
  const left = 6;
  const bw = (W - left * 2) / data.length;
  const gridY = [0.5, 1].map((f) => top + (H - top - bottom) * (1 - f));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="chart"
      role="img"
      aria-label={data.map((d) => `${d.title || d.label}: ${format(d.value)}`).join("; ")}
    >
      {gridY.map((y) => (
        <line key={y} x1={0} x2={W} y1={y} y2={y} className="grid" />
      ))}
      {data.map((d, i) => {
        const bh = (H - top - bottom) * (d.value / max);
        const x = left + i * bw + bw * 0.18;
        const w = bw * 0.64;
        const y = H - bottom - bh;
        return (
          <g key={d.label + i} className="bar">
            <title>{`${d.title || d.label}: ${format(d.value)}`}</title>
            <rect x={x} y={y} width={w} height={Math.max(bh, d.value ? 2 : 0)} rx={3} />
            {d.value ? (
              <text x={x + w / 2} y={y - 5} className="val">
                {format(d.value)}
              </text>
            ) : null}
            <text x={x + w / 2} y={H - 8} className="lbl">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export interface StatBarItem {
  label: string;
  value: number;
  cls?: string;
}

/** Horizontal bars for breakdowns. */
export function StatBars({
  items,
  format = String,
  emptyText = "No data yet."
}: {
  items: StatBarItem[];
  format?: (v: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!max) return <EmptyState text={emptyText} />;
  return (
    <div className="sbars">
      {items.map((i) => (
        <div className="sbar" key={i.label}>
          <span className="sbar-l">{i.label}</span>
          <span className="sbar-t">
            <span className={`sbar-fill ${i.cls || ""}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </span>
          <span className="sbar-v">{format(i.value)}</span>
        </div>
      ))}
    </div>
  );
}
