/** Minimal async DB surface. Implemented by expo-sqlite's SQLiteDatabase and by a node:sqlite adapter in tests. */
export type SqlParam = string | number | null;

export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SqlParam[]): Promise<{ changes: number }>;
  getAllAsync<T>(source: string, ...params: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: SqlParam[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/**
 * One record type for everything:
 * - event: has startAt/endAt
 * - task:  optional dueAt, optional time block (startAt/endAt), completedAt
 * - note:  free text, optional journalDate (diary note for a day)
 * Reminders are alerts attached to any item that has a time.
 */
export type ItemType = 'event' | 'task' | 'note';

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  body: string;
  color: string | null;
  pinned: boolean;
  archived: boolean;
  startAt: number | null;
  endAt: number | null;
  allDay: boolean;
  dueAt: number | null;
  completedAt: number | null;
  priority: number;
  rrule: string | null;
  journalDate: string | null;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export type ItemInput = Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>> & { type: ItemType };

export interface ChecklistEntry {
  id: string;
  itemId: string;
  text: string;
  done: boolean;
  position: number;
}

export interface Alert {
  id: string;
  itemId: string;
  offsetMinutes: number;
  notificationIds: string[];
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** 7 chars, Monday first, '1' = scheduled that day. */
  days: string;
  targetPerDay: number;
  archived: boolean;
  createdAt: number;
}

export interface ExternalLink {
  itemId: string;
  calendarId: string | null;
  externalEventId: string;
}
