export type PodiumEntrant = { id: number; name: string; emoji: string } | null;

export type PodiumMatch = {
  entrantA: PodiumEntrant;
  entrantB: PodiumEntrant;
  winnerId: number | null;
  isBye: boolean;
};

type Record = { wins: number; losses: number };

export function rankOtherEntrants(
  others: PodiumEntrant[],
  entrants: PodiumEntrant[],
  matches: PodiumMatch[],
): Exclude<PodiumEntrant, null>[] {
  const seedOrder = new Map<number, number>();
  entrants.forEach((entrant, index) => {
    if (entrant) seedOrder.set(entrant.id, index);
  });

  const records = new Map<number, Record>();
  for (const entrant of entrants) {
    if (entrant) records.set(entrant.id, { wins: 0, losses: 0 });
  }

  for (const match of matches) {
    if (match.isBye || match.winnerId === null) continue;

    const winnerRecord = records.get(match.winnerId);
    if (winnerRecord) winnerRecord.wins += 1;

    for (const entrant of [match.entrantA, match.entrantB]) {
      if (!entrant || entrant.id === match.winnerId) continue;
      const record = records.get(entrant.id);
      if (record) record.losses += 1;
    }
  }

  return others
    .filter((entrant): entrant is Exclude<PodiumEntrant, null> => entrant !== null)
    .sort((a, b) => {
      const aRecord = records.get(a.id) ?? { wins: 0, losses: 0 };
      const bRecord = records.get(b.id) ?? { wins: 0, losses: 0 };
      return (
        bRecord.wins - aRecord.wins ||
        aRecord.losses - bRecord.losses ||
        (seedOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (seedOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    });
}
