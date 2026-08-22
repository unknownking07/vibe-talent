// Geometry for the inline price sparklines on /bags.
//
// Kept as pure maths so the awkward cases — a single trade, a flat series, a
// series that spikes 400x — are unit-testable, and so the charts stay plain
// server-rendered SVG instead of pulling a charting library into the bundle.

export type SparklineShape = {
  /** Polyline points for the price line. */
  line: string;
  /** Closed path for the tint under the line. */
  area: string;
};

/**
 * Map a price series onto an SVG viewbox.
 *
 * Returns null below two points: one trade is not a trend, and drawing a dot
 * as though it were would overstate what the data says.
 *
 * A flat series is drawn down the middle rather than at the bottom, so a token
 * whose price never moved does not read as one that collapsed.
 */
export function buildSparkline(
  values: number[],
  width: number,
  height: number,
  padding = 2,
): SparklineShape | null {
  if (values.length < 2 || width <= 0 || height <= 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const usableHeight = Math.max(height - padding * 2, 0);
  const stepX = width / (values.length - 1);

  const points = values.map((value, i) => {
    const x = i * stepX;
    const ratio = span === 0 ? 0.5 : (value - min) / span;
    // SVG y grows downward, so the highest price sits at the smallest y.
    const y = padding + (1 - ratio) * usableHeight;
    return `${round(x)},${round(y)}`;
  });

  const line = points.join(" ");
  const area = `M0,${round(height)} L${points.join(" L")} L${round(width)},${round(height)} Z`;

  return { line, area };
}

/** Two decimals is beyond sub-pixel; more just bloats the markup. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
