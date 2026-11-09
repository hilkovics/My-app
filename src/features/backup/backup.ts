// Export / import of all data as JSON, plus .ics export of events.
import { notifyChange } from '../../db/changes';
import { SCHEMA_VERSION } from '../../db/schema';
import type { Db, Item, SqlParam } from '../../db/types';
import { parseRule, toIcsRule } from '../../lib/recurrence';
import { insertSampleTemplates } from '../templates/samples';
import { habitsToActivities, insertRows, type LegacyHabit, type LegacyHabitLog } from '../activities/legacy';

// Parents before children: rows are inserted in this order and deleted in reverse.
const TABLES = [
  'activities',
  'activity_logs',
  'goals',
  'projects',
  'templates',
  'items',
  'event_notes',
  'tags',
  'item_tags',
  'item_links',
  'external_links',
  'checklist_entries',
  'alerts',
  'focus_sessions',
  'settings',
] as const;

export interface Backup {
  app: 'planovac';
  schemaVersion: number;
  exportedAt: number;
  tables: Record<string, Record<string, SqlParam>[]>;
}

export async function exportBackup(db: Db): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const t of TABLES) tables[t] = await db.getAllAsync<Record<string, SqlParam>>(`SELECT * FROM ${t}`);
  // Scheduled OS notifications don't survive a restore on another device.
  tables.alerts = tables.alerts.map((a) => ({ ...a, notification_ids: '[]' }));
  return { app: 'planovac', schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), tables };
}

/** Replaces all data with the backup's content. */
export async function importBackup(db: Db, data: unknown): Promise<void> {
  const b = data as Backup;
  if (!b || b.app !== 'planovac' || typeof b.tables !== 'object') throw new Error('Súbor nie je záloha Plánovača.');
  if (b.schemaVersion > SCHEMA_VERSION) throw new Error('Záloha je z novšej verzie aplikácie.');
  const tables = { ...b.tables };
  // Backups from before activities (schema < 4) carry habits: convert them.
  if (tables.habits && !tables.activities) {
    const converted = habitsToActivities(
      tables.habits as unknown as LegacyHabit[],
      (tables.habit_logs ?? []) as unknown as LegacyHabitLog[],
    );
    tables.activities = converted.activities;
    tables.activity_logs = converted.logs;
  }
  await db.withTransactionAsync(async () => {
    for (const t of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${t}`);
    for (const t of TABLES) await insertRows(db, t, tables[t] ?? []);
    // Backups from before task states: derive the state of tasks; before templates: add the samples.
    await db.runAsync(
      "UPDATE items SET status = CASE WHEN completed_at IS NOT NULL THEN 'done' ELSE 'todo' END WHERE type = 'task' AND status IS NULL",
    );
    if (b.schemaVersion < 5) await insertSampleTemplates(db);
  });
  notifyChange();
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function icsDate(t: number): string {
  const d = new Date(t);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${z(d.getUTCMonth() + 1)}${z(d.getUTCDate())}T${z(d.getUTCHours())}${z(d.getUTCMinutes())}${z(d.getUTCSeconds())}Z`;
}

function icsDay(t: number): string {
  const d = new Date(t);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}`;
}

/** Folds lines longer than 75 octets (approximated by characters). */
function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? ' ' : '') + line.slice(i, i + 73));
  return parts.join('\r\n');
}

/** iCalendar export of events and time-blocked tasks. */
export function toIcs(items: Item[], now = Date.now()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planovac//SK', 'CALSCALE:GREGORIAN'];
  for (const it of items) {
    if (it.startAt == null || it.archived || it.type === 'note') continue;
    const end = it.endAt ?? it.startAt;
    lines.push('BEGIN:VEVENT', `UID:${it.id}@planovac`, `DTSTAMP:${icsDate(now)}`);
    if (it.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDay(it.startAt)}`, `DTEND;VALUE=DATE:${icsDay(end + 1)}`);
    } else {
      lines.push(`DTSTART:${icsDate(it.startAt)}`, `DTEND:${icsDate(end)}`);
    }
    lines.push(`SUMMARY:${icsEscape(it.title || '(bez názvu)')}`);
    if (it.body) lines.push(`DESCRIPTION:${icsEscape(it.body)}`);
    const rule = parseRule(it.rrule);
    if (rule) lines.push(`RRULE:${toIcsRule(rule)}`);
    if (it.tags.length) lines.push(`CATEGORIES:${it.tags.map(icsEscape).join(',')}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
