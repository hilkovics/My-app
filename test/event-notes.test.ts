import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportBackup, importBackup } from '../src/features/backup/backup';
import { expandItems } from '../src/features/calendar/agenda';
import {
  createEventNote,
  eventRefFromOccurrence,
  getEventLinkForNote,
  getEventNote,
  listNotedOccurrenceKeys,
  listSeriesNotes,
  occurrenceNoteKey,
  tagForEvent,
} from '../src/features/items/event-notes';
import { createItem, deleteItem, listNotes, listTimedItems } from '../src/features/items/repository';
import { MIGRATIONS, SCHEMA_VERSION, migrate } from '../src/db/schema';
import { createMigratedDb, createNodeDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

async function weeklyLecture() {
  const db = await createMigratedDb();
  const lecture = await createItem(db, {
    type: 'event',
    title: 'Prednáška Matematika',
    startAt: at(2026, 11, 2, 10),
    endAt: at(2026, 11, 2, 11, 30),
    rrule: 'FREQ=WEEKLY',
  });
  const from = at(2026, 11, 1);
  const to = at(2026, 11, 20);
  const occ = expandItems(await listTimedItems(db, from, to), from, to);
  return { db, lecture, occ };
}

describe('event notes', () => {
  it('maps only events (local and phone) to note refs', async () => {
    const { occ } = await weeklyLecture();
    assert.deepEqual(eventRefFromOccurrence(occ[0]), {
      source: 'local',
      eventId: occ[0].id,
      occurrenceStart: at(2026, 11, 2, 10),
      title: 'Prednáška Matematika',
    });
    assert.equal(eventRefFromOccurrence({ ...occ[0], kind: 'block' }), null);
    assert.equal(eventRefFromOccurrence({ ...occ[0], kind: 'external' })?.source, 'device');
  });

  it('creates one note per occurrence, idempotently', async () => {
    const { db, occ } = await weeklyLecture();
    const ref = eventRefFromOccurrence(occ[0])!;
    assert.equal(await getEventNote(db, ref), null);
    const a = await createEventNote(db, ref, 'limity');
    const again = await createEventNote(db, ref, 'iný text');
    assert.equal(again.id, a.id);
    assert.equal(a.body, 'limity');
    assert.equal(a.title, 'Prednáška Matematika – 2. 11.');
    assert.deepEqual(a.tags, ['Prednáška-Matematika']);
    assert.equal(a.eventStart, at(2026, 11, 2, 10));
    assert.equal((await getEventNote(db, ref))?.id, a.id);
  });

  it('keeps separate notes for each lecture and lists the series newest first', async () => {
    const { db, lecture, occ } = await weeklyLecture();
    const first = await createEventNote(db, eventRefFromOccurrence(occ[0])!, 'týždeň 1');
    const second = await createEventNote(db, eventRefFromOccurrence(occ[1])!, 'týždeň 2');
    assert.notEqual(first.id, second.id);
    const series = await listSeriesNotes(db, 'local', lecture.id);
    assert.deepEqual(
      series.map((n) => n.body),
      ['týždeň 2', 'týždeň 1'],
    );
    assert.equal((await listSeriesNotes(db, 'device', lecture.id)).length, 0);
  });

  it('reports which occurrences have notes', async () => {
    const { db, lecture, occ } = await weeklyLecture();
    await createEventNote(db, eventRefFromOccurrence(occ[1])!);
    await createEventNote(db, { source: 'device', eventId: 'g-123', occurrenceStart: at(2026, 11, 5, 8), title: 'Seminár' });
    const keys = await listNotedOccurrenceKeys(db, at(2026, 11, 1), at(2026, 11, 20));
    assert.deepEqual(
      [...keys].sort(),
      [occurrenceNoteKey('device', 'g-123', at(2026, 11, 5, 8)), occurrenceNoteKey('local', lecture.id, at(2026, 11, 9, 10))].sort(),
    );
    assert.equal((await listNotedOccurrenceKeys(db, at(2026, 11, 10), at(2026, 11, 20))).size, 0);
  });

  it('links back from the note, survives event deletion and shows in notes list', async () => {
    const { db, lecture, occ } = await weeklyLecture();
    const note = await createEventNote(db, eventRefFromOccurrence(occ[0])!, 'x');
    assert.deepEqual(await getEventLinkForNote(db, note.id), {
      noteId: note.id,
      source: 'local',
      eventId: lecture.id,
      occurrenceStart: at(2026, 11, 2, 10),
      eventTitle: 'Prednáška Matematika',
    });
    await deleteItem(db, lecture.id);
    const notes = await listNotes(db);
    assert.deepEqual(
      notes.map((n) => n.id),
      [note.id],
    );
    await deleteItem(db, note.id);
    assert.equal(await getEventLinkForNote(db, note.id), null);
  });

  it('round-trips through a backup', async () => {
    const { db, lecture, occ } = await weeklyLecture();
    await createEventNote(db, eventRefFromOccurrence(occ[0])!, 'záloha');
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const db2 = await createMigratedDb();
    await importBackup(db2, backup);
    assert.deepEqual(
      (await listSeriesNotes(db2, 'local', lecture.id)).map((n) => n.body),
      ['záloha'],
    );
  });

  it('builds tags from titles', () => {
    assert.equal(tagForEvent('  Prednáška: Matematika 1 '), 'Prednáška-Matematika-1');
    assert.equal(tagForEvent('!!!'), null);
  });
});

describe('migration v1 → v2', () => {
  it('upgrades an existing v1 database without losing data', async () => {
    const db = createNodeDb();
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.execAsync(MIGRATIONS[0] as string);
    await db.execAsync('PRAGMA user_version = 1');
    await db.runAsync(
      "INSERT INTO items (id, type, title, created_at, updated_at) VALUES ('old', 'note', 'stará poznámka', 1, 1)",
    );
    await migrate(db);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
    assert.deepEqual(
      (await listNotes(db)).map((n) => [n.title, n.eventStart]),
      [['stará poznámka', null]],
    );
  });
});
