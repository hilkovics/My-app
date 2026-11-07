import { notifyChange } from '../../db/changes';
import type { Alert, ChecklistEntry, Db, Item, ItemInput, ItemType, SqlParam } from '../../db/types';
import { HOUR, endOfDay, roundUpMinutes, startOfDay, ymd } from '../../lib/dates';
import { newId } from '../../lib/id';
import { nextOccurrence, parseRule } from '../../lib/recurrence';

interface ItemRow {
  id: string;
  type: ItemType;
  title: string;
  body: string;
  color: string | null;
  pinned: number;
  archived: number;
  start_at: number | null;
  end_at: number | null;
  all_day: number;
  due_at: number | null;
  completed_at: number | null;
  priority: number;
  rrule: string | null;
  journal_date: string | null;
  created_at: number;
  updated_at: number;
  tags: string | null;
  event_start: number | null;
}

const SELECT_ITEMS = `
  SELECT i.*, (
    SELECT group_concat(t.name, char(31)) FROM item_tags it JOIN tags t ON t.id = it.tag_id
    WHERE it.item_id = i.id
  ) AS tags,
  (SELECT en.occurrence_start FROM event_notes en WHERE en.note_id = i.id) AS event_start
  FROM items i`;

function toItem(r: ItemRow): Item {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    color: r.color,
    pinned: !!r.pinned,
    archived: !!r.archived,
    startAt: r.start_at,
    endAt: r.end_at,
    allDay: !!r.all_day,
    dueAt: r.due_at,
    completedAt: r.completed_at,
    priority: r.priority,
    rrule: r.rrule,
    journalDate: r.journal_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    tags: r.tags ? r.tags.split('\u001f').sort((a, b) => a.localeCompare(b, 'sk')) : [],
    eventStart: r.event_start,
  };
}

const COLUMN_MAP: Record<string, string> = {
  type: 'type',
  title: 'title',
  body: 'body',
  color: 'color',
  pinned: 'pinned',
  archived: 'archived',
  startAt: 'start_at',
  endAt: 'end_at',
  allDay: 'all_day',
  dueAt: 'due_at',
  completedAt: 'completed_at',
  priority: 'priority',
  rrule: 'rrule',
  journalDate: 'journal_date',
};

function toParam(v: unknown): SqlParam {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  throw new Error(`Unsupported value ${String(v)}`);
}

async function query(db: Db, where: string, params: SqlParam[] = [], tail = ''): Promise<Item[]> {
  const rows = await db.getAllAsync<ItemRow>(`${SELECT_ITEMS} WHERE ${where} ${tail}`, ...params);
  return rows.map(toItem);
}

// ---------------------------------------------------------------- CRUD

export async function getItem(db: Db, id: string): Promise<Item | null> {
  const [item] = await query(db, 'i.id = ?', [id]);
  return item ?? null;
}

/** Items by id, in the given order (missing ids are skipped). */
export async function listByIds(db: Db, ids: string[]): Promise<Item[]> {
  if (!ids.length) return [];
  const items = await query(db, `i.id IN (${ids.map(() => '?').join(', ')})`, ids);
  const byId = new Map(items.map((i) => [i.id, i]));
  return ids.map((id) => byId.get(id)).filter((i): i is Item => !!i);
}

export async function createItem(db: Db, input: ItemInput, now = Date.now()): Promise<Item> {
  const id = newId();
  const values = normalizeTimes({ ...input });
  const cols = ['id', 'created_at', 'updated_at'];
  const params: SqlParam[] = [id, now, now];
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    const v = (values as Record<string, unknown>)[key];
    if (v !== undefined) {
      cols.push(col);
      params.push(toParam(v));
    }
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO items (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      ...params,
    );
    if (input.tags?.length) await writeTags(db, id, input.tags);
  });
  notifyChange([id]);
  return (await getItem(db, id))!;
}

export async function updateItem(
  db: Db,
  id: string,
  patch: Partial<Omit<Item, 'id' | 'createdAt' | 'updatedAt'>>,
  now = Date.now(),
): Promise<Item> {
  const sets: string[] = ['updated_at = ?'];
  const params: SqlParam[] = [now];
  for (const [key, col] of Object.entries(COLUMN_MAP)) {
    if (key in patch) {
      sets.push(`${col} = ?`);
      params.push(toParam((patch as Record<string, unknown>)[key]));
    }
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
    if (patch.tags) await writeTags(db, id, patch.tags);
  });
  notifyChange([id]);
  const item = await getItem(db, id);
  if (!item) throw new Error('Záznam neexistuje');
  return item;
}

export async function deleteItem(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM items WHERE id = ?', id);
  notifyChange([id]);
}

/** Events need start/end; keep end >= start. */
function normalizeTimes<T extends Partial<Item>>(v: T): T {
  if (v.type === 'event') {
    if (v.startAt == null) v.startAt = roundUpMinutes(Date.now(), 30);
    if (v.endAt == null || v.endAt < v.startAt) v.endAt = v.startAt + HOUR;
  }
  return v;
}

// ---------------------------------------------------------------- Conversion

/** Turns an item into another type, filling in sensible times. */
export async function convertItem(db: Db, id: string, type: ItemType, now = Date.now()): Promise<Item> {
  const item = await getItem(db, id);
  if (!item) throw new Error('Záznam neexistuje');
  const patch: Partial<Item> = { type };
  if (type === 'event') {
    const start = item.startAt ?? item.dueAt ?? roundUpMinutes(now, 30);
    patch.startAt = start;
    patch.endAt = item.endAt && item.endAt > start ? item.endAt : start + HOUR;
    patch.completedAt = null;
  } else if (type === 'task') {
    if (item.type === 'event') {
      patch.dueAt = item.startAt;
      patch.startAt = null;
      patch.endAt = null;
      patch.allDay = false;
    }
  } else if (type === 'note') {
    patch.completedAt = null;
  }
  return updateItem(db, id, patch, now);
}

// ---------------------------------------------------------------- Lists

export interface NoteFilter {
  tag?: string | null;
  text?: string;
  includeArchived?: boolean;
}

export async function listNotes(db: Db, f: NoteFilter = {}): Promise<Item[]> {
  const where = ["i.type = 'note'"];
  const params: SqlParam[] = [];
  if (!f.includeArchived) where.push('i.archived = 0');
  if (f.tag) {
    where.push(
      'EXISTS (SELECT 1 FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = i.id AND t.name = ? COLLATE NOCASE)',
    );
    params.push(f.tag);
  }
  if (f.text?.trim()) {
    where.push("(i.title LIKE ? ESCAPE '\\' OR i.body LIKE ? ESCAPE '\\')");
    const like = likePattern(f.text);
    params.push(like, like);
  }
  return query(db, where.join(' AND '), params, 'ORDER BY i.pinned DESC, i.updated_at DESC');
}

export async function listPinnedNotes(db: Db): Promise<Item[]> {
  return query(db, "i.type = 'note' AND i.pinned = 1 AND i.archived = 0", [], 'ORDER BY i.updated_at DESC');
}

export type TaskView = 'inbox' | 'today' | 'upcoming' | 'done';

export async function listTasks(db: Db, view: TaskView, now = Date.now()): Promise<Item[]> {
  const eod = endOfDay(now);
  const sod = startOfDay(now);
  const open = "i.type = 'task' AND i.archived = 0 AND i.completed_at IS NULL";
  switch (view) {
    case 'inbox':
      return query(db, `${open} AND i.due_at IS NULL AND i.start_at IS NULL`, [], 'ORDER BY i.priority DESC, i.created_at DESC');
    case 'today':
      return query(
        db,
        `${open} AND ((i.due_at IS NOT NULL AND i.due_at <= ?) OR (i.start_at IS NOT NULL AND i.start_at <= ?))`,
        [eod, eod],
        'ORDER BY COALESCE(i.start_at, i.due_at), i.priority DESC',
      ).then((items) => items.sort((a, b) => taskSortKey(a, sod) - taskSortKey(b, sod)));
    case 'upcoming':
      return query(
        db,
        `${open} AND (i.due_at > ? OR i.start_at > ?) AND NOT ((i.due_at IS NOT NULL AND i.due_at <= ?) OR (i.start_at IS NOT NULL AND i.start_at <= ?))`,
        [eod, eod, eod, eod],
        'ORDER BY COALESCE(i.start_at, i.due_at)',
      );
    case 'done':
      return query(db, "i.type = 'task' AND i.completed_at IS NOT NULL", [], 'ORDER BY i.completed_at DESC LIMIT 200');
  }
}

/** Overdue first (by time), then today's by time. */
function taskSortKey(t: Item, sod: number): number {
  const when = t.startAt ?? t.dueAt ?? 0;
  return when < sod ? when - 1e13 : when;
}

/** Open tasks without a time block (candidates for time-blocking). */
export async function listUnscheduledTasks(db: Db): Promise<Item[]> {
  return query(
    db,
    "i.type = 'task' AND i.archived = 0 AND i.completed_at IS NULL AND i.start_at IS NULL",
    [],
    'ORDER BY i.due_at IS NULL, i.due_at, i.priority DESC, i.created_at DESC',
  );
}

/**
 * Items that can appear in [from, to): events and time-blocked tasks (incl. recurring),
 * and tasks due in the range.
 */
export async function listTimedItems(db: Db, from: number, to: number): Promise<Item[]> {
  return query(
    db,
    `i.archived = 0 AND i.type <> 'note' AND (
      (i.start_at IS NOT NULL AND i.start_at < ? AND (i.rrule IS NOT NULL OR COALESCE(i.end_at, i.start_at) >= ?))
      OR (i.type = 'task' AND i.start_at IS NULL AND i.due_at IS NOT NULL AND (i.rrule IS NOT NULL OR i.due_at >= ?) AND i.due_at < ?)
    )`,
    [to, from, from, to],
    'ORDER BY COALESCE(i.start_at, i.due_at)',
  );
}

export async function listItemsWithAlerts(db: Db): Promise<Item[]> {
  return query(db, 'EXISTS (SELECT 1 FROM alerts a WHERE a.item_id = i.id)');
}

export async function listAllItems(db: Db): Promise<Item[]> {
  return query(db, '1 = 1', [], 'ORDER BY i.created_at');
}

// ---------------------------------------------------------------- Tasks

/**
 * Completes a task. Recurring tasks move to their next occurrence instead
 * (both the due date and the time block shift by the same amount).
 */
export async function toggleTaskDone(db: Db, id: string, now = Date.now()): Promise<Item> {
  const item = await getItem(db, id);
  if (!item) throw new Error('Záznam neexistuje');
  if (item.completedAt) return updateItem(db, id, { completedAt: null }, now);
  const rule = parseRule(item.rrule);
  const anchor = item.startAt ?? item.dueAt;
  if (rule && anchor != null) {
    // Next occurrence after the current one (and not in the past).
    let next = nextOccurrence(anchor, rule, anchor);
    while (next != null && next < startOfDay(now)) next = nextOccurrence(anchor, rule, next);
    if (next != null) {
      const shift = next - anchor;
      // The task now represents the next occurrence; the rule continues from there.
      return updateItem(
        db,
        id,
        {
          startAt: item.startAt != null ? item.startAt + shift : null,
          endAt: item.endAt != null ? item.endAt + shift : null,
          dueAt: item.dueAt != null ? item.dueAt + shift : null,
        },
        now,
      );
    }
  }
  return updateItem(db, id, { completedAt: now }, now);
}

/** Puts a task into the calendar at `start` for `minutes`. */
export async function scheduleTask(db: Db, id: string, start: number, minutes = 60): Promise<Item> {
  return updateItem(db, id, { startAt: start, endAt: start + minutes * 60_000, allDay: false });
}

export async function unscheduleTask(db: Db, id: string): Promise<Item> {
  return updateItem(db, id, { startAt: null, endAt: null });
}

// ---------------------------------------------------------------- Search

function likePattern(text: string): string {
  return `%${text.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function searchItems(db: Db, text: string, limit = 100): Promise<Item[]> {
  if (!text.trim()) return [];
  const like = likePattern(text);
  return query(
    db,
    `(i.title LIKE ? ESCAPE '\\' OR i.body LIKE ? ESCAPE '\\' OR EXISTS (
      SELECT 1 FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = i.id AND t.name LIKE ? ESCAPE '\\'
    ))`,
    [like, like, like],
    `ORDER BY i.archived, i.updated_at DESC LIMIT ${Math.floor(limit)}`,
  );
}

// ---------------------------------------------------------------- Tags

export function normalizeTags(names: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of names) {
    const name = raw.trim().replace(/^#/, '');
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

async function writeTags(db: Db, itemId: string, names: string[]): Promise<void> {
  await db.runAsync('DELETE FROM item_tags WHERE item_id = ?', itemId);
  for (const name of normalizeTags(names)) {
    await db.runAsync('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)', newId(), name);
    await db.runAsync(
      'INSERT OR IGNORE INTO item_tags (item_id, tag_id) SELECT ?, id FROM tags WHERE name = ? COLLATE NOCASE',
      itemId,
      name,
    );
  }
  await db.runAsync('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM item_tags)');
}

export async function listTags(db: Db, type?: ItemType): Promise<{ name: string; count: number }[]> {
  return db.getAllAsync<{ name: string; count: number }>(
    `SELECT t.name, COUNT(*) AS count FROM tags t
     JOIN item_tags it ON it.tag_id = t.id JOIN items i ON i.id = it.item_id
     WHERE i.archived = 0 ${type ? 'AND i.type = ?' : ''}
     GROUP BY t.id ORDER BY count DESC, t.name`,
    ...(type ? [type] : []),
  );
}

// ---------------------------------------------------------------- Links

export async function linkItems(db: Db, a: string, b: string): Promise<void> {
  if (a === b) return;
  const exists = await db.getFirstAsync(
    'SELECT 1 FROM item_links WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
    a,
    b,
    b,
    a,
  );
  if (!exists) await db.runAsync('INSERT INTO item_links (from_id, to_id, created_at) VALUES (?, ?, ?)', a, b, Date.now());
  notifyChange([a, b]);
}

export async function unlinkItems(db: Db, a: string, b: string): Promise<void> {
  await db.runAsync(
    'DELETE FROM item_links WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?)',
    a,
    b,
    b,
    a,
  );
  notifyChange([a, b]);
}

export async function listLinkedItems(db: Db, id: string): Promise<Item[]> {
  return query(
    db,
    `i.id IN (SELECT to_id FROM item_links WHERE from_id = ? UNION SELECT from_id FROM item_links WHERE to_id = ?)`,
    [id, id],
    'ORDER BY i.type, i.updated_at DESC',
  );
}

// ---------------------------------------------------------------- Device calendar links

export async function linkExternal(db: Db, itemId: string, calendarId: string | null, eventId: string): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO external_links (item_id, calendar_id, external_event_id) VALUES (?, ?, ?)',
    itemId,
    calendarId,
    eventId,
  );
  notifyChange([itemId]);
}

export async function listItemsForExternal(db: Db, eventId: string): Promise<Item[]> {
  return query(
    db,
    'i.id IN (SELECT item_id FROM external_links WHERE external_event_id = ?)',
    [eventId],
    'ORDER BY i.updated_at DESC',
  );
}

export async function getExternalLink(
  db: Db,
  itemId: string,
): Promise<{ calendarId: string | null; eventId: string } | null> {
  const row = await db.getFirstAsync<{ calendar_id: string | null; external_event_id: string }>(
    'SELECT calendar_id, external_event_id FROM external_links WHERE item_id = ? LIMIT 1',
    itemId,
  );
  return row ? { calendarId: row.calendar_id, eventId: row.external_event_id } : null;
}

/** Set of external event ids that have at least one linked note/item. */
export async function listLinkedExternalIds(db: Db): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ id: string }>('SELECT DISTINCT external_event_id AS id FROM external_links');
  return new Set(rows.map((r) => r.id));
}

// ---------------------------------------------------------------- Checklist

export async function listChecklist(db: Db, itemId: string): Promise<ChecklistEntry[]> {
  const rows = await db.getAllAsync<{ id: string; item_id: string; text: string; done: number; position: number }>(
    'SELECT * FROM checklist_entries WHERE item_id = ? ORDER BY position, rowid',
    itemId,
  );
  return rows.map((r) => ({ id: r.id, itemId: r.item_id, text: r.text, done: !!r.done, position: r.position }));
}

export async function addChecklistEntry(db: Db, itemId: string, text: string): Promise<void> {
  const max = await db.getFirstAsync<{ p: number | null }>(
    'SELECT MAX(position) AS p FROM checklist_entries WHERE item_id = ?',
    itemId,
  );
  await db.runAsync(
    'INSERT INTO checklist_entries (id, item_id, text, position) VALUES (?, ?, ?, ?)',
    newId(),
    itemId,
    text,
    (max?.p ?? -1) + 1,
  );
  notifyChange([itemId]);
}

export async function setChecklistDone(db: Db, entryId: string, done: boolean): Promise<void> {
  await db.runAsync('UPDATE checklist_entries SET done = ? WHERE id = ?', done ? 1 : 0, entryId);
  notifyChange();
}

export async function deleteChecklistEntry(db: Db, entryId: string): Promise<void> {
  await db.runAsync('DELETE FROM checklist_entries WHERE id = ?', entryId);
  notifyChange();
}

export async function checklistProgress(db: Db): Promise<Map<string, { done: number; total: number }>> {
  const rows = await db.getAllAsync<{ item_id: string; done: number; total: number }>(
    'SELECT item_id, SUM(done) AS done, COUNT(*) AS total FROM checklist_entries GROUP BY item_id',
  );
  return new Map(rows.map((r) => [r.item_id, { done: r.done, total: r.total }]));
}

// ---------------------------------------------------------------- Alerts

export async function listAlerts(db: Db, itemId: string): Promise<Alert[]> {
  const rows = await db.getAllAsync<{ id: string; item_id: string; offset_minutes: number; notification_ids: string }>(
    'SELECT * FROM alerts WHERE item_id = ? ORDER BY offset_minutes',
    itemId,
  );
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    offsetMinutes: r.offset_minutes,
    notificationIds: safeJsonArray(r.notification_ids),
  }));
}

/** Replaces the alert offsets (minutes before the item's time) of an item. */
export async function setAlerts(db: Db, itemId: string, offsets: number[]): Promise<void> {
  const wanted = [...new Set(offsets)].sort((a, b) => a - b);
  await db.withTransactionAsync(async () => {
    const placeholders = wanted.map(() => '?').join(', ');
    await db.runAsync(
      `DELETE FROM alerts WHERE item_id = ?${wanted.length ? ` AND offset_minutes NOT IN (${placeholders})` : ''}`,
      itemId,
      ...wanted,
    );
    for (const off of wanted) {
      await db.runAsync('INSERT OR IGNORE INTO alerts (id, item_id, offset_minutes) VALUES (?, ?, ?)', newId(), itemId, off);
    }
  });
  notifyChange([itemId]);
}

/** Stores scheduled OS notification ids (no change notification: bookkeeping only). */
export async function setAlertNotificationIds(db: Db, alertId: string, ids: string[]): Promise<void> {
  await db.runAsync('UPDATE alerts SET notification_ids = ? WHERE id = ?', JSON.stringify(ids), alertId);
}

function safeJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- Journal

/** Returns the diary note for a day, creating it on first use. */
export async function getOrCreateJournal(db: Db, day: number): Promise<Item> {
  const key = ymd(day);
  const [existing] = await query(db, 'i.journal_date = ?', [key]);
  if (existing) return existing;
  const d = new Date(day);
  return createItem(db, {
    type: 'note',
    title: `Denník ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`,
    journalDate: key,
    tags: ['denník'],
  });
}
