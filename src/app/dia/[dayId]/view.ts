import type { DayConfig, DayState, TeamLabel } from "@/lib/engine";
import type { PlayerInfo } from "@/lib/day/repo";

export interface OpenMatchView {
  id: string;
  seq: number;
  home: TeamLabel;
  away: TeamLabel;
  durationMin: number;
  status: "pending" | "running" | "paused" | "finished";
  startedAt: string | null;
  elapsedMs: number;
}

export interface DayView {
  dayId: string;
  groupId: string;
  groupName: string;
  date: string;
  status: "open" | "closed";
  version: number;
  /** Token do link público /ao-vivo (null antes da migration 5). */
  shareToken: string | null;
  config: DayConfig;
  players: PlayerInfo[];
  /** Estado do engine (snapshots dos sorteios removidos para aliviar o payload). */
  state: DayState;
  openMatch: OpenMatchView | null;
  /** Relógio do servidor no render, para corrigir a diferença do relógio do aparelho. */
  serverNow: number;
}

export const TEAM_STYLE: Record<TeamLabel, { text: string; bg: string; border: string; dot: string }> = {
  A: { text: "text-team-a", bg: "bg-team-a/10", border: "border-team-a/50", dot: "bg-team-a" },
  B: { text: "text-team-b", bg: "bg-team-b/10", border: "border-team-b/50", dot: "bg-team-b" },
  C: { text: "text-team-c", bg: "bg-team-c/10", border: "border-team-c/50", dot: "bg-team-c" },
  D: { text: "text-team-d", bg: "bg-team-d/10", border: "border-team-d/50", dot: "bg-team-d" },
};
