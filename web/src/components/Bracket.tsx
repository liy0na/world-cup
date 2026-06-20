import type { ReactElement } from 'react';
import type { Bracket as BracketType, BracketMatch, Qualification, SlotRef } from '@wc/shared';
import { bracketNameClass } from '../lib/status';
import { isResolved, slotCode, slotName, type TeamMap } from '../lib/teams';

export interface KoResult {
  h?: number;
  a?: number;
  penH?: number;
  penA?: number;
  et?: boolean;
}

interface Props {
  bracket: BracketType;
  teams: TeamMap;
  qualification: Qualification;
  editable: boolean;
  results: Record<string, KoResult>;
  onChange: (matchId: string, patch: KoResult) => void;
}

const STAGE_LABEL: Record<BracketMatch['stage'], string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  third: 'Third place',
  final: 'Final',
};
const SHORT: Record<BracketMatch['stage'], string> = {
  r32: 'R32',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  third: '3rd',
  final: 'F',
};

const parseFeeder = (s: string): number | null => {
  const m = s.match(/^W(\d+)$/);
  return m ? Number(m[1]) : null;
};

const LINE = 'bg-slate-700';

/** The elbow connector joining a pair of feeder matches (left) to their parent match (right). */
function Connector() {
  return (
    <div className="relative w-8 self-stretch shrink-0">
      <span className={`absolute left-0 top-1/4 h-px w-1/2 ${LINE}`} />
      <span className={`absolute left-0 top-3/4 h-px w-1/2 ${LINE}`} />
      <span className={`absolute left-1/2 top-1/4 h-1/2 w-px ${LINE}`} />
      <span className={`absolute left-1/2 top-1/2 h-px w-1/2 ${LINE}`} />
    </div>
  );
}

function Num({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type="number"
      min={0}
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 rounded border border-slate-700 bg-slate-950 px-0.5 text-center text-[13px] tabular-nums text-slate-100 focus:border-emerald-500 focus:outline-none"
    />
  );
}

function SlotLine({
  slot,
  teams,
  qualification,
  score,
  isWinner,
  editable,
  onScore,
}: {
  slot: SlotRef;
  teams: TeamMap;
  qualification: Qualification;
  score: number | undefined;
  isWinner: boolean;
  editable: boolean;
  onScore: (v: string) => void;
}) {
  const resolved = isResolved(slot);
  const outlook = slot.teamId ? qualification.byTeam[slot.teamId]?.outlook : undefined;
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[10px] text-slate-500 w-8 shrink-0">
          {resolved ? slotCode(slot, teams) : ''}
        </span>
        <span
          className={`truncate text-[13px] ${
            resolved ? bracketNameClass(outlook) : 'italic text-slate-500'
          } ${isWinner ? 'font-semibold' : ''}`}
        >
          {slotName(slot, teams)}
        </span>
        {isWinner && <span className="text-emerald-400 text-[11px]">✓</span>}
      </div>
      {editable && resolved ? (
        <Num value={score} onChange={onScore} label="score" />
      ) : (
        <span className="tabular-nums text-[13px] text-slate-300">
          {typeof score === 'number' ? score : ''}
        </span>
      )}
    </div>
  );
}

function MatchCard({
  match,
  teams,
  qualification,
  editable,
  result,
  onChange,
}: {
  match: BracketMatch;
  teams: TeamMap;
  qualification: Qualification;
  editable: boolean;
  result: KoResult | undefined;
  onChange: (matchId: string, patch: KoResult) => void;
}) {
  const id = `m${match.matchNumber}`;
  const live = match.status === 'live';
  const bothResolved = Boolean(match.home.teamId && match.away.teamId);
  // When editing, inputs reflect the draft; otherwise the computed match values.
  const hScore = editable ? result?.h : match.homeScore;
  const aScore = editable ? result?.a : match.awayScore;
  const level = typeof hScore === 'number' && hScore === aScore;
  const homeWins = match.winnerTeamId && match.winnerTeamId === match.home.teamId;
  const awayWins = match.winnerTeamId && match.winnerTeamId === match.away.teamId;

  return (
    <div
      className={`w-52 shrink-0 rounded-lg border bg-slate-900/60 ${
        live ? 'border-red-500/50' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between px-2 pt-1 text-[9px] uppercase tracking-wider text-slate-600">
        <span>
          {SHORT[match.stage]} · M{match.matchNumber}
        </span>
        <span className="flex items-center gap-1">
          {match.afterExtraTime && <span className="text-slate-500">a.e.t.</span>}
          {live && <span className="text-red-400">live</span>}
        </span>
      </div>
      <SlotLine
        slot={match.home}
        teams={teams}
        qualification={qualification}
        score={hScore}
        isWinner={Boolean(homeWins)}
        editable={editable && bothResolved}
        onScore={(v) => onChange(id, { h: v === '' ? undefined : Number(v) })}
      />
      <div className="border-t border-slate-800/60" />
      <SlotLine
        slot={match.away}
        teams={teams}
        qualification={qualification}
        score={aScore}
        isWinner={Boolean(awayWins)}
        editable={editable && bothResolved}
        onScore={(v) => onChange(id, { a: v === '' ? undefined : Number(v) })}
      />
      {/* Penalty + extra-time controls appear when a knockout match is level. */}
      {editable && bothResolved && level ? (
        <div className="flex items-center gap-2 border-t border-slate-800/60 px-2 py-1 text-[11px]">
          <span className="text-slate-500">pens</span>
          <Num value={result?.penH} onChange={(v) => onChange(id, { penH: v === '' ? undefined : Number(v) })} label="home penalties" />
          <span className="text-slate-600">–</span>
          <Num value={result?.penA} onChange={(v) => onChange(id, { penA: v === '' ? undefined : Number(v) })} label="away penalties" />
          <label className="ml-auto flex items-center gap-1 text-slate-500">
            <input
              type="checkbox"
              checked={Boolean(result?.et)}
              onChange={(e) => onChange(id, { et: e.target.checked })}
              className="accent-emerald-500"
            />
            a.e.t.
          </label>
        </div>
      ) : !editable && match.penalties ? (
        <div className="border-t border-slate-800/60 px-2 py-0.5 text-right text-[10px] text-slate-500">
          pens {match.penalties.home}–{match.penalties.away}
        </div>
      ) : null}
    </div>
  );
}

export function Bracket({ bracket, teams, qualification, editable, results, onChange }: Props) {
  const all = [...bracket.r32, ...bracket.r16, ...bracket.qf, ...bracket.sf, ...bracket.final, ...bracket.third];
  const byNumber = new Map(all.map((m) => [m.matchNumber, m]));

  const feeders = (m: BracketMatch): number[] => {
    const h = parseFeeder(m.home.source);
    const a = parseFeeder(m.away.source);
    return h !== null && a !== null ? [h, a] : [];
  };

  const cardProps = { teams, qualification, editable, onChange };

  // Recursive layout: a match sits to the right of its two feeder sub-trees,
  // vertically centred between them, with an elbow connector.
  const Node = ({ n }: { n: number }): ReactElement | null => {
    const m = byNumber.get(n);
    if (!m) return null;
    const fds = feeders(m);
    if (fds.length < 2) {
      return (
        <div className="my-1.5">
          <MatchCard match={m} result={results[`m${m.matchNumber}`]} {...cardProps} />
        </div>
      );
    }
    return (
      <div className="flex items-center">
        <div className="flex flex-col justify-center">
          <Node n={fds[0]!} />
          <Node n={fds[1]!} />
        </div>
        <Connector />
        <MatchCard match={m} result={results[`m${m.matchNumber}`]} {...cardProps} />
      </div>
    );
  };

  const rounds: BracketMatch['stage'][] = ['r32', 'r16', 'qf', 'sf', 'final'];
  const third = bracket.third[0];

  return (
    <section className="overflow-x-auto pb-4">
      <div className="min-w-max">
        {/* Round headers aligned to the columns (card 13rem + connector 2rem pitch). */}
        <div className="mb-2 flex gap-8">
          {rounds.map((s) => (
            <div key={s} className="w-52 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {STAGE_LABEL[s]}
            </div>
          ))}
        </div>
        <Node n={104} />
        {third && (
          <div className="mt-6 flex items-center gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {STAGE_LABEL.third}
            </span>
            <MatchCard match={third} result={results[`m${third.matchNumber}`]} {...cardProps} />
          </div>
        )}
      </div>
    </section>
  );
}
