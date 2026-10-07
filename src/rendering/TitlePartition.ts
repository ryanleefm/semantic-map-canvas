/** Split positive widths into exactly k nonempty contiguous rows, minimizing squared row widths.
 * Monotone convex hull makes this O(k*n), including reconstruction. */
export function balancedBreaks(widths: readonly number[], requested: number): number[] {
  const n = widths.length, k = Math.min(n, Math.max(1, Math.floor(requested)));
  if (!n) return [];
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + Math.max(0.001, widths[i]!);
  let previous = new Float64Array(n + 1).fill(Infinity); previous[0] = 0;
  const choices: Int32Array[] = [];
  interface Line { slope: number; intercept: number; index: number }
  const value = (line: Line, x: number) => line.slope * x + line.intercept;
  for (let row = 1; row <= k; row++) {
    const next = new Float64Array(n + 1).fill(Infinity), choice = new Int32Array(n + 1);
    const hull: Line[] = []; let head = 0;
    for (let i = row; i <= n; i++) {
      const j = i - 1, x = prefix[j]!;
      if (Number.isFinite(previous[j])) {
        const line = {slope: -2 * x, intercept: previous[j]! + x * x, index: j};
        while (hull.length - head >= 2) {
          const a = hull[hull.length - 2]!, b = hull[hull.length - 1]!;
          if ((b.intercept - a.intercept) * (b.slope - line.slope)
            < (line.intercept - b.intercept) * (a.slope - b.slope)) break;
          hull.pop();
        }
        hull.push(line);
      }
      const at = prefix[i]!;
      while (head + 1 < hull.length && value(hull[head + 1]!, at) <= value(hull[head]!, at)) head++;
      const best = hull[head]!;
      next[i] = at * at + value(best, at); choice[i] = best.index;
    }
    previous = next; choices.push(choice);
  }
  const breaks: number[] = []; let end = n;
  for (let row = k - 1; row >= 0; row--) { breaks.push(end); end = choices[row]![end]!; }
  return breaks.reverse();
}
