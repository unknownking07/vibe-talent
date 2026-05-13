export function GithubSparkline({ values }: { values: number[] }) {
  // Always render 7 bars. Missing days padded with 0.
  const data = values.length === 7 ? values : [...values, ...Array(7 - values.length).fill(0)];
  const max = Math.max(...data, 1);
  const barWidth = 5;
  const gap = 2;
  const height = 24;
  return (
    <svg width={7 * barWidth + 6 * gap} height={height} aria-label={`commits last 7 days: ${data.join(", ")}`} role="img">
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
