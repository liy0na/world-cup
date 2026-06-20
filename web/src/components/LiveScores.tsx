import type { Match } from '@wc/shared';
import { Flag } from '../lib/flags';
import { kickoffDay, kickoffLabel } from '../lib/format';
import { slotCode, slotName, type TeamMap } from '../lib/teams';

interface Props {
  matches: Match[];
  teams: TeamMap;
}

function MatchCard({ match, teams }: { match: Match; teams: TeamMap }) {
  const live = match.status === 'live';
  const finished = match.status === 'finished';
  const hasScore = typeof match.homeScore === 'number' && typeof match.awayScore === 'number';
  const tag = match.group ? `Group ${match.group}` : stageLabel(match);

  return (
    <div className="min-w-60 shrink-0 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between mb-2 text-[10px] uppercase tracking-wider">
        <span className="text-slate-500">{tag}</span>
        {live ? (
          <span className="flex items-center gap-1 text-red-400">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-red-500" />
            {match.minute ? `${match.minute}'` : 'LIVE'}
          </span>
        ) : finished ? (
          <span className="text-slate-500">FT</span>
        ) : (
          <span className="text-slate-500">
            {kickoffDay(match.kickoff)} · {kickoffLabel(match.kickoff)}
          </span>
        )}
      </div>
      <Row code={slotCode(match.home, teams)} name={slotName(match.home, teams)} score={match.homeScore} show={hasScore} live={live} />
      <Row code={slotCode(match.away, teams)} name={slotName(match.away, teams)} score={match.awayScore} show={hasScore} live={live} />
    </div>
  );
}

function Row({
  code,
  name,
  score,
  show,
  live,
}: {
  code: string;
  name: string;
  score?: number;
  show: boolean;
  live: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <Flag code={code} />
        <span className="font-mono text-[11px] text-slate-500 w-9">{code}</span>
        <span className="text-sm text-slate-200 truncate">{name}</span>
      </div>
      <span className={`tabular-nums text-sm font-semibold ${live ? 'text-red-300' : 'text-slate-100'}`}>
        {show ? score : '–'}
      </span>
    </div>
  );
}

function stageLabel(m: Match): string {
  return (
    {
      r32: 'Round of 32',
      r16: 'Round of 16',
      qf: 'Quarter-final',
      sf: 'Semi-final',
      third: 'Third place',
      final: 'Final',
      group: 'Group',
    } as const
  )[m.stage];
}

export function LiveScores({ matches, teams }: Props) {
  // Group-stage tracker; knockout fixtures live in the bracket (and would show
  // raw "1E / 3A/B/C/D/F" placeholders here until their teams are decided).
  const group = matches.filter((m) => m.stage === 'group');
  const live = group.filter((m) => m.status === 'live');
  const byKickoff = (a: Match, b: Match) => Date.parse(a.kickoff) - Date.parse(b.kickoff);
  const recent = group
    .filter((m) => m.status === 'finished')
    .sort(byKickoff)
    .slice(-6)
    .reverse();
  const upcoming = group.filter((m) => m.status === 'scheduled').sort(byKickoff).slice(0, 8);

  const ordered = [...live, ...recent, ...upcoming];
  if (ordered.length === 0) return null;

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          {live.length > 0 ? 'Live now' : 'Latest & upcoming'}
        </h2>
        {live.length > 0 && (
          <span className="text-xs text-red-400">{live.length} in play</span>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {ordered.map((m) => (
          <MatchCard key={m.id} match={m} teams={teams} />
        ))}
      </div>
    </section>
  );
}
