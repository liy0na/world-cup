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

  // normalised team name -> teamId, built from the backbone roster.
  const nameToId = new Map<string, string>();
  for (const t of schedule.teams) nameToId.set(normaliseName(t.name), t.id);

  // index of not-finished fixtures by unordered team-id pair.
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const open = new Map<string, Match>();
  for (const m of schedule.matches) {
    if (m.status === 'finished') continue;
    if (m.home.teamId && m.away.teamId) open.set(pairKey(m.home.teamId, m.away.teamId), m);
  }

  const overlay = new Map<string, Partial<Match>>();
  for (const obs of live) {
    const hId = nameToId.get(normaliseName(obs.homeName));
    const aId = nameToId.get(normaliseName(obs.awayName));
    if (!hId || !aId) continue;
    const match = open.get(pairKey(hId, aId));
    if (!match) continue;
    // Orient the observed score to the fixture's home/away.
    const sameOrientation = match.home.teamId === hId;
    overlay.set(match.id, {
      status: obs.finished ? 'finished' : 'live',
      minute: obs.minute,
      homeScore: sameOrientation ? obs.homeScore : obs.awayScore,
      awayScore: sameOrientation ? obs.awayScore : obs.homeScore,
    });
  }

  if (overlay.size === 0) return schedule.matches;
  return schedule.matches.map((m) => (overlay.has(m.id) ? { ...m, ...overlay.get(m.id) } : m));
}
