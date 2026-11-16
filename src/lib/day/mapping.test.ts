import { describe, expect, it } from "vitest";
import { checkIn, createDay, finishMatch, formTeams, mulberry32, openMatch } from "@/lib/engine";
import type { DayState } from "@/lib/engine";
import { type DayRows, rowsToState, stateToPayload } from "./mapping";

/** Mimics what public.save_day_state writes. */
function payloadToRows(s: DayState): DayRows {
  const p = stateToPayload(s);
  return {
    day: {
      id: "d",
      group_id: "g",
      date: "2026-11-15",
      status: "open",
      players_per_team: p.players_per_team,
      minutes_normal: p.minutes_normal,
      minutes_crowded: p.minutes_crowded,
      draw_cycle: p.draw_cycle,
      version: 1,
    },
    attendances: p.arrivals.map((a) => ({
      player_id: a.player_id,
      rsvp: null,
      checked_in_at: "2026-11-15T10:00:00Z",
      arrival_order: a.order,
      is_goalkeeper: a.is_goalkeeper,
      drawn_in_cycle: a.drawn,
      played: a.played,
    })),
    teams: p.teams.map((t) => ({ label: t.label, position: t.position, streak: t.streak })),
    members: p.teams.flatMap((t) =>
      t.members.map((id, i) => ({ player_id: id, label: t.label, joined_order: i + 1 })),
    ),
    matches: p.matches.map((m) => ({
      id: `m${m.seq}`,
      seq: m.seq,
      home_label: m.home,
      away_label: m.away,
      duration_min: m.duration_min,
      status: m.winner ? "finished" : "pending",
      started_at: null,
      elapsed_ms: 0,
      winner_label: m.winner,
      penalties: m.penalties,
      score_home: m.score_home,
      score_away: m.score_away,
    })),
    draws: p.draws.map((d) => ({
      draw_no: d.draw_no,
      kind: d.kind,
      match_seq: d.match_seq,
      from_label: d.from,
      to_label: d.to,
      cycle: d.cycle,
      candidates: d.candidates,
      picked: d.picked,
      from_waiting: d.from_waiting,
      undone: d.undone,
      snapshot_before: d.snapshot,
    })),
  };
}

/** played/drawnInCycle are sets and team array order is irrelevant. */
function norm(s: DayState) {
  return {
    ...s,
    played: [...s.played].sort(),
    drawnInCycle: [...s.drawnInCycle].sort(),
    teams: [...s.teams].sort((a, b) => a.label.localeCompare(b.label)),
  };
}

describe("mapping banco ↔ engine", () => {
  it("ida e volta preserva o estado (antes e depois de formar, com rodízio)", () => {
    let s = createDay({ n: 5, minutesNormal: 10, minutesCrowded: 8 });
    s = checkIn(s, "gk", true);
    for (let i = 1; i <= 13; i++) s = checkIn(s, `p${i}`, false);
    expect(norm(rowsToState(payloadToRows(s)))).toEqual(norm(s));

    s = formTeams(s, {}, mulberry32(1));
    expect(norm(rowsToState(payloadToRows(s)))).toEqual(norm(s));

    for (let i = 0; i < 5; i++) {
      const m = openMatch(s)!;
      s = finishMatch(s, { winner: m.away, penalties: i === 0, scoreHome: 1, scoreAway: 1 }, mulberry32(i)).state;
      expect(norm(rowsToState(payloadToRows(s)))).toEqual(norm(s));
    }
  });
});
