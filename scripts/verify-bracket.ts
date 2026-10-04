// Verification for the static port: simulates full tournaments through the
// actual shipped store logic (createTournament / reportMatchWinner /
// getCurrentMatch) and asserts the bracket invariants.
//
// Run: bun scripts/verify-bracket.ts
import {
  createTournament,
  getCurrentMatch,
  reportMatchWinner,
  type Match,
  type SupportedSize,
  type TournamentState,
} from "../src/store";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}

type Played = { side: string; round: number; a: number; b: number; winner: number };

function simulate(
  size: SupportedSize,
  format: "single" | "double",
  winnerPick: (a: number, b: number, match: Match) => number,
): { state: TournamentState; played: Played[]; losses: Map<number, number> } {
  let state = createTournament(
    size,
    format,
    true,
    Array.from({ length: size }, (_, i) => `Stuffy ${i + 1}`),
  );
  const played: Played[] = [];
  const losses = new Map<number, number>();
  const prevOpponent = new Map<number, number>();

  for (let guard = 0; guard < 500; guard++) {
    const cur = getCurrentMatch(state);
    if (!cur) break;
    const a = cur.entrantAId!;
    const b = cur.entrantBId!;
    assert(a !== null && b !== null && a !== b, `match ${cur.bracketSide}:${cur.roundNumber}:${cur.position} has two distinct entrants`);
    // No instant rematches in W/L rounds (championship rematches are the
    // intentional format exception).
    if (cur.bracketSide === "W" || cur.bracketSide === "L") {
      assert(
        prevOpponent.get(a) !== b && prevOpponent.get(b) !== a,
        `instant rematch in ${cur.bracketSide} R${cur.roundNumber} (entrants ${a} vs ${b})`,
      );
    }
    const winner = winnerPick(a, b, cur);
    assert(winner === a || winner === b, `winner ${winner} is in the match`);
    const loser = winner === a ? b : a;
    prevOpponent.set(winner, loser);
    prevOpponent.set(loser, winner);
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
    played.push({ side: cur.bracketSide, round: cur.roundNumber, a, b, winner });
    state = reportMatchWinner(state, cur.id, winner);
  }

  assert(state.status === "complete", `tournament completed (status=${state.status}, played=${played.length})`);
  return { state, played, losses };
}

function count(played: Played[], side: string) {
  return played.filter((p) => p.side === side).length;
}

// --- 32-player double elimination, lower seed always wins (no reset) ---
console.log("32-player double elim (no reset final):");
{
  const { state, played, losses } = simulate(32, "double", (a, b) => Math.min(a, b));
  assert(played.length === 62, `62 matches played (got ${played.length})`);
  assert(count(played, "W") === 31, `31 winners matches (got ${count(played, "W")})`);
  assert(count(played, "L") === 30, `30 losers matches (got ${count(played, "L")})`);
  assert(count(played, "GF") === 1, `1 grand final (got ${count(played, "GF")})`);
  assert(count(played, "GF2") === 0, `no reset final (got ${count(played, "GF2")})`);
  for (let id = 1; id <= 32; id++) {
    const l = losses.get(id) ?? 0;
    if (id === 1) assert(l === 0, `champion (id 1) has 0 losses (got ${l})`);
    else assert(l === 2, `id ${id} eliminated after exactly 2 losses (got ${l})`);
  }
  void state;
}

// --- 32-player double elimination, losers champion upsets the grand final ---
console.log("32-player double elim (reset final):");
{
  const { state, played, losses } = simulate(32, "double", (a, b, m) =>
    m.bracketSide === "GF" ? b : Math.min(a, b),
  );
  assert(played.length === 63, `63 matches played (got ${played.length})`);
  assert(count(played, "GF2") === 1, `reset final played (got ${count(played, "GF2")})`);
  const l1 = losses.get(1) ?? 0;
  assert(l1 === 1, `champion (id 1) has 1 loss (got ${l1})`);
  for (let id = 2; id <= 32; id++) {
    const l = losses.get(id) ?? 0;
    assert(l === 2, `id ${id} eliminated after exactly 2 losses (got ${l})`);
  }
  void state;
}

// --- 8-player single elimination spot check ---
console.log("8-player single elim:");
{
  const { played, losses } = simulate(8, "single", (a, b) => Math.min(a, b));
  assert(played.length === 7, `7 matches played (got ${played.length})`);
  const wins = new Map<number, number>();
  for (const p of played) wins.set(p.winner, (wins.get(p.winner) ?? 0) + 1);
  assert(wins.get(1) === 3, `champion won 3 matches (got ${wins.get(1)})`);
  for (let id = 2; id <= 8; id++) {
    assert((losses.get(id) ?? 0) === 1, `id ${id} has 1 loss (got ${losses.get(id) ?? 0})`);
  }
}

// --- 2-player double elimination edge case ---
console.log("2-player double elim:");
{
  const { played } = simulate(2, "double", (a, b) => Math.min(a, b));
  assert(played.length >= 1 && played.length <= 2, `1-2 matches played (got ${played.length})`);
}

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  throw new Error("verification failed");
}
console.log("\nAll bracket invariants verified ✓");
