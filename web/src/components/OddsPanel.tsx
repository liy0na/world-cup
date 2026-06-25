import type { AdvancementOdds, TeamOdds } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';
import { OddsBar } from './OddsBar';

interface Props {
  odds: AdvancementOdds | undefined;
  teams: TeamMap;
  loading: boolean;
}

/** Per-group advancement-odds cards (chance to reach the Round of 32). */
export function OddsPanel({ odds, teams, loading }: Props) {
  const { t, lang, num } = useI18n();

  if (!odds) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">{t('oddsTitle')}</h2>
        <p className="text-xs text-slate-500">{loading ? t('oddsLoading') : t('oddsUnavailable')}</p>
      </section>
    );
  }

  const byGroup = new Map<string, TeamOdds[]>();
  for (const o of Object.values(odds.byTeam)) {
    const list = byGroup.get(o.group) ?? [];
    list.push(o);
    byGroup.set(o.group, list);
  }
  const groups = [...byGroup.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [, list] of groups) list.sort((a, b) => b.advance - a.advance);

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
        {t('oddsTitle')} <span className="font-normal normal-case text-slate-600">· {t('oddsSubtitle')}</span>
        {loading && <span className="ms-2 font-normal normal-case text-slate-600">· {t('oddsLoading')}</span>}
      </h2>
      <p className="mb-3 max-w-3xl text-xs text-slate-500">{t('oddsModelNote', { n: num(odds.iterations) })}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map(([group, list]) => (
          <div key={group} className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60 text-sm font-semibold text-slate-200">
              {t('group', { x: group })}
            </div>
            <ul className="divide-y divide-slate-800/60">
              {list.map((o) => {
                const team = teams.get(o.teamId);
                return (
                  <li key={o.teamId} className="flex items-center gap-2 px-3 py-2">
                    <Flag code={team?.code} />
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{team?.code ?? o.teamId}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{teamName(team, lang) || o.teamId}</span>
                    <OddsBar
                      value={o.advance}
                      title={t('oddsBreakdown', {
                        w: num(Math.round(o.winGroup * 100)),
                        t: num(Math.round(o.topTwo * 100)),
                        b: num(Math.round(o.bestThird * 100)),
                      })}
                      className="w-24 shrink-0"
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
