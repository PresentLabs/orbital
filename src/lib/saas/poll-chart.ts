export const pollColors = [
  "#6e00fe",
  "#a78bfa",
  "#38b6a0",
  "#f1ae52",
  "#e583a5",
  "#6ca8df",
];
export function pollSlices(counts: number[]) {
  const safe = counts.map((n) => (Number.isFinite(n) && n > 0 ? n : 0)),
    total = safe.reduce((a, b) => a + b, 0);
  let start = 0;
  return safe.map((count, i) => {
    const from = start;
    start += total ? (count / total) * 100 : 0;
    return {
      count,
      percent: total ? Math.round((count / total) * 100) : 0,
      from,
      to: start,
      color: pollColors[i % pollColors.length],
    };
  });
}
