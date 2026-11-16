import type { Rng } from "./types";

export interface FairDrawInput {
  /** Players eligible for this draw (the team that just left). */
  candidates: string[];
  needed: number;
  /** Players already drawn in the current cycle. */
  drawnInCycle: string[];
  /** All line players present today (defines when a cycle is complete). */
  present: string[];
  cycle: number;
  rng: Rng;
}

export interface FairDrawOutput {
  picked: string[];
  drawnInCycle: string[];
  cycle: number;
}

/**
 * Draws `needed` players from `candidates` with the fairness rule:
 *  - players not yet drawn in the cycle have priority;
 *  - once every present line player has been drawn, the cycle restarts and
 *    the draw is fully random again.
 */
export function fairDraw(input: FairDrawInput): FairDrawOutput {
  const { candidates, needed, present, rng } = input;
  const presentSet = new Set(present);
  let drawn = new Set(input.drawnInCycle.filter((id) => presentSet.has(id)));
  let cycle = input.cycle;
  const picked: string[] = [];

  const cycleComplete = () => present.length > 0 && present.every((id) => drawn.has(id));

  while (picked.length < needed) {
    const pool = candidates.filter((id) => !picked.includes(id));
    if (pool.length === 0) break;
    const fresh = pool.filter((id) => !drawn.has(id));
    const from = fresh.length > 0 ? fresh : pool;
    const id = from[Math.floor(rng() * from.length)];
    picked.push(id);
    drawn.add(id);
    if (cycleComplete()) {
      cycle += 1;
      drawn = new Set();
    }
  }
  return { picked, drawnInCycle: [...drawn], cycle };
}
