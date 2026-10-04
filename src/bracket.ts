// Bracket graph math — ported from the server's bracket.ts of the
// stuffy-battle-bracket app. Pure client-side, no dependencies.

export type BracketSide = "W" | "L" | "GF" | "GF2";
export type Slot = "A" | "B";

export type Route = {
  key: string;
  slot: Slot;
};

export type BracketMatchSpec = {
  key: string;
  bracketSide: BracketSide;
  roundNumber: number;
  position: number;
  seedA?: number;
  seedB?: number;
  winnerNext?: Route;
  loserNext?: Route;
};

export const SUPPORTED_SIZES = [2, 4, 8, 16, 32] as const;
export type SupportedSize = (typeof SUPPORTED_SIZES)[number];

function roundsFor(size: number) {
  return Math.log2(size);
}

export function matchOrder(side: string, roundNumber: number) {
  if (side === "W") return roundNumber === 0 ? 0 : 3 * roundNumber - 1;
  if (side === "L") return 1 + roundNumber + Math.floor((roundNumber + 1) / 2);
  if (side === "GF") return 100;
  if (side === "GF2") return 101;
  return 200;
}

export function buildSingleEliminationBracket(size: SupportedSize): BracketMatchSpec[] {
  const rounds = roundsFor(size);
  const result: BracketMatchSpec[] = [];
  for (let round = 0; round < rounds; round++) {
    const count = size >> (round + 1);
    for (let position = 0; position < count; position++) {
      const key = `W:${round}:${position}`;
      const isFinal = round === rounds - 1;
      result.push({
        key,
        bracketSide: "W",
        roundNumber: round,
        position,
        seedA: round === 0 ? position * 2 : undefined,
        seedB: round === 0 ? position * 2 + 1 : undefined,
        winnerNext: isFinal
          ? undefined
          : {
              key: `W:${round + 1}:${Math.floor(position / 2)}`,
              slot: position % 2 === 0 ? "A" : "B",
            },
      });
    }
  }
  return result;
}

/**
 * Builds a complete, canonical double-elimination graph.
 *
 * Losers rounds alternate between a consolidation round and a winners-drop
 * round. The XOR mapping crosses adjacent winners matches so a contestant
 * cannot immediately replay the opponent who just defeated them.
 */
export function buildDoubleEliminationBracket(size: SupportedSize): BracketMatchSpec[] {
  const rounds = roundsFor(size);
  const result = buildSingleEliminationBracket(size);

  for (let round = 0; round < 2 * rounds - 2; round++) {
    const stage = Math.floor(round / 2);
    const count = size >> (stage + 2);
    for (let position = 0; position < count; position++) {
      const isLast = round === 2 * rounds - 3;
      let winnerNext: Route;
      if (isLast) {
        winnerNext = { key: "GF:0:0", slot: "B" };
      } else if (round % 2 === 0) {
        winnerNext = { key: `L:${round + 1}:${position}`, slot: "A" };
      } else {
        winnerNext = {
          key: `L:${round + 1}:${Math.floor(position / 2)}`,
          slot: position % 2 === 0 ? "A" : "B",
        };
      }
      result.push({
        key: `L:${round}:${position}`,
        bracketSide: "L",
        roundNumber: round,
        position,
        winnerNext,
      });
    }
  }

  for (const match of result.filter((m) => m.bracketSide === "W")) {
    const isFinal = match.roundNumber === rounds - 1;
    if (isFinal) {
      match.winnerNext = { key: "GF:0:0", slot: "A" };
      match.loserNext = size === 2 ? { key: "GF:0:0", slot: "B" } : { key: `L:${2 * rounds - 3}:0`, slot: "B" };
      continue;
    }
    if (match.roundNumber === 0) {
      match.loserNext = {
        key: `L:0:${Math.floor(match.position / 2)}`,
        slot: match.position % 2 === 0 ? "A" : "B",
      };
      continue;
    }
    const targetRound = 2 * match.roundNumber - 1;
    const targetCount = size >> (match.roundNumber + 1);
    const targetPosition = targetCount > 1 ? match.position ^ 1 : match.position;
    match.loserNext = { key: `L:${targetRound}:${targetPosition}`, slot: "B" };
  }

  result.push({ key: "GF:0:0", bracketSide: "GF", roundNumber: 0, position: 0 });
  result.push({ key: "GF2:0:0", bracketSide: "GF2", roundNumber: 0, position: 0 });
  return result;
}

export function buildBracket(size: SupportedSize, format: "single" | "double") {
  return format === "double" ? buildDoubleEliminationBracket(size) : buildSingleEliminationBracket(size);
}
