import type { SlotRef, Snapshot, Team } from '@wc/shared';

export type TeamMap = Map<string, Team>;

export function teamMap(snapshot: Snapshot): TeamMap {
  return new Map(snapshot.teams.map((t) => [t.id, t]));
}

/** Display name for a knockout/group slot: the resolved team name, else the slot label. */
export function slotName(slot: SlotRef, teams: TeamMap): string {
  if (slot.teamId) return teams.get(slot.teamId)?.name ?? slot.teamId;
  return slot.label;
}

export function slotCode(slot: SlotRef, teams: TeamMap): string {
  if (slot.teamId) return teams.get(slot.teamId)?.code ?? slot.teamId;
  return slot.label;
}

/** Whether a slot is resolved to an actual team (vs. an unresolved placeholder). */
export function isResolved(slot: SlotRef): boolean {
  return Boolean(slot.teamId);
}
