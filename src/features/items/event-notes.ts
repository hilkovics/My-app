// Notes attached to one concrete occurrence of an event (local or from the phone calendar).
// Each occurrence of a recurring event (e.g. a weekly lecture) gets its own note.
import { notifyChange } from '../../db/changes';
import type { Db, Item } from '../../db/types';
import type { Occurrence } from '../calendar/agenda';
import { createItem, getItem, listByIds } from './repository';

export type EventSource = 'local' | 'device';

export interface EventRef {
  source: EventSource;
  eventId: string;
  occurrenceStart: number;
  title: string;
}

export interface EventNoteLink {
  noteId: string;
  source: EventSource;
  eventId: string;
  occurrenceStart: number;
  eventTitle: string;
}

interface Row {
  note_id: string;
  source: EventSource;
  event_id: string;
  occurrence_start: number;
  event_title: string;
}

const toLink = (r: Row): EventNoteLink => ({
  noteId: r.note_id,
  source: r.source,
  eventId: r.event_id,
  occurrenceStart: r.occurrence_start,
  eventTitle: r.event_title,
});

/** Only events (local or phone) have notes; tasks open as tasks. */
export function eventRefFromOccurrence(occ: Occurrence): EventRef | null {
  if (occ.kind !== 'event' && occ.kind !== 'external') return null;
  return {
    source: occ.kind === 'event' ? 'local' : 'device',
    eventId: occ.id,
    occurrenceStart: occ.start,
    title: occ.title,
  };
}

export function occurrenceNoteKey(source: EventSource, eventId: string, start: number): string {
  return `${source}:${eventId}@${start}`;
}

export async function getEventNote(db: Db, ref: EventRef): Promise<Item | null> {
  const row = await db.getFirstAsync<{ note_id: string }>(
    'SELECT note_id FROM event_notes WHERE source = ? AND event_id = ? AND occurrence_start = ?',
    ref.source,
    ref.eventId,
    ref.occurrenceStart,
  );
  return row ? getItem(db, row.note_id) : null;
}

/** Tag derived from the event title, e.g. "Prednáška Matematika" → "Prednáška-Matematika". */
export function tagForEvent(title: string): string | null {
  const tag = title
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return tag || null;
}

/** Creates the note for an occurrence (or returns the existing one). */
export async function createEventNote(db: Db, ref: EventRef, body = ''): Promise<Item> {
  const existing = await getEventNote(db, ref);
  if (existing) return existing;
  const d = new Date(ref.occurrenceStart);
  const tag = tagForEvent(ref.title);
  const note = await createItem(db, {
    type: 'note',
    title: `${ref.title || 'Udalosť'} – ${d.getDate()}. ${d.getMonth() + 1}.`,
    body,
    tags: tag ? [tag] : [],
  });
  await db.runAsync(
    'INSERT INTO event_notes (note_id, source, event_id, occurrence_start, event_title) VALUES (?, ?, ?, ?, ?)',
    note.id,
    ref.source,
    ref.eventId,
    ref.occurrenceStart,
    ref.title,
  );
  notifyChange([note.id]);
  return (await getItem(db, note.id))!;
}

/** All notes of an event series, newest occurrence first. */
export async function listSeriesNotes(db: Db, source: EventSource, eventId: string): Promise<Item[]> {
  const rows = await db.getAllAsync<{ note_id: string }>(
    'SELECT note_id FROM event_notes WHERE source = ? AND event_id = ? ORDER BY occurrence_start DESC',
    source,
    eventId,
  );
  return listByIds(
    db,
    rows.map((r) => r.note_id),
  );
}

/** Keys (see occurrenceNoteKey) of occurrences in [from, to) that have a note. */
export async function listNotedOccurrenceKeys(db: Db, from: number, to: number): Promise<Set<string>> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM event_notes WHERE occurrence_start >= ? AND occurrence_start < ?',
    from,
    to,
  );
  return new Set(rows.map((r) => occurrenceNoteKey(r.source, r.event_id, r.occurrence_start)));
}

export async function getEventLinkForNote(db: Db, noteId: string): Promise<EventNoteLink | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM event_notes WHERE note_id = ?', noteId);
  return row ? toLink(row) : null;
}
