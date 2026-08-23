export function GithubSparkline({ values }: { values: number[] }) {
  // Always render 7 bars: short input is padded with zeros, long input is
  // truncated. Truncating matters — Array(7 - values.length) throws RangeError
  // on a negative length, so an oversized payload used to crash the render
  // rather than draw a slightly wrong chart.
  // Taken from the front to match the existing padding convention, which
  // appends zeros for missing entries. No caller feeds this a real array yet
  // (both pass null), so whoever wires a producer should confirm the window's
  // direction against the "last 7 days" label before trusting either end.
  const recent = values.slice(0, 7);
  const data = [...recent, ...Array(Math.max(0, 7 - recent.length)).fill(0)];
  const max = Math.max(...data, 1);
  const barWidth = 5;
  const gap = 2;
  const height = 24;
  return (
    <svg
      width={7 * barWidth + 6 * gap}
      height={height}
      aria-label={`commits last 7 days: ${data.join(", ")}`}
      role="img"
    >
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - h}
            width={barWidth}
            height={h}
            fill="#FF3A00"
            rx={1}
          />
        );
      })}
    </svg>
  );
}
