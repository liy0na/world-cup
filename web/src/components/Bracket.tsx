import type { Bracket as BracketType, BracketMatch, SlotRef } from '@wc/shared';
import { isResolved, slotCode, slotName, type TeamMap } from '../lib/teams';

interface Props {
  bracket: BracketType;
  teams: TeamMap;
}

const ROUNDS: { key: keyof BracketType; title: string }[] = [
  { key: 'r32', title: 'Round of 32' },
  { key: 'r16', title: 'Round of 16' },
  { key: 'qf', title: 'Quarter-finals' },
  { key: 'sf', title: 'Semi-finals' },
  { key: 'final', title: 'Final' },
];

function SlotRow({ slot, teams, score }: { slot: SlotRef; teams: TeamMap; score?: number }) {
  const resolved = isResolved(slot);
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[10px] text-slate-500 w-8 shrink-0">
          {resolved ? slotCode(slot, teams) : ''}
        </span>
        <span className={`truncate text-[13px] ${resolved ? 'text-slate-100' : 'italic text-slate-500'}`}>
          {slotName(slot, teams)}
        </span>
      </div>
      <span className="tabular-nums text-[13px] text-slate-300">
        {typeof score === 'number' ? score : ''}
      </span>
    </div>
  );
}

function MatchCard({ match, teams }: { match: BracketMatch; teams: TeamMap }) {
  const live = match.status === 'live';
  return (
    <div
      className={`w-52 rounded-lg border bg-slate-900/50 ${
        live ? 'border-red-500/50' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between px-2 pt-1 text-[9px] uppercase tracking-wider text-slate-600">
        <span>M{match.matchNumber}</span>
        {live && <span className="text-red-400">live</span>}
      </div>
      <SlotRow slot={match.home} teams={teams} score={match.homeScore} />
      <div className="border-t border-slate-800/60" />
      <SlotRow slot={match.away} teams={teams} score={match.awayScore} />
    </div>
  );
}

export function Bracket({ bracket, teams }: Props) {
  return (
    <section>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-5 min-w-max">
          {ROUNDS.map(({ key, title }) => {
            const matches = bracket[key];
            return (
              <div key={key} className="flex flex-col">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {title}
                </h3>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {matches.map((m) => (
                    <MatchCard key={m.matchNumber} match={m} teams={teams} />
                  ))}
                </div>
              </div>
            );
          })}
          {/* Third-place match alongside the final. */}
          <div className="flex flex-col">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Third place
            </h3>
            <div className="flex flex-1 flex-col justify-around">
              {bracket.third.map((m) => (
                <MatchCard key={m.matchNumber} match={m} teams={teams} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
