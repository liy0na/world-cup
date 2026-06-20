import type { Match } from '@wc/shared';
import { normaliseName, type LiveObservation, type Schedule } from '../providers/provider';

/**
 * Overlay best-effort live observations onto the backbone fixtures. Each
 * observation is matched to a not-yet-finished fixture by the (normalised) pair
 * of team names, in either orientation. Unmatched observations are dropped, so a
 * flaky or differently-spelled live feed can never corrupt the schedule.
 */
export function mergeLive(schedule: Schedule, live: LiveObservation[]): Match[] {
  if (live.length === 0) return schedule.matches;

  // Resolve a live team by its FIFA 3-letter code first (robust across name
  // spellings, e.g. "Côte d'Ivoire" vs "Ivory Coast"), then by normalised name.
  const idSet = new Set(schedule.teams.map((t) => t.id));
  const nameToId = new Map<string, string>();
  for (const t of schedule.teams) nameToId.set(normaliseName(t.name), t.id);
  const resolve = (code: string | undefined, name: string): string | undefined =>
    (code && idSet.has(code) ? code : undefined) ?? nameToId.get(normaliseName(name));

  // index of not-finished fixtures by unordered team-id pair.
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const open = new Map<string, Match>();
  for (const m of schedule.matches) {
    if (m.status === 'finished') continue;
    if (m.home.teamId && m.away.teamId) open.set(pairKey(m.home.teamId, m.away.teamId), m);
  }

  const overlay = new Map<string, Partial<Match>>();
  for (const obs of live) {
    const hId = resolve(obs.homeCode, obs.homeName);
    const aId = resolve(obs.awayCode, obs.awayName);
    if (!hId || !aId) continue;
    const match = open.get(pairKey(hId, aId));
    if (!match) continue;
    // Orient the observed score (and any penalties) to the fixture's home/away.
    const sameOrientation = match.home.teamId === hId;
    const hasPens = typeof obs.penaltyHome === 'number' && typeof obs.penaltyAway === 'number';
    overlay.set(match.id, {
      status: obs.finished ? 'finished' : 'live',
      minute: obs.finished ? undefined : obs.minute,
      homeScore: sameOrientation ? obs.homeScore : obs.awayScore,
      awayScore: sameOrientation ? obs.awayScore : obs.homeScore,
      penalties: hasPens
        ? {
            home: (sameOrientation ? obs.penaltyHome : obs.penaltyAway) as number,
            away: (sameOrientation ? obs.penaltyAway : obs.penaltyHome) as number,
          }
        : undefined,
    });
  }

  if (overlay.size === 0) return schedule.matches;
  return schedule.matches.map((m) => (overlay.has(m.id) ? { ...m, ...overlay.get(m.id) } : m));
}
