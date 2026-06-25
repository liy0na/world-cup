import { useEffect, useMemo, useState } from 'react';
import { computeScenarioGrid, type GridScoreline, type GroupLetter, type Match } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';

interface Props {
  group: string;
  teams: TeamMap;
  matches: Match[];
}

/** Final-position colours, matching the legend (dark green → light green → yellow → pink). */
const RANK_BG: Record<number, string> = { 1: '#2f7d34', 2: '#86b94b', 3: '#efcb4a', 4: '#cc5d7e' };
/** Readable text colour over each rank's fill. */
const RANK_TEXT: Record<number, string> = { 1: '#f8fafc', 2: '#0a0e16', 3: '#0a0e16', 4: '#f8fafc' };
const HATCH = 'repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0 1px, transparent 1px 4px)';

// Fixed label gutters (px). Data cells are sized fluidly (see `cellSize`) so the
// whole matrix fits the viewport width on a phone instead of scrolling sideways.
const COL_GROUP = 16; // height of the "TEAM WINS" header band
const ROW_GROUP = 14; // width of the rotated row-group band
// The scoreline-label gutters (--rl width / --cl height) and the cell-fit reserve
// (--reserve) are set responsively on the grid container so the matrix fits the
// viewport at both the phone (0–3, 16 cols) and desktop (0–4, 25 cols) sizes.

/** True below Tailwind's `sm` breakpoint (640px) — kept in sync with the `sm:` classes. */
function useIsNarrow(): boolean {
  const query = '(max-width: 639px)';
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/** Contiguous runs of equal result (team1 win / draw / team2 win) within an axis. */
function resultRuns(line: GridScoreline[]): { result: GridScoreline['result']; start: number; end: number }[] {
  const runs: { result: GridScoreline['result']; start: number; end: number }[] = [];
  for (let i = 0; i < line.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.result === line[i]!.result) last.end = i;
    else runs.push({ result: line[i]!.result, start: i, end: i });
  }
  return runs;
}

export function ScenarioGrid({ group, teams, matches }: Props) {
  const { t, lang, num } = useI18n();
  // Phones get a smaller 0–3 grid (16×16) so the scoreline labels stay legible;
  // tablets/desktop use the full 0–4 grid (25×25).
  const narrow = useIsNarrow();
  const maxGoals = narrow ? 3 : 4;
  const grid = useMemo(
    () => computeScenarioGrid(group as GroupLetter, [...teams.values()], matches, maxGoals),
    [group, teams, matches, maxGoals],
  );
  const [focal, setFocal] = useState<string | undefined>(undefined);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  // Finish distribution (counts per position 1..4) for every team in the group.
  const distByTeam = useMemo(() => {
    const out: Record<string, number[]> = {};
    if (!grid) return out;
    const tids = [grid.col.team1, grid.col.team2, grid.row.team1, grid.row.team2];
    for (const id of tids) out[id] = [0, 0, 0, 0, 0];
    for (const rowCells of grid.cells)
      for (const cell of rowCells) for (const id of tids) out[id]![cell.ranks[id] ?? 0]!++;
    return out;
  }, [grid]);

  // Default focus = the team whose finish is least certain (highest entropy over
  // its position distribution), so the grid opens colourful and informative
  // rather than on a team locked into one place (all one colour).
  const mostContested = useMemo(() => {
    if (!grid) return undefined;
    const total = grid.cols.length * grid.rows.length;
    let best: string | undefined;
    let bestEntropy = -1;
    for (const [id, d] of Object.entries(distByTeam)) {
      let h = 0;
      for (const c of d) if (c > 0) h -= (c / total) * Math.log(c / total);
      if (h > bestEntropy) {
        bestEntropy = h;
        best = id;
      }
    }
    return best;
  }, [grid, distByTeam]);

  if (!grid) return null;

  const order = [grid.col.team1, grid.col.team2, grid.row.team1, grid.row.team2];
  const activeFocal = focal && order.includes(focal) ? focal : mostContested ?? order[0]!;
  const dist = distByTeam[activeFocal] ?? [0, 0, 0, 0, 0];
  const total = grid.cols.length * grid.rows.length;
  // Square cells that fill the available width, capped at 16px. The reserve
  // (responsive, set on the container) covers page/card padding, the label
  // gutters and the 1px gridline gaps so the grid never overflows the viewport.
  const cellSize = `clamp(9px, calc((100vw - var(--reserve)) / ${grid.cols.length}), 16px)`;
  const code = (id: string) => teams.get(id)?.code ?? id;
  const sl = (s: GridScoreline) => `${num(s.s1)}–${num(s.s2)}`;
  const colRuns = resultRuns(grid.cols);
  const rowRuns = resultRuns(grid.rows);
  const hoverColResult = hover ? grid.cols[hover.c]!.result : null;
  const hoverRowResult = hover ? grid.rows[hover.r]!.result : null;
  const groupTeam = (result: GridScoreline['result'], team1: string, team2: string) =>
    result === 'team1' ? team1 : team2;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      {/* Header: group + focal-team selector */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-200">{t('group', { x: group })}</div>
        <div className="flex flex-wrap gap-1">
          {order.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFocal(id)}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                id === activeFocal
                  ? 'bg-slate-700 text-white ring-1 ring-emerald-500/50'
                  : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flag code={teams.get(id)?.code} />
              <span className="font-mono">{code(id)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend + finish distribution for the focal team */}
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        {[1, 2, 3, 4].map((r) => (
          <span key={r} className="flex items-center gap-1 text-slate-400">
            <span className="inline-block h-3 w-3 rounded-xs" style={{ backgroundColor: RANK_BG[r] }} />
            {t(`gridPos${r}`)}
            <span className="tabular-nums text-slate-500">{num(Math.round((dist[r]! / total) * 100))}%</span>
          </span>
        ))}
        <span className="flex items-center gap-1 text-slate-400">
          <span className="inline-block h-3 w-3 rounded-xs border border-slate-600" style={{ backgroundImage: HATCH }} />
          {t('gridTiebreak')}
        </span>
      </div>
      <div className="mb-3">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          {[1, 2, 3, 4].map((r) =>
            dist[r]! > 0 ? (
              <div key={r} style={{ width: `${(dist[r]! / total) * 100}%`, backgroundColor: RANK_BG[r] }} />
            ) : null,
          )}
        </div>
        <div className="mt-1 text-[10px] text-slate-600">
          {t('gridDistCaption', { team: teamName(teams.get(activeFocal), lang) || code(activeFocal), n: num(total) })}
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto" dir="ltr">
        <div
          className="grid w-max gap-px overflow-hidden rounded-md bg-slate-950/80 text-slate-300 ring-1 ring-slate-800 [--cl:28px] [--reserve:7.25rem] [--rl:24px] sm:[--cl:26px] sm:[--reserve:8.5rem] sm:[--rl:28px]"
          style={{
            gridTemplateColumns: `${ROW_GROUP}px var(--rl) repeat(${grid.cols.length}, ${cellSize})`,
            gridTemplateRows: `${COL_GROUP}px var(--cl) repeat(${grid.rows.length}, ${cellSize})`,
          }}
          onMouseLeave={() => setHover(null)}
        >
          {/* Top-left corner */}
          <div className="bg-slate-900/40" style={{ gridColumn: '1 / 3', gridRow: '1 / 3' }} />

          {/* Column group headers (col match: team1 wins / draw / team2 wins) */}
          {colRuns.map((run) => {
            const active = run.result === hoverColResult;
            return (
              <div
                key={`cg${run.start}`}
                className={`flex items-center justify-center gap-1 overflow-hidden whitespace-nowrap px-1 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  active ? 'bg-slate-700 text-white' : 'bg-slate-900/40 text-slate-300'
                }`}
                style={{ gridColumn: `${3 + run.start} / ${3 + run.end + 1}`, gridRow: '1 / 2' }}
              >
                {run.result !== 'draw' && <Flag code={code(groupTeam(run.result, grid.col.team1, grid.col.team2))} />}
                <span className="truncate">
                  {run.result === 'draw'
                    ? t('gridDraw')
                    : t('gridWins', { team: code(groupTeam(run.result, grid.col.team1, grid.col.team2)) })}
                </span>
              </div>
            );
          })}

          {/* Column scoreline labels: stacked upright digits on phones (rotated text
              is illegible in narrow columns), rotated "s1–s2" on tablet/desktop. */}
          {grid.cols.map((s, i) => (
            <div
              key={`cl${i}`}
              className={`flex items-center justify-center overflow-visible transition-colors ${
                hover?.c === i ? 'bg-slate-700' : 'bg-slate-900/40'
              }`}
              style={{ gridColumn: `${3 + i} / ${4 + i}`, gridRow: '2 / 3' }}
            >
              {narrow ? (
                <span
                  className={`flex flex-col items-center font-mono text-[9px] leading-[1.1] tabular-nums ${
                    hover?.c === i ? 'font-semibold text-white' : 'text-slate-400'
                  }`}
                >
                  <span>{num(s.s1)}</span>
                  <span className={hover?.c === i ? '' : 'text-slate-500'}>{num(s.s2)}</span>
                </span>
              ) : (
                <span
                  className={`origin-center -rotate-90 font-mono text-[9px] tabular-nums ${
                    hover?.c === i ? 'font-semibold text-white' : 'text-slate-400'
                  }`}
                >
                  {sl(s)}
                </span>
              )}
            </div>
          ))}

          {/* Row group headers (row match) */}
          {rowRuns.map((run) => {
            const active = run.result === hoverRowResult;
            return (
              <div
                key={`rg${run.start}`}
                className={`flex items-center justify-center overflow-hidden transition-colors ${
                  active ? 'bg-slate-700' : 'bg-slate-900/40'
                }`}
                style={{ gridColumn: '1 / 2', gridRow: `${3 + run.start} / ${3 + run.end + 1}` }}
              >
                <span
                  className={`origin-center -rotate-90 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${
                    active ? 'text-white' : 'text-slate-300'
                  }`}
                >
                  {run.result === 'draw'
                    ? t('gridDraw')
                    : t('gridWins', { team: code(groupTeam(run.result, grid.row.team1, grid.row.team2)) })}
                </span>
              </div>
            );
          })}

          {/* Row scoreline labels */}
          {grid.rows.map((s, i) => (
            <div
              key={`rl${i}`}
              className={`flex items-center justify-end pr-1 font-mono text-[9px] tabular-nums transition-colors ${
                hover?.r === i ? 'bg-slate-700 font-semibold text-white' : 'bg-slate-900/40 text-slate-400'
              }`}
              style={{ gridColumn: '2 / 3', gridRow: `${3 + i} / ${4 + i}` }}
            >
              {sl(s)}
            </div>
          ))}

          {/* Data cells */}
          {grid.rows.map((rs, r) =>
            grid.cols.map((cs, c) => {
              const cell = grid.cells[r]![c]!;
              const rank = cell.ranks[activeFocal] ?? 4;
              const hatched = cell.decidedByTiebreak.includes(activeFocal);
              const isHover = hover?.r === r && hover?.c === c;
              const inCross = !isHover && (hover?.r === r || hover?.c === c);
              return (
                <div
                  key={`${r}-${c}`}
                  className="cursor-crosshair"
                  onMouseEnter={() => setHover({ r, c })}
                  onClick={() => setHover({ r, c })}
                  style={{
                    gridColumn: `${3 + c} / ${4 + c}`,
                    gridRow: `${3 + r} / ${4 + r}`,
                    backgroundColor: RANK_BG[rank],
                    backgroundImage: hatched ? HATCH : undefined,
                    boxShadow: isHover ? 'inset 0 0 0 2px #f8fafc' : undefined,
                    filter: inCross ? 'brightness(1.22)' : undefined,
                    zIndex: isHover ? 2 : inCross ? 1 : undefined,
                  }}
                />
              );
            }),
          )}
        </div>
      </div>

      {/* Readout: the hovered scoreline and the focal team's resulting position */}
      <div className="mt-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {hover ? (
          (() => {
            const cs = grid.cols[hover.c]!;
            const rs = grid.rows[hover.r]!;
            const cell = grid.cells[hover.r]![hover.c]!;
            const rank = cell.ranks[activeFocal] ?? 4;
            return (
              <>
                <span className="font-mono text-slate-300">
                  {code(grid.col.team1)} {sl(cs)} {code(grid.col.team2)}
                </span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-300">
                  {code(grid.row.team1)} {sl(rs)} {code(grid.row.team2)}
                </span>
                <span className="text-slate-500">→</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                  style={{ backgroundColor: RANK_BG[rank], color: RANK_TEXT[rank] }}
                >
                  {code(activeFocal)} · {t(`gridPos${rank}`)}
                </span>
                {cell.decidedByTiebreak.includes(activeFocal) && (
                  <span className="text-slate-400">⟋ {t('gridTiebreak')}</span>
                )}
              </>
            );
          })()
        ) : (
          <span className="text-slate-500">{t('gridHover', { max: num(maxGoals) })}</span>
        )}
      </div>
    </div>
  );
}
