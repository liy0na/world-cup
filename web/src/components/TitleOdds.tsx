import type { TitleOdds as TitleOddsData } from '@wc/shared';
import { Flag } from '../lib/flags';
import { useI18n } from '../lib/i18n';
import { teamName } from '../lib/teamNames';
import type { TeamMap } from '../lib/teams';
import { OddsBar } from './OddsBar';

interface Props {
  title: TitleOddsData;
  teams: TeamMap;
}

/**
 * Ranked title-race panel: every team still in the bracket, ordered by its
 * Monte-Carlo chance of lifting the trophy. The bar shows champion %, with the
 * deeper-round breakdown (semi-final / final / champion) on hover.
 */
export function TitleOdds({ title, teams }: Props) {
  const { t, lang, num } = useI18n();
  const rows = Object.values(title.byTeam)
    .filter((o) => o.reachR16 > 0)
    .sort((a, b) => b.champion - a.champion || b.reachFinal - a.reachFinal || b.reachSF - a.reachSF);
  if (rows.length === 0) return null;

  const pct = (v: number) => num(Math.round(v * 100));

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200">
          🏆 {t('titleOddsTitle')}
          <span className="mx-2 text-[11px] font-normal text-slate-500">{t('titleOddsSubtitle')}</span>
        </h3>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2">
        {rows.map((o, i) => {
          const team = teams.get(o.teamId);
          return (
            <li
              key={o.teamId}
              className="flex items-center gap-2 border-t border-slate-800/40 px-3 py-1.5"
            >
              <span className="w-5 shrink-0 text-end text-xs tabular-nums text-slate-500">{num(i + 1)}</span>
              <Flag code={team?.code} />
              <span className="hidden w-9 shrink-0 font-mono text-[11px] text-slate-400 sm:inline">
                {team?.code ?? o.teamId}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                {teamName(team, lang) || o.teamId}
              </span>
              <OddsBar
                value={o.champion}
                className="w-16 shrink-0"
                title={t('titleBreakdown', { s: pct(o.reachSF), f: pct(o.reachFinal), c: pct(o.champion) })}
              />
            </li>
          );
        })}
      </ul>
      <p className="border-t border-slate-800/60 px-3 py-2 text-xs text-slate-500">
        {t('titleOddsModelNote', { n: num(title.iterations) })}
      </p>
    </section>
  );
}
