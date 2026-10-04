import { useEffect, useMemo, useRef, useState } from "react";
import { BracketView } from "./components/BracketView";
import { PodiumView } from "./components/PodiumView";
import {
  createTournament,
  enrichMatches,
  getCurrentMatch,
  getPlacings,
  loadState,
  reportMatchWinner,
  saveState,
  undoLastMatch,
  type SupportedSize,
  type TournamentState,
} from "./store";

const SIZES = [2,4,8,16,32] as const;
const EMOJIS = ["🧸","🦄","🐻","🐸","🐙","🦖","🐼","🐯","🦊","🐨","🐵","🦁","🐧","🐰","🐹","🦝","🦘","🦒","🐘","🦛","🦏","🐊","🦜","🦩","🐳","🦈","🐝","🦋","🐞","🦀","🐢","🦎"] as const;
const SAMPLE_NAMES = [
  ["Bear Hug", "Sir Quacks"],
  ["Bear Hug", "Sir Quacks", "Pancake", "Zappy"],
  ["Bear Hug","Sir Quacks","Pancake","Zappy","Mochi","Rex","Bubbles","Nimbus"],
  ["Bear Hug","Sir Quacks","Pancake","Zappy","Mochi","Rex","Bubbles","Nimbus","Tater","Gizmo","Peanut","Sprout","Comet","Waffles","Jelly","Boop"],
  ["Bear Hug","Sir Quacks","Pancake","Zappy","Mochi","Rex","Bubbles","Nimbus","Tater","Gizmo","Peanut","Sprout","Comet","Waffles","Jelly","Boop","Pickles","Doodle","Snickers","Marshmallow","Pudding","Biscuit","Noodle","Pepper","Sunny","Coco","Button","Twinkle","Fudge","Sprinkles","Zippy","Clover"],
];

function roundLabel(side: string, round: number, format: string, size: number) {
  if (side === "P2") return "2nd Place Match";
  if (side === "GF" || side === "GF2") return "Grand Final";
  if (side === "3P") return "3rd Place";
  const totalRounds = Math.log2(size);
  const remaining = totalRounds - round;
  if (format === "double" && side === "L") return `Losers R${round+1}`;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinals";
  if (remaining === 3) return "Quarterfinals";
  return `Round ${round+1}`;
}

export function App() {
  // Tournament state lives in localStorage (key "stuffy-bracket:v1") so a
  // tournament survives page reloads in this browser.
  const [tournament, setTournament] = useState<TournamentState | null>(() => loadState());

  const [viewMode, setViewMode] = useState<"battle" | "bracket">("battle");
  const [confirmReset, setConfirmReset] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = (next: TournamentState | null) => {
    setTournament(next);
    saveState(next);
  };

  const enriched = useMemo(() => (tournament ? enrichMatches(tournament) : []), [tournament]);
  const currentRaw = tournament ? getCurrentMatch(tournament) : null;
  const currentMatch = currentRaw ? enriched.find((m) => m.id === currentRaw.id) ?? null : null;
  const placings = useMemo(
    () => (tournament ? getPlacings(tournament) : { first: null, second: null, third: null }),
    [tournament],
  );

  // setup local state
  const [size, setSize] = useState<SupportedSize>(4);
  const [format, setFormat] = useState<"single"|"double">("single");
  const [thirdPlace, setThirdPlace] = useState(true);
  const [names, setNames] = useState<string[]>(["Bear Hug","Sir Quacks","Pancake","Zappy"]);

  const updateSize = (s: SupportedSize) => {
    setSize(s);
    const idx = SIZES.indexOf(s);
    const sample = SAMPLE_NAMES[idx] ?? Array.from({length:s},(_,i)=>`Stuffy ${i+1}`);
    setNames(sample.slice(0,s));
  };

  // when the tournament completes, the podium replaces the battle view
  useEffect(() => {
    if (tournament?.status === "complete") {
      setViewMode("battle");
    }
  }, [tournament?.status]);

  // reset view mode when a new tournament starts
  const prevInstance = useRef<number | null>(null);
  useEffect(() => {
    if (tournament && tournament.instanceId !== prevInstance.current) {
      prevInstance.current = tournament.instanceId;
      setViewMode("battle");
    }
    if (!tournament) prevInstance.current = null;
  }, [tournament]);

  const allNamesFilled = names.slice(0,size).every(n => n.trim().length > 0);

  const hasTournament = !!tournament;
  const isComplete = tournament?.status === "complete";
  const showThird = !!tournament && tournament.format === "double" && tournament.thirdPlace && !!placings.third;

  const startTournament = () => {
    setError(null);
    try {
      update(createTournament(size, format, thirdPlace, names.slice(0, size)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  };

  const onWinner = (matchId: number, winnerId: number) => {
    if (!tournament) return;
    try {
      update(reportMatchWinner(tournament, matchId, winnerId));
      setViewMode("bracket");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const onUndo = () => {
    if (!tournament) return;
    update(undoLastMatch(tournament));
  };

  const onReset = () => {
    update(null);
    setViewMode("battle");
    setConfirmReset(false);
    setShareNote(null);
  };

  const shareResults = async () => {
    if (!tournament) return;
    const text = `Stuffy Battle results!\n🥇 ${placings.first?.name ?? "—"}\n🥈 ${placings.second?.name ?? "—"}${showThird && placings.third ? `\n🥉 ${placings.third.name}` : ""}`;
    try {
      await navigator.clipboard.writeText(text);
      setShareNote("Results copied");
    } catch {
      setShareNote(text);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <main className="mx-auto max-w-[520px] px-4 pb-24 pt-6" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
        {!hasTournament && (
          <section className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 shadow-sm">
            <h1 className="fredoka text-2xl mb-1">Set up the bracket</h1>
            <p className="mb-4 text-sm text-[var(--dim)]">Name the combatants, then tap each battle’s winner.</p>
            <div className="mb-4">
              <p className="text-sm text-[var(--dim)] mb-2">How many stuffies?</p>
              <div className="flex flex-wrap gap-2">
                {SIZES.map(s => (
                  <button key={s} onClick={()=>updateSize(s)} aria-pressed={size === s} aria-label={`${s} combatants`}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition ${size===s ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'bg-[var(--bg)] border-[var(--border)] text-[var(--text)]'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <p className="text-sm text-[var(--dim)] mb-2">Format</p>
              <div className="flex gap-2">
                {(["single","double"] as const).map(f => (
                  <button key={f} onClick={()=>setFormat(f)} aria-pressed={format === f}
                    className={`px-4 py-2 rounded-full border text-sm font-medium capitalize ${format===f ? 'bg-[var(--accent-2)] border-[var(--accent-2)] text-[#2b2118]' : 'bg-[var(--bg)] border-[var(--border)]'}`}>
                    {f} elim
                  </button>
                ))}
              </div>
            </div>
            {format==="double" && (
              <label className="flex items-center gap-2 text-sm mb-4">
                <input aria-label="Track third place" type="checkbox" checked={thirdPlace} onChange={e=>setThirdPlace(e.target.checked)} />
                <span>Track 3rd place</span>
              </label>
            )}
            <div className="mb-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="fredoka text-lg">Starting matchups</h2>
                  <p className="text-sm text-[var(--dim)]">Each pair meets in round one, in this bracket order.</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--dim)]">{size / 2} matches</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                {Array.from({ length: size / 2 }, (_, matchIndex) => {
                  const firstIndex = matchIndex * 2;
                  const secondIndex = firstIndex + 1;
                  return (
                    <fieldset key={matchIndex} className="min-w-0 border-t border-[var(--border)] py-3">
                      <legend className="px-1 text-xs font-semibold text-[var(--dim)]">Match {matchIndex + 1}</legend>
                      <div className="space-y-2">
                        {[firstIndex, secondIndex].map((entrantIndex) => (
                          <label key={entrantIndex} className="flex min-w-0 items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                            <span className="text-xl" aria-hidden="true">{EMOJIS[entrantIndex]}</span>
                            <span className="sr-only">{entrantIndex === firstIndex ? "First" : "Second"} combatant</span>
                            <input
                              aria-label={`Match ${matchIndex + 1}, ${entrantIndex === firstIndex ? "first" : "second"} combatant name`}
                              value={names[entrantIndex] ?? ""}
                              onChange={e=>{ const n=[...names]; n[entrantIndex]=e.target.value; setNames(n); }}
                              placeholder={`Stuffy #${entrantIndex + 1}`}
                              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
                            />
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 text-xs text-[var(--dim)] mb-3">
              <button onClick={()=>{ const idx=SIZES.indexOf(size); const sample=SAMPLE_NAMES[idx]??[]; setNames(sample.slice(0,size));}}
                className="underline">Quick-fill sample names</button>
              <span>·</span>
              <button onClick={()=>setNames(Array(size).fill(""))} className="underline">Clear all</button>
            </div>
            <button
              disabled={!allNamesFilled}
              onClick={startTournament}
              className="w-full fredoka text-lg bg-[var(--win)] text-white rounded-[16px] py-3 disabled:opacity-40">
              Start Battle!
            </button>
            {!allNamesFilled && <p className="text-xs text-[var(--dim)] mt-2 text-center">Fill in all stuffy names to start</p>}
          </section>
        )}

        {hasTournament && isComplete && tournament && (
          <PodiumView
            first={placings.first}
            second={placings.second}
            third={placings.third}
            showThird={showThird}
            entrants={tournament.entrants.map(e => ({ id: e.id, name: e.name, emoji: e.emoji }))}
            matches={enriched}
            format={tournament.format}
            size={tournament.size}
            onNewTournament={onReset}
            onShare={shareResults}
          />
        )}

        {shareNote && (
          <div className="mt-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-sm" role="status">
            {shareNote}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-[14px] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </div>
        )}

        {hasTournament && !isComplete && tournament && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-[var(--dim)]">
                {currentMatch ? (
                  <>
                    {roundLabel(currentMatch.bracketSide, currentMatch.roundNumber, tournament.format, tournament.size)}
                    {currentMatch.bracketSide==="L" && " · losers"}
                  </>
                ) : (
                  "Bracket"
                )}
                <span className="ml-2">· {tournament.matches.filter(m=>m.winnerId).length} / {tournament.matches.length} done</span>
              </div>
              <button
                onClick={()=> setViewMode(viewMode === "battle" ? "bracket" : "battle")}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)]"
              >
                {viewMode === "battle" ? "View Bracket" : "Back to Battle"}
              </button>
            </div>

            {viewMode === "bracket" && (
              <BracketView
                matches={enriched}
                currentMatchId={currentRaw?.id ?? null}
                format={tournament.format as "single"|"double"}
                size={tournament.size}
                onClose={() => setViewMode("battle")}
                nextLabel={currentMatch ? "Next Battle →" : null}
                onNext={currentMatch ? () => setViewMode("battle") : undefined}
              />
            )}

            {viewMode === "battle" && currentMatch && (
              <div className="bg-[var(--surface)] rounded-[28px] border border-[var(--border)] p-5 shadow-sm text-center">
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="flex-1">
                    <div className="text-5xl mb-2">{currentMatch.entrantA?.emoji}</div>
                    <div className="fredoka text-xl">{currentMatch.entrantA?.name}</div>
                  </div>
                  <div className="fredoka text-2xl px-2" style={{color:"var(--accent)"}}>VS</div>
                  <div className="flex-1">
                    <div className="text-5xl mb-2">{currentMatch.entrantB?.emoji}</div>
                    <div className="fredoka text-xl">{currentMatch.entrantB?.name}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <button
                    onClick={()=>onWinner(currentMatch.id, currentMatch.entrantA!.id)}
                    className="bg-[var(--win)] text-white fredoka text-[17px] rounded-[16px] py-3">
                    {currentMatch.entrantA?.name} Wins!
                  </button>
                  <button
                    onClick={()=>onWinner(currentMatch.id, currentMatch.entrantB!.id)}
                    className="bg-[var(--win)] text-white fredoka text-[17px] rounded-[16px] py-3">
                    {currentMatch.entrantB?.name} Wins!
                  </button>
                </div>
                <div className="flex justify-center gap-4 mt-4 text-sm text-[var(--dim)]">
                  <button onClick={onUndo} className="underline disabled:opacity-40" disabled={tournament.matchLog.length===0}>Undo last</button>
                  <button onClick={()=>setConfirmReset(true)} className="underline">Reset</button>
                  <button onClick={()=> setViewMode("bracket")} className="underline">View Bracket</button>
                </div>
              </div>
            )}

            {viewMode === "battle" && !currentMatch && (
              <div>
                <BracketView
                  matches={enriched}
                  currentMatchId={null}
                  format={tournament.format as "single"|"double"}
                  size={tournament.size}
                />
                <div className="bg-[var(--surface)] rounded-[24px] border border-[var(--border)] p-5 text-center text-[var(--dim)] mt-4">
                  Waiting for next matchup… try undoing or resetting.
                  <div className="mt-3 flex justify-center gap-3 text-sm">
                    <button onClick={onUndo} className="underline">Undo</button>
                    <button onClick={()=>setConfirmReset(true)} className="underline">Reset</button>
                  </div>
                </div>
              </div>
            )}

            {confirmReset && (
              <div className="mt-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4" role="group" aria-label="Confirm reset tournament">
                <p className="font-medium">Start over?</p>
                <p className="mt-1 text-sm text-[var(--dim)]">This removes the current bracket and its results.</p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={onReset}
                    className="rounded-full bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white"
                  >
                    Reset tournament
                  </button>
                  <button onClick={() => setConfirmReset(false)} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm">Keep playing</button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
