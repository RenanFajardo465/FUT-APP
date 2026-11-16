import type { Rng } from "./types";

const DEFAULT_RATING = 3;

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function combinations(n: number, k: number, visit: (idx: number[]) => void): void {
  const idx: number[] = [];
  const rec = (start: number) => {
    if (idx.length === k) {
      visit(idx);
      return;
    }
    for (let i = start; i <= n - (k - idx.length); i++) {
      idx.push(i);
      rec(i + 1);
      idx.pop();
    }
  };
  rec(0);
}

/**
 * Splits an even-sized pool in two equal teams minimising the difference of
 * rating sums. Among all optimal splits one is chosen at random, and which
 * half becomes the first team is random too.
 */
export function balancedSplit(
  pool: string[],
  ratings: Record<string, number>,
  rng: Rng,
): [string[], string[]] {
  if (pool.length % 2 !== 0) throw new Error("Pool precisa ter tamanho par");
  const k = pool.length / 2;
  const r = pool.map((id) => ratings[id] ?? DEFAULT_RATING);
  const total = r.reduce((a, b) => a + b, 0);

  let best = Infinity;
  let optimal: number[][] = [];
  // Fix index 0 in the first half to skip mirrored duplicates.
  combinations(pool.length - 1, k - 1, (rest) => {
    const half = [0, ...rest.map((i) => i + 1)];
    const sum = half.reduce((acc, i) => acc + r[i], 0);
    const diff = Math.abs(total - 2 * sum);
    if (diff < best) {
      best = diff;
      optimal = [[...half]];
    } else if (diff === best) {
      optimal.push([...half]);
    }
  });

  const chosen = new Set(optimal[Math.floor(rng() * optimal.length)]);
  const first = shuffle(pool.filter((_, i) => chosen.has(i)), rng);
  const second = shuffle(pool.filter((_, i) => !chosen.has(i)), rng);
  return rng() < 0.5 ? [first, second] : [second, first];
}

export function ratingSum(ids: string[], ratings: Record<string, number>): number {
  return ids.reduce((acc, id) => acc + (ratings[id] ?? DEFAULT_RATING), 0);
}
