import type { Qualification, TeamOutlook, TeamStatus } from '@wc/shared';

export function statusOf(qualification: Qualification | undefined, teamId: string): TeamStatus | undefined {
  return qualification?.byTeam[teamId];
}

export function isClinched(outlook: TeamOutlook | undefined): boolean {
  return outlook === 'won_group' || outlook === 'advanced' || outlook === 'qualified_third';
}

export interface OutlookStyle {
  /** Left-border accent for a standings row. */
  accent: string;
  /** Compact marker shown next to the team name. */
  marker: string;
  markerClass: string;
  /** Tooltip / long label. */
  label: string;
}

export function outlookStyle(outlook: TeamOutlook | undefined, rank: number): OutlookStyle {
  switch (outlook) {
    case 'won_group':
      return { accent: 'border-emerald-400', marker: '✓', markerClass: 'text-emerald-300', label: 'Won group — through' };
    case 'advanced':
      return { accent: 'border-emerald-500', marker: '✓', markerClass: 'text-emerald-400', label: 'Qualified (top 2)' };
    case 'qualified_third':
      return { accent: 'border-teal-500', marker: '✓', markerClass: 'text-teal-400', label: 'Qualified (best third)' };
    case 'eliminated':
      return { accent: 'border-red-500', marker: '✗', markerClass: 'text-red-400', label: 'Eliminated' };
    default:
      // Still alive — keep a subtle hint of the current position.
      return {
        accent: rank <= 2 ? 'border-emerald-500/25' : rank === 3 ? 'border-amber-500/40' : 'border-transparent',
        marker: '',
        markerClass: '',
        label: 'In contention',
      };
  }
}

/** Text colour for a team's name in the bracket (green once qualification is clinched). */
export function bracketNameClass(outlook: TeamOutlook | undefined): string {
  if (isClinched(outlook)) return 'text-emerald-300';
  if (outlook === 'eliminated') return 'text-red-400';
  return 'text-slate-100';
}
