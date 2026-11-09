// Snapshots of the fields an action changes on a task, so a toast can undo it.
import type { Db, Item } from '../../db/types';
import { updateItem } from './repository';

export type TaskSnapshot = Pick<Item, 'status' | 'completedAt' | 'dueAt' | 'startAt' | 'endAt' | 'allDay' | 'waitingFor' | 'rrule'>;

/** The fields completing / moving / scheduling a task can touch (a recurring task shifts its dates and rule). */
export function snapshotOf(item: Item): TaskSnapshot {
  return {
    status: item.status,
    completedAt: item.completedAt,
    dueAt: item.dueAt,
    startAt: item.startAt,
    endAt: item.endAt,
    allDay: item.allDay,
    waitingFor: item.waitingFor,
    rrule: item.rrule,
  };
}

/** Puts the snapshot back (undo). */
export async function restoreSnapshot(db: Db, id: string, snap: TaskSnapshot): Promise<void> {
  await updateItem(db, id, { ...snap });
}
