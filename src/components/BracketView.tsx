import type { EnrichedMatch, MatchEntrant } from "../store";

type BracketMatch = EnrichedMatch;

type Props = {
  matches: BracketMatch[];
  currentMatchId: number | null;
  format: "single" | "double";
  size: number;
  onClose?: () => void;
  nextLabel?: string | null;
  onNext?: () => void;
};

function winnersLabel(round: number, size: number) {
  const remaining = Math.log2(size) - round;
  if (remaining === 1) return "Winners final";
  if (remaining === 2) return "Winners semifinals";
  if (remaining === 3) return "Winners quarterfinals";
  return `Winners round ${round + 1}`;
}

function lowerLabel(round: number, maxRound: number) {
  if (round === maxRound) return "Losers final";
  if (round === 0) return "First elimination round";
  return `Losers round ${round + 1}`;
}

function PlayerRow({ entrant, won, dimmed }: { entrant: MatchEntrant; won: boolean; dimmed: boolean }) {
  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 text-[13px] leading-snug ${won ? "font-semibold" : dimmed ? "text-[var(--dim)]" : "text-[var(--text)]"}`}>
      <span className="flex min-w-0 items-center gap-2">
        <span aria-hidden>{entrant?.emoji ?? "·"}</span>
        <span className="truncate">{entrant?.name ?? "Waiting"}</span>
      </span>
      {won && <span className="text-[11px] text-[var(--sage)]" aria-label="Winner">✓</span>}
    </div>
  );
}

function MatchCard({ match, current }: { match: BracketMatch; current: boolean }) {
  const aWon = match.winnerId !== null && match.entrantA?.id === match.winnerId;
  const bWon = match.winnerId !== null && match.entrantB?.id === match.winnerId;
  const done = match.winnerId !== null;
  return (
    <div
      className={`rounded-[16px] border px-3 py-3 ${current ? "border-[var(--accent)] bg-[var(--current)] ring-2 ring-[var(--accent-soft)]" : "border-[var(--border)] bg-[var(--bg)]"}`}
      aria-current={current ? "step" : undefined}
    >
      <PlayerRow entrant={match.entrantA} won={aWon} dimmed={done && !aWon} />
      <div className="my-2 h-px bg-[var(--border)]" />
      {match.isBye ? (
        <div className="text-[12px] text-[var(--dim)]">Bye · advances automatically</div>
      ) : (
        <PlayerRow entrant={match.entrantB} won={bWon} dimmed={done && !bWon} />
      )}
      {current && <div className="mt-2 text-center text-[11px] font-semibold text-[var(--accent)]">Next battle</div>}
    </div>
  );
}

function BracketLane({
  title,
  description,
  rounds,
  currentMatchId,
  labels,
}: {
  title: string;
  description: string;
  rounds: BracketMatch[][];
  currentMatchId: number | null;
  labels: (round: number, maxRound: number) => string;
}) {
  if (!rounds.length) return null;
  const maxRound = Math.max(...rounds.flat().map((match) => match.roundNumber));
  return (
    <section className="bracket-lane" aria-label={title}>
      <div className="mb-3">
        <h4 className="fredoka text-[17px]">{title}</h4>
        <p className="text-[12px] text-[var(--dim)]">{description}</p>
      </div>
      <div className="space-y-3">
        {rounds.map((roundMatches) => {
          const round = roundMatches[0]!.roundNumber;
          return (
            <div key={round} className="rounded-[18px] bg-[var(--round)] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h5 className="text-[12px] font-semibold text-[var(--text)]">{labels(round, maxRound)}</h5>
                <span className="text-[11px] text-[var(--dim)]">{roundMatches.filter((match) => match.winnerId).length}/{roundMatches.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roundMatches.map((match) => <MatchCard key={match.id} match={match} current={match.id === currentMatchId} />)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function groupRounds(matches: BracketMatch[]) {
  const byRound = new Map<number, BracketMatch[]>();
  for (const match of matches.sort((a, b) => a.roundNumber - b.roundNumber || a.position - b.position)) {
    const round = byRound.get(match.roundNumber) ?? [];
    round.push(match);
    byRound.set(match.roundNumber, round);
  }
  return [...byRound.entries()].sort(([a], [b]) => a - b).map(([, round]) => round);
}

export function BracketView({ matches, currentMatchId, format, size, onClose, nextLabel, onNext }: Props) {
  const winnersRounds = groupRounds(matches.filter((match) => match.bracketSide === "W"));
  const losersRounds = groupRounds(matches.filter((match) => match.bracketSide === "L"));
  const grandFinal = matches.find((match) => match.bracketSide === "GF");
  const resetFinal = matches.find((match) => match.bracketSide === "GF2");

  return (
    <div className="rounded-[22px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="fredoka text-[19px]">Battle paths</h3>
          <p className="text-[12px] text-[var(--dim)]">A second loss ends a run.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onNext && nextLabel && (
            <button onClick={onNext} className="rounded-full bg-[var(--win)] px-3 py-2 text-xs font-medium text-white">{nextLabel}</button>
          )}
          {onClose && (
            <button onClick={onClose} className="rounded-full border border-[var(--border)] px-3 py-2 text-xs text-[var(--dim)]">Close</button>
          )}
        </div>
      </div>

      <BracketLane
        title="Winners bracket"
        description="Win and keep the clean path. Lose once and drop below."
        rounds={winnersRounds}
        currentMatchId={currentMatchId}
        labels={(round) => winnersLabel(round, size)}
      />

      {format === "double" && (
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <BracketLane
            title="Losers bracket"
            description="Each waiting slot has a fixed path—no reshuffling."
            rounds={losersRounds}
            currentMatchId={currentMatchId}
            labels={lowerLabel}
          />
        </div>
      )}

      {format === "double" && grandFinal && (
        <section className="mt-6 border-t border-[var(--border)] pt-5" aria-label="Championship finals">
          <div className="mb-3">
            <h4 className="fredoka text-[17px]">Championship</h4>
            <p className="text-[12px] text-[var(--dim)]">The unbeaten finalist gets two chances.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[12px] font-semibold">Grand final</div>
              <MatchCard match={grandFinal} current={grandFinal.id === currentMatchId} />
            </div>
            {resetFinal && (
              <div>
                <div className="mb-1.5 text-[12px] font-semibold">Reset final · if needed</div>
                <MatchCard match={resetFinal} current={resetFinal.id === currentMatchId} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
