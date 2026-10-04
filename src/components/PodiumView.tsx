import { rankOtherEntrants, type PodiumEntrant } from "./podium-ranking";
import type { EnrichedMatch } from "../store";

type Entrant = PodiumEntrant;

type Props = {
  first: Entrant;
  second: Entrant;
  third: Entrant;
  showThird: boolean;
  entrants: Entrant[];
  matches: EnrichedMatch[];
  format: string;
  size: number;
  onNewTournament: () => void;
  onShare: () => void;
};

function labelFor(side: string, round: number, format: string, size: number) {
  if (side === "P2") return "2nd Place Match";
  if (side === "GF") return "Grand Final";
  if (side === "GF2") return "Reset Final";
  if (side === "3P") return "3rd Place";
  const totalRounds = Math.log2(size || 2);
  const remaining = totalRounds - round;
  if (format === "double" && side === "L") return `Losers R${round + 1}`;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round ${round + 1}`;
}

export function PodiumView({ first, second, third, showThird, entrants, matches, format, size, onNewTournament, onShare }: Props) {
  const standings = [
    { place: 1, e: first, medal: "🥇" },
    { place: 2, e: second, medal: "🥈" },
    ...(showThird ? [{ place: 3, e: third, medal: "🥉" }] : []),
  ].filter(s => s.e);

  const others = rankOtherEntrants(
    entrants.filter(e => e && ![first?.id, second?.id, third?.id].includes(e.id)),
    entrants,
    matches,
  );

  return (
    <div className="text-center">
      <style>{`
@keyframes confetti-fall { 0% { transform: translateY(-20px) rotate(0deg); opacity:1 } 100% { transform: translateY(420px) rotate(720deg); opacity:0 } }
@keyframes float-gold { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-6px) } }
@media (prefers-reduced-motion: reduce) { .celebration-piece, .champion-float { animation: none !important; } }
`}</style>
      <div className="bg-[var(--surface)] rounded-[28px] border border-[var(--border)] p-6 shadow-sm relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="celebration-piece"
              style={{
                position: "absolute",
                left: `${(i * 37) % 100}%`,
                top: `-20px`,
                fontSize: "14px",
                animation: `confetti-fall ${2.2 + (i % 5) * 0.45}s ease-in ${(i % 7) * 0.18}s infinite`,
              }}
            >
              {["🎉","✨","🎊","⭐","🌟"][i % 5]}
            </span>
          ))}
        </div>

        <p className="fredoka text-[17px] text-[var(--accent)] mb-1">Stuffy Battle Champion!</p>
        <div className="champion-float text-6xl mb-2" style={{ animation: "float-gold 2.2s ease-in-out infinite" }}>
          {first?.emoji ?? "🏆"}
        </div>
        <h2 className="fredoka text-3xl mb-1" style={{ color: "var(--accent)" }}>
          🥇 {first?.name ?? "Champion"}
        </h2>
        <p className="text-sm text-[var(--dim)] mb-5">Crowned winner</p>

        <div className="flex justify-center gap-6 sm:gap-10 text-sm mb-6">
          <div className="min-w-[96px]">
            <div className="text-3xl">{second?.emoji ?? "—"}</div>
            <div className="text-[11px] text-[var(--dim)] mt-1">🥈 Silver</div>
            <div className="font-semibold">{second?.name ?? "—"}</div>
          </div>
          {showThird && (
            <div className="min-w-[96px]">
              <div className="text-3xl">{third?.emoji ?? "—"}</div>
              <div className="text-[11px] text-[var(--dim)] mt-1">🥉 Bronze</div>
              <div className="font-semibold">{third?.name ?? "—"}</div>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={onNewTournament}
            className="px-5 py-3 rounded-[16px] bg-[var(--accent)] text-white fredoka text-[16px]"
          >
            New Tournament
          </button>
          <button
            onClick={onShare}
            className="px-5 py-3 rounded-[16px] border border-[var(--border)] text-sm"
          >
            Copy results
          </button>
        </div>
      </div>

      <div className="mt-4 bg-[var(--surface)] rounded-[20px] border border-[var(--border)] p-4 text-left">
        <p className="fredoka text-[16px] mb-2">Final standings</p>
        <ol className="space-y-2 text-sm">
          {standings.map(s => (
            <li key={s.place} className="flex items-center gap-3">
              <span className="w-9 text-center">{s.medal}</span>
              <span className="text-lg">{s.e?.emoji}</span>
              <span className="font-medium">{s.e?.name}</span>
            </li>
          ))}
          {others.map((e, idx) => e && (
            <li key={e.id} className="flex items-center gap-3 text-[var(--dim)]">
              <span className="w-9 text-center text-xs">#{standings.length + idx + 1}</span>
              <span>{e.emoji}</span>
              <span>{e.name}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4 bg-[var(--surface)] rounded-[20px] border border-[var(--border)] p-4 text-left text-sm">
        <p className="text-[var(--dim)] mb-2">Match results</p>
        <ul className="space-y-1 text-[var(--dim)]">
          {matches.filter(m=>m.winnerId && !m.isBye && m.entrantA && m.entrantB).map((m, i) => {
            const winner = m.entrantA?.id === m.winnerId ? m.entrantA : m.entrantB;
            const loser = m.entrantA?.id === m.winnerId ? m.entrantB : m.entrantA;
            return <li key={i}>{labelFor(m.bracketSide, m.roundNumber, format, size)}: {winner?.name} beat {loser?.name}</li>;
          })}
        </ul>
      </div>
    </div>
  );
}
