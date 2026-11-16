import { describe, expect, it } from "vitest";
import {
  type DayState,
  type TeamLabel,
  balancedSplit,
  canFormTeams,
  checkIn,
  createDay,
  fairDraw,
  finishMatch,
  formTeams,
  getTeam,
  lineArrivals,
  movePlayer,
  mulberry32,
  openMatch,
  ratingSum,
  removeCheckIn,
  reorderQueue,
  swapPlayers,
  undoLastDraw,
  waitingList,
} from "./index";

const cfg = (n = 6) => ({ n, minutesNormal: 10, minutesCrowded: 8 });
const pid = (i: number) => `p${String(i).padStart(2, "0")}`;
const ratings: Record<string, number> = Object.fromEntries(
  Array.from({ length: 40 }, (_, i) => [pid(i + 1), (i % 5) + 1]),
);

function arrive(s: DayState, from: number, to: number, started = false): DayState {
  for (let i = from; i <= to; i++) s = checkIn(s, pid(i), false, { openMatchStarted: started });
  return s;
}

function formed(n: number, count: number, seed = 1): DayState {
  const s = arrive(createDay(cfg(n)), 1, count);
  return formTeams(s, ratings, mulberry32(seed));
}

/** Finishes the open match; winner defaults to the home team. */
function play(s: DayState, winner?: TeamLabel, seed = 7) {
  const m = openMatch(s)!;
  return finishMatch(s, { winner: winner ?? m.home, penalties: false }, mulberry32(seed + m.seq));
}

function pair(s: DayState): string {
  const m = openMatch(s)!;
  return [m.home, m.away].sort().join("x");
}

/** Invariants that must hold at any moment after formation. */
function checkInvariants(s: DayState) {
  const line = lineArrivals(s).map((a) => a.playerId);
  const inTeams = s.teams.flatMap((t) => t.members);
  expect(new Set(inTeams).size).toBe(inTeams.length); // no duplicates
  expect([...inTeams, ...waitingList(s)].sort()).toEqual([...line].sort());
  expect(s.teams.length).toBeLessThanOrEqual(4);
  for (const t of s.teams) expect(t.members.length).toBeLessThanOrEqual(s.config.n);
  const labels = [...(s.field ?? []), ...s.queue].sort();
  expect(labels).toEqual(s.teams.map((t) => t.label).sort());
}

// ---------------------------------------------------------------------------

describe("formação de A e B", () => {
  it("só libera com 2N jogadores de linha; goleiros não contam", () => {
    let s = arrive(createDay(cfg(6)), 1, 11);
    s = checkIn(s, "gk1", true);
    expect(canFormTeams(s)).toBe(false);
    expect(() => formTeams(s, ratings, mulberry32(1))).toThrow();
    s = arrive(s, 12, 12);
    expect(canFormTeams(s)).toBe(true);
  });

  it("equilibra a soma das notas entre os 2N primeiros", () => {
    const s = formed(6, 12);
    const a = getTeam(s, "A").members;
    const b = getTeam(s, "B").members;
    expect(a).toHaveLength(6);
    expect(b).toHaveLength(6);
    // soma total 33 (ímpar): o ótimo é diferença 1
    expect(Math.abs(ratingSum(a, ratings) - ratingSum(b, ratings))).toBe(1);
    expect([...a, ...b].sort()).toEqual(Array.from({ length: 12 }, (_, i) => pid(i + 1)));
  });

  it("encontra a divisão ótima mesmo com notas desiguais", () => {
    const r = { a: 5, b: 5, c: 1, d: 1, e: 4, f: 2 };
    // 3 por time, total 18: nenhuma trinca soma 9, então o ótimo é 10 × 8
    for (const seed of [1, 2, 3, 4]) {
      const [x, y] = balancedSplit(Object.keys(r), r, mulberry32(seed));
      expect(Math.abs(ratingSum(x, r) - ratingSum(y, r))).toBe(2);
    }
  });

  it("goleiros ficam fora dos times", () => {
    let s = checkIn(createDay(cfg(5)), "gk1", true);
    s = arrive(s, 1, 10);
    s = checkIn(s, "gk2", true);
    s = formTeams(s, ratings, mulberry32(1));
    expect(s.teams.flatMap((t) => t.members)).not.toContain("gk1");
    expect(s.teams.flatMap((t) => t.members)).not.toContain("gk2");
  });
});

describe("sobra 0 (só 2 times)", () => {
  it("não há rodízio nem sorteio", () => {
    let s = formed(6, 12);
    const a = [...getTeam(s, "A").members];
    for (let i = 0; i < 5; i++) {
      const out = play(s, i % 2 ? "A" : "B");
      expect(out.left).toBeNull();
      expect(out.draw).toBeNull();
      s = out.state;
      expect(pair(s)).toBe("AxB");
    }
    expect(getTeam(s, "A").members).toEqual(a);
    expect(s.matches).toHaveLength(6);
    expect(openMatch(s)!.durationMin).toBe(10);
  });
});

describe("sobra 1", () => {
  it("o 13º forma C incompleto; quando B sai, sorteia N-1 de B para C", () => {
    let s = formed(6, 13);
    expect(getTeam(s, "C").members).toEqual([pid(13)]);
    expect(s.queue).toEqual(["C"]);

    const out = play(s, "A");
    s = out.state;
    expect(out.left).toBe("B");
    expect(out.entered).toBe("C");
    expect(out.draw!.picked).toHaveLength(5);
    expect(getTeam(s, "C").members).toHaveLength(6);
    expect(getTeam(s, "C").members[0]).toBe(pid(13));
    expect(getTeam(s, "B").members).toHaveLength(1); // novo time incompleto
    expect(s.queue).toEqual(["B"]);
    expect(pair(s)).toBe("AxC");
    checkInvariants(s);

    // A completou 2 jogos e sai mesmo vencendo; B (1 jogador) recebe 5 de A.
    const out2 = play(s, "A");
    expect(out2.left).toBe("A");
    expect(out2.entered).toBe("B");
    expect(getTeam(out2.state, "B").members).toHaveLength(6);
    expect(getTeam(out2.state, "A").members).toHaveLength(1);
    checkInvariants(out2.state);
  });
});

describe("sobra N-1", () => {
  it("C com 5 recebe 1 sorteado de B; sobram 5 em B", () => {
    let s = formed(6, 17);
    expect(getTeam(s, "C").members).toHaveLength(5);
    const out = play(s, "A");
    s = out.state;
    expect(out.draw!.picked).toHaveLength(1);
    expect(out.draw!.candidates).toHaveLength(6);
    expect(getTeam(s, "C").members).toHaveLength(6);
    expect(getTeam(s, "B").members).toHaveLength(5);
    checkInvariants(s);
  });
});

describe("rodízio com 3 times", () => {
  it("segue A×B → A×C → B×C → A×B, cada time no máx. 2 seguidas", () => {
    let s = formed(6, 18);
    const seq: string[] = [pair(s)];
    for (let i = 0; i < 6; i++) {
      s = play(s).state;
      seq.push(pair(s));
      checkInvariants(s);
    }
    expect(seq.slice(0, 4)).toEqual(["AxB", "AxC", "BxC", "AxB"]);
    // Ninguém joga 3 seguidas.
    for (let i = 2; i < s.matches.length; i++) {
      const teams = (j: number) => [s.matches[j].home, s.matches[j].away];
      for (const t of teams(i)) {
        expect(teams(i - 1).includes(t) && teams(i - 2).includes(t)).toBe(false);
      }
    }
  });

  it("depois da P1 o resultado não muda o rodízio", () => {
    const base = play(formed(6, 18), "A").state;
    const x = play(base, "A").state;
    const y = play(base, "C").state;
    expect(pair(x)).toBe(pair(y));
  });

  it("times completos não recebem complemento", () => {
    const out = play(formed(6, 18), "B");
    expect(out.draw).toBeNull();
    expect(out.left).toBe("A");
  });
});

describe("rodízio com 4 times", () => {
  it("fila FIFO com 4 times completos", () => {
    let s = formed(5, 20);
    expect(s.queue).toEqual(["C", "D"]);
    const seq = [pair(s)];
    for (let i = 0; i < 8; i++) {
      s = play(s).state;
      seq.push(pair(s));
      checkInvariants(s);
    }
    expect(seq.slice(0, 6)).toEqual(["AxB", "AxC", "CxD", "BxD", "AxB", "AxC"]);
  });

  it("4 times com D incompleto", () => {
    let s = formed(5, 17);
    expect(getTeam(s, "D").members).toHaveLength(2);
    for (let i = 0; i < 12; i++) {
      s = play(s).state;
      checkInvariants(s);
      for (const l of s.field!) expect(getTeam(s, l).members).toHaveLength(5);
    }
  });

  it("máximo de 4 times: excedente vai para a lista de espera", () => {
    let s = formed(3, 12);
    expect(s.teams).toHaveLength(4);
    s = arrive(s, 13, 13);
    expect(s.teams).toHaveLength(4);
    expect(waitingList(s)).toEqual([pid(13)]);
    checkInvariants(s);
  });
});

describe("empate com pênaltis", () => {
  it("registra pênaltis e o perdedor da P1 sai", () => {
    const s = formed(6, 18);
    const out = finishMatch(
      s,
      { winner: "B", penalties: true, scoreHome: 2, scoreAway: 2 },
      mulberry32(1),
    );
    expect(out.state.matches[0].result).toEqual({
      winner: "B",
      penalties: true,
      scoreHome: 2,
      scoreAway: 2,
    });
    expect(out.left).toBe("A");
    expect(pair(out.state)).toBe("BxC");
  });

  it("rejeita vencedor que não está em campo", () => {
    const s = formed(6, 18);
    expect(() => finishMatch(s, { winner: "C", penalties: false }, mulberry32(1))).toThrow();
  });
});

describe("chegada atrasada", () => {
  it("quem chega depois da formação cria o C e entra no próximo rodízio", () => {
    let s = formed(6, 12);
    s = arrive(s, 13, 14, true);
    expect(getTeam(s, "C").members).toEqual([pid(13), pid(14)]);
    const out = play(s, "B");
    expect(out.left).toBe("A");
    expect(out.draw!.picked).toHaveLength(4);
    expect(getTeam(out.state, "C").members.slice(0, 2)).toEqual([pid(13), pid(14)]);
  });

  it("atrasado entra no time incompleto do fim da fila (sobra de quem saiu)", () => {
    let s = play(formed(6, 13), "A").state; // B ficou com 1
    s = arrive(s, 14, 14);
    expect(getTeam(s, "B").members).toContain(pid(14));
    expect(getTeam(s, "B").members).toHaveLength(2);
  });

  it("prioridade 1: jogadores na espera completam antes do sorteio", () => {
    let s = formed(6, 13);
    s = movePlayer(s, pid(13), null); // admin coloca o 13 na espera; C fica vazio
    expect(waitingList(s)).toEqual([pid(13)]);
    const out = play(s, "A");
    expect(out.draw!.fromWaiting).toEqual([pid(13)]);
    expect(out.draw!.picked).toHaveLength(5);
    expect(getTeam(out.state, "C").members[0]).toBe(pid(13));
    expect(getTeam(out.state, "C").members).toHaveLength(6);
    checkInvariants(out.state);
  });

  it("goleiro atrasado não entra em time", () => {
    let s = formed(6, 12);
    s = checkIn(s, "gk", true);
    expect(s.teams).toHaveLength(2);
  });
});

describe("tempo de partida 10 → 8", () => {
  it("≤ 3N = 10 min; > 3N = 8 min, recalculado no check-in", () => {
    let s = formed(6, 18);
    expect(openMatch(s)!.durationMin).toBe(10);
    s = arrive(s, 19, 19);
    expect(openMatch(s)!.durationMin).toBe(8);
  });

  it("partida já iniciada não muda; a próxima já sai com 8", () => {
    let s = formed(6, 18);
    s = arrive(s, 19, 19, true);
    expect(openMatch(s)!.durationMin).toBe(10);
    s = play(s).state;
    expect(openMatch(s)!.durationMin).toBe(8);
  });

  it("desfazer check-in volta para 10", () => {
    let s = arrive(formed(6, 18), 19, 19);
    s = removeCheckIn(s, pid(19));
    expect(openMatch(s)!.durationMin).toBe(10);
    checkInvariants(s);
  });

  it("tempos configuráveis", () => {
    let s = arrive(createDay({ n: 5, minutesNormal: 12, minutesCrowded: 7 }), 1, 16);
    s = formTeams(s, ratings, mulberry32(2));
    expect(openMatch(s)!.durationMin).toBe(7);
  });
});

describe("sorteio justo (ciclos)", () => {
  const present = ["a", "b", "c", "d", "e", "f", "g", "h"];

  it("prioriza quem ainda não foi sorteado no ciclo", () => {
    const r = fairDraw({
      candidates: ["a", "b", "c", "d", "e", "f"],
      needed: 2,
      drawnInCycle: ["a", "b", "c", "d"],
      present,
      cycle: 1,
      rng: mulberry32(9),
    });
    expect(r.picked.sort()).toEqual(["e", "f"]);
    expect(r.cycle).toBe(1);
  });

  it("se faltar candidato novo, completa com já sorteados sem reiniciar o ciclo", () => {
    const r = fairDraw({
      candidates: ["a", "b", "c"],
      needed: 2,
      drawnInCycle: ["a", "b"],
      present,
      cycle: 1,
      rng: mulberry32(9),
    });
    expect(r.picked).toContain("c");
    expect(r.cycle).toBe(1);
  });

  it("reinicia o ciclo quando todos os presentes foram sorteados", () => {
    const r = fairDraw({
      candidates: ["a", "b", "c", "d"],
      needed: 3,
      drawnInCycle: ["a", "b", "c", "e", "f", "g", "h"],
      present,
      cycle: 4,
      rng: mulberry32(5),
    });
    expect(r.picked[0]).toBe("d"); // único não sorteado
    expect(r.cycle).toBe(5);
    expect(r.drawnInCycle.sort()).toEqual(r.picked.slice(1).sort());
  });

  it("vários ciclos num dia: ninguém repete antes de todos os candidatos possíveis", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let s = formed(6, 13, seed);
      const counts = new Map<string, number>();
      for (let i = 0; i < 40; i++) {
        const out = play(s, undefined, seed * 100);
        s = out.state;
        checkInvariants(s);
        for (const l of s.field!) expect(getTeam(s, l).members).toHaveLength(6);
        for (const id of out.draw?.picked ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      expect(s.drawCycle).toBeGreaterThan(3);
      expect(counts.size).toBe(13);
      // Regra: dentro do ciclo, só repete quem já foi sorteado se todos os
      // candidatos ainda não sorteados também foram escolhidos.
      for (const d of s.draws.filter((x) => x.kind === "completion" && x.picked.length)) {
        const before = new Set(d.before.drawnInCycle);
        const repeated = d.picked.some((id) => before.has(id));
        if (repeated) {
          const fresh = d.candidates.filter((id) => !before.has(id));
          for (const id of fresh) expect(d.picked).toContain(id);
        }
      }
      // histórico guardado
      expect(s.draws.filter((d) => d.kind === "completion")).toHaveLength(40);
    }
  });

  it("tempo de jogo igual: diferença de partidas jogadas pequena", () => {
    let s = formed(6, 15, 3);
    const games = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      for (const l of s.field!) {
        for (const id of getTeam(s, l).members) games.set(id, (games.get(id) ?? 0) + 1);
      }
      s = play(s).state;
    }
    const v = [...games.values()];
    expect(v).toHaveLength(15);
    expect(Math.max(...v) - Math.min(...v)).toBeLessThanOrEqual(1);
  });
});

describe("ajustes manuais", () => {
  it("troca jogadores entre times", () => {
    const s = formed(6, 12);
    const a0 = getTeam(s, "A").members[0];
    const b0 = getTeam(s, "B").members[0];
    const t = swapPlayers(s, a0, b0);
    expect(getTeam(t, "A").members).toContain(b0);
    expect(getTeam(t, "B").members).toContain(a0);
    checkInvariants(t);
    expect(() => swapPlayers(s, a0, getTeam(s, "A").members[1])).toThrow();
  });

  it("troca com jogador da espera", () => {
    let s = arrive(formed(3, 12), 13, 13);
    const a0 = getTeam(s, "A").members[0];
    s = swapPlayers(s, a0, pid(13));
    expect(waitingList(s)).toEqual([a0]);
    checkInvariants(s);
  });

  it("edita a ordem da fila", () => {
    const s = formed(5, 20);
    const t = reorderQueue(s, ["D", "C"]);
    expect(t.queue).toEqual(["D", "C"]);
    expect(play(t, "A").entered).toBe("D");
    expect(() => reorderQueue(s, ["C", "C"])).toThrow();
    expect(() => reorderQueue(s, ["C"])).toThrow();
  });

  it("desfaz a formação e permite sortear de novo", () => {
    const s = formed(6, 13);
    const u = undoLastDraw(s);
    expect(u.field).toBeNull();
    expect(u.teams).toHaveLength(0);
    expect(u.matches).toHaveLength(0);
    expect(u.draws[0].undone).toBe(true);
    const again = formTeams(u, ratings, mulberry32(99));
    expect(again.draws).toHaveLength(2);
  });

  it("desfaz o sorteio de complemento: reabre a partida e mantém check-ins novos", () => {
    const s = formed(6, 13);
    const out = play(s, "A");
    let t = arrive(out.state, 14, 14);
    t = undoLastDraw(t);
    expect(openMatch(t)!.seq).toBe(1);
    expect(t.matches).toHaveLength(1);
    expect(getTeam(t, "C").members).toEqual([pid(13), pid(14)]);
    expect(t.drawnInCycle).toEqual([]);
    expect(t.draws.find((d) => d.kind === "completion")!.undone).toBe(true);
    checkInvariants(t);
    // pode registrar de novo
    expect(play(t, "B").left).toBe("A");
  });

  it("desfaz em sequência, uma partida por vez; não pula partidas sem sorteio", () => {
    let s = play(formed(6, 18), "A").state; // sem sorteio (times completos)
    expect(() => undoLastDraw(s)).toThrow();
    s = formed(6, 13);
    s = play(s).state;
    s = play(s).state;
    s = undoLastDraw(s); // desfaz o da P2 (reabre P2)
    expect(openMatch(s)!.seq).toBe(2);
    s = undoLastDraw(s); // agora o da P1 (reabre P1)
    expect(openMatch(s)!.seq).toBe(1);
  });

  it("não desfaz check-in de quem já jogou", () => {
    const s = play(formed(6, 12)).state;
    expect(() => removeCheckIn(s, getTeam(s, "A").members[0])).toThrow();
  });
});
