// Client-side tournament engine — a faithful port of the server actions
// (actions.ts) from the stuffy-battle-bracket app. The database is replaced
// by browser localStorage; all state transitions are pure functions so React
// state and localStorage stay in lockstep.

import { buildBracket, matchOrder, type BracketSide, type Slot, type SupportedSize } from "./bracket";

export type { SupportedSize };

export const STORAGE_KEY = "stuffy-bracket:v1";

export type Entrant = { id: number; seed: number; name: string; emoji: string };

export type Match = {
  id: number;
  bracketSide: BracketSide;
  roundNumber: number;
  position: number;
  entrantAId: number | null;
  entrantBId: number | null;
  winnerId: number | null;
  completedAt: string | null;
  nextMatchId: number | null;
  nextSlot: Slot | null;
  loserNextMatchId: number | null;
  loserNextSlot: Slot | null;
  isBye: boolean;
};

export type TournamentState = {
  instanceId: number;
  size: SupportedSize;
  format: "single" | "double";
  thirdPlace: boolean;
  status: "active" | "complete";
  entrants: Entrant[];
  matches: Match[];
  matchLog: { matchId: number; winnerId: number }[];
};

export type MatchEntrant = { id: number; name: string; emoji: string } | null;

export type EnrichedMatch = {
  id: number;
  bracketSide: BracketSide;
  roundNumber: number;
  position: number;
  entrantA: MatchEntrant;
  entrantB: MatchEntrant;
  winnerId: number | null;
  isBye: boolean;
};

const PLUSH_EMOJI = ["🧸","🦄","🐻","🐸","🐙","🦖","🐼","🐯","🦊","🐨","🐵","🦁","🐧","🐰","🐹","🦝","🦘","🦒","🐘","🦛","🦏","🐊","🦜","🦩","🐳","🦈","🐝","🦋","🐞","🦀","🐢","🦎"];

function loserOf(match: Pick<Match, "entrantAId" | "entrantBId">, winnerId: number) {
  return match.entrantAId === winnerId ? match.entrantBId : match.entrantAId;
}

function setMatchSlot(matches: Match[], matchId: number | null, slot: Slot | null, entrantId: number | null) {
  if (!matchId || !slot || entrantId === null) return;
  const target = matches.find((m) => m.id === matchId);
  if (!target || target.winnerId) return;
  if (slot === "A") target.entrantAId = entrantId;
  else target.entrantBId = entrantId;
}

function routeMatchResult(matches: Match[], match: Match, winnerId: number) {
  setMatchSlot(matches, match.nextMatchId, match.nextSlot, winnerId);
  setMatchSlot(matches, match.loserNextMatchId, match.loserNextSlot, loserOf(match, winnerId));
}

function advanceByes(matches: Match[]) {
  for (let guard = 0; guard < 32; guard++) {
    const ready = matches.find((m) => m.isBye && !m.winnerId && Boolean(m.entrantAId) !== Boolean(m.entrantBId));
    if (!ready) break;
    const winnerId = (ready.entrantAId ?? ready.entrantBId)!;
    ready.winnerId = winnerId;
    ready.completedAt = new Date().toISOString();
    routeMatchResult(matches, ready, winnerId);
  }
}

export function createTournament(
  size: SupportedSize,
  format: "single" | "double",
  thirdPlace: boolean,
  names: string[],
): TournamentState {
  const trimmed = names.slice(0, size).map((n) => n.trim());
  if (trimmed.length !== size || trimmed.some((n) => n.length === 0)) {
    throw new Error("Every combatant needs a name");
  }

  const entrants: Entrant[] = trimmed.map((name, seed) => ({
    id: seed + 1, // 1-based: id 0 is falsy, and winnerId is truthiness-checked
    seed,
    name,
    emoji: PLUSH_EMOJI[seed]!,
  }));

  const specs = buildBracket(size, format);
  const ids = new Map<string, number>();
  const matches: Match[] = specs.map((spec, index) => {
    const id = index + 1;
    ids.set(spec.key, id);
    return {
      id,
      bracketSide: spec.bracketSide,
      roundNumber: spec.roundNumber,
      position: spec.position,
      entrantAId: null,
      entrantBId: null,
      winnerId: null,
      completedAt: null,
      nextMatchId: null,
      nextSlot: null,
      loserNextMatchId: null,
      loserNextSlot: null,
      isBye: false,
    };
  });

  for (const spec of specs) {
    const match = matches.find((m) => m.id === ids.get(spec.key))!;
    match.nextMatchId = spec.winnerNext ? ids.get(spec.winnerNext.key) ?? null : null;
    match.nextSlot = spec.winnerNext?.slot ?? null;
    match.loserNextMatchId = spec.loserNext ? ids.get(spec.loserNext.key) ?? null : null;
    match.loserNextSlot = spec.loserNext?.slot ?? null;
    if (spec.seedA !== undefined || spec.seedB !== undefined) {
      // seeds are 0-based; entrant ids are 1-based
      match.entrantAId = spec.seedA === undefined ? null : spec.seedA + 1;
      match.entrantBId = spec.seedB === undefined ? null : spec.seedB + 1;
    }
  }

  advanceByes(matches);

  return {
    instanceId: Date.now(),
    size,
    format,
    thirdPlace,
    status: "active",
    entrants,
    matches,
    matchLog: [],
  };
}

export function reportMatchWinner(state: TournamentState, matchId: number, winnerId: number): TournamentState {
  const matches = state.matches.map((m) => ({ ...m }));
  const match = matches.find((m) => m.id === matchId);
  if (!match) throw new Error("Match not found");
  if (match.winnerId) throw new Error("Match already decided");
  if (winnerId !== match.entrantAId && winnerId !== match.entrantBId) {
    throw new Error("Winner is not in this match");
  }

  match.winnerId = winnerId;
  match.completedAt = new Date().toISOString();
  const matchLog = [...state.matchLog, { matchId, winnerId }];
  routeMatchResult(matches, match, winnerId);

  let status = state.status;
  if (state.format === "double") {
    if (match.bracketSide === "GF") {
      if (winnerId === match.entrantAId) {
        status = "complete";
      } else {
        const reset = matches.find((m) => m.bracketSide === "GF2");
        if (reset) {
          reset.entrantAId = match.entrantAId;
          reset.entrantBId = match.entrantBId;
        }
      }
    } else if (match.bracketSide === "GF2") {
      status = "complete";
    }
  }

  advanceByes(matches);

  if (state.format === "single" && matches.every((m) => m.winnerId !== null)) {
    status = "complete";
  }

  return { ...state, matches, matchLog, status };
}

export function undoLastMatch(state: TournamentState): TournamentState {
  const last = state.matchLog[state.matchLog.length - 1];
  if (!last) return state;
  const matches = state.matches.map((m) => ({ ...m }));
  const match = matches.find((m) => m.id === last.matchId);
  if (!match) return state;

  const loserId = loserOf(match, last.winnerId);
  const clearSlot = (targetId: number | null, slot: Slot | null, entrantId: number | null) => {
    if (!targetId || !slot || entrantId === null) return;
    const target = matches.find((m) => m.id === targetId);
    if (!target || target.winnerId) return;
    if (slot === "A" && target.entrantAId === entrantId) target.entrantAId = null;
    if (slot === "B" && target.entrantBId === entrantId) target.entrantBId = null;
  };
  clearSlot(match.nextMatchId, match.nextSlot, last.winnerId);
  clearSlot(match.loserNextMatchId, match.loserNextSlot, loserId);
  if (match.bracketSide === "GF") {
    const reset = matches.find((m) => m.bracketSide === "GF2");
    if (reset && !reset.winnerId) {
      reset.entrantAId = null;
      reset.entrantBId = null;
    }
  }

  match.winnerId = null;
  match.completedAt = null;
  const matchLog = state.matchLog.slice(0, -1);
  return { ...state, matches, matchLog, status: "active" };
}

export function getCurrentMatch(state: TournamentState): Match | null {
  const pending = state.matches
    .filter((m) => !m.winnerId && m.entrantAId !== null && m.entrantBId !== null)
    .sort(
      (a, b) =>
        matchOrder(a.bracketSide, a.roundNumber) - matchOrder(b.bracketSide, b.roundNumber) ||
        a.position - b.position,
    );
  return pending[0] ?? null;
}

export function enrichMatches(state: TournamentState): EnrichedMatch[] {
  const byId = new Map(state.entrants.map((e) => [e.id, e]));
  const get = (id: number | null): MatchEntrant =>
    id === null ? null : ((e) => (e ? { id: e.id, name: e.name, emoji: e.emoji } : null))(byId.get(id));
  return state.matches.map((m) => ({
    id: m.id,
    bracketSide: m.bracketSide,
    roundNumber: m.roundNumber,
    position: m.position,
    entrantA: get(m.entrantAId),
    entrantB: get(m.entrantBId),
    winnerId: m.winnerId,
    isBye: m.isBye,
  }));
}

export type Placings = { first: MatchEntrant; second: MatchEntrant; third: MatchEntrant };

export function getPlacings(state: TournamentState): Placings {
  const byId = new Map(state.entrants.map((e) => [e.id, e]));
  const get = (id: number | null): MatchEntrant =>
    id === null ? null : ((e) => (e ? { id: e.id, name: e.name, emoji: e.emoji } : null))(byId.get(id));

  let first: MatchEntrant = null;
  let second: MatchEntrant = null;
  let third: MatchEntrant = null;

  if (state.format === "double" && state.status === "complete") {
    const gf2 = state.matches.find((m) => m.bracketSide === "GF2" && m.winnerId);
    const gf = state.matches.find((m) => m.bracketSide === "GF" && m.winnerId);
    const decider = gf2 ?? gf;
    if (decider?.winnerId) {
      first = get(decider.winnerId);
      second = get(loserOf(decider, decider.winnerId));
    }
    const lbFinal = state.matches
      .filter((m) => m.bracketSide === "L" && !m.isBye && m.winnerId)
      .sort((a, b) => b.roundNumber - a.roundNumber || b.position - a.position)[0];
    if (lbFinal?.winnerId) third = get(loserOf(lbFinal, lbFinal.winnerId));
  } else if (state.format === "single") {
    const wbFinal = [...state.matches]
      .filter((m) => m.bracketSide === "W")
      .sort((a, b) => b.roundNumber - a.roundNumber)[0];
    if (wbFinal?.winnerId) {
      first = get(wbFinal.winnerId);
      second = get(loserOf(wbFinal, wbFinal.winnerId));
    }
  }

  return { first, second, third };
}

// ---- localStorage persistence ----

function isValidState(value: unknown): value is TournamentState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.instanceId === "number" &&
    [2, 4, 8, 16, 32].includes(v.size as number) &&
    (v.format === "single" || v.format === "double") &&
    typeof v.thirdPlace === "boolean" &&
    (v.status === "active" || v.status === "complete") &&
    Array.isArray(v.entrants) &&
    Array.isArray(v.matches) &&
    Array.isArray(v.matchLog)
  );
}

export function loadState(): TournamentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveState(state: TournamentState | null): void {
  try {
    if (state === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — the app still works in memory.
  }
}
