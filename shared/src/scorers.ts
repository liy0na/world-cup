import type { Match, TopScorer } from './types';

/**
 * Aggregate goals into a Golden Boot table. Own goals are not credited to any
 * scorer; penalties count as goals (and are tracked separately for display).
 * Scorers are keyed by their stable player id where available, falling back to
 * team + name. Ranked by goals (desc); ties share a rank and are ordered by name.
 */
export function computeTopScorers(matches: Match[]): TopScorer[] {
  const acc = new Map<string, { playerId?: string; player: string; teamId: string; goals: number; penalties: number }>();
  // Appearances by player id (started or came on), de-duped per match.
  const appearances = new Map<string, number>();

  for (const m of matches) {
    for (const id of new Set(m.lineup ?? [])) appearances.set(id, (appearances.get(id) ?? 0) + 1);
    for (const g of m.goals ?? []) {
      if (g.kind === 'own') continue; // own goals are not credited to a scorer
      const key = g.playerId ?? `${g.teamId}:${g.player}`;
      const cur = acc.get(key) ?? { playerId: g.playerId, player: g.player, teamId: g.teamId, goals: 0, penalties: 0 };
      cur.goals += 1;
      if (g.kind === 'penalty') cur.penalties += 1;
      if (g.player) cur.player = g.player; // prefer a non-empty name if a later goal has one
      acc.set(key, cur);
    }
  }

  const sorted = [...acc.values()].sort((a, b) => b.goals - a.goals || a.player.localeCompare(b.player));

  const rows: TopScorer[] = [];
  let rank = 0;
  let prevGoals = -1;
  sorted.forEach((s, i) => {
    if (s.goals !== prevGoals) {
      rank = i + 1; // standard competition ranking (ties share a rank)
      prevGoals = s.goals;
    }
    rows.push({ rank, ...s, matchesPlayed: s.playerId ? (appearances.get(s.playerId) ?? 0) : 0 });
  });
  return rows;
}
