import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { exportBackup, importBackup, toIcs } from '../src/features/backup/backup';
import { expandItems, layoutDay } from '../src/features/calendar/agenda';
import { computeStreak } from '../src/features/habits/stats';
import { createHabit, getHabitLogs, logHabit } from '../src/features/habits/repository';
import {
  addChecklistEntry,
  convertItem,
  createItem,
  deleteItem,
  getItem,
  getOrCreateJournal,
  linkItems,
  listChecklist,
  listLinkedItems,
  listNotes,
  listTags,
  listTasks,
  listTimedItems,
  listUnscheduledTasks,
  scheduleTask,
  searchItems,
  setAlerts,
  listAlerts,
  toggleTaskDone,
  updateItem,
} from '../src/features/items/repository';
import { planAlerts } from '../src/features/notifications/plan';
import { getSettings, setSetting } from '../src/features/settings/repository';
import { ymd } from '../src/lib/dates';
import { createMigratedDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const NOW = at(2026, 11, 7, 10);

describe('items repository', () => {
  it('creates, updates, tags and deletes items', async () => {
    const db = await createMigratedDb();
    const note = await createItem(db, { type: 'note', title: 'Nápad', body: 'text', tags: ['Práca', '#práca', 'doma'] });
    assert.deepEqual(note.tags, ['doma', 'Práca']);
    const updated = await updateItem(db, note.id, { pinned: true, tags: ['doma'] });
    assert.equal(updated.pinned, true);
    assert.deepEqual(updated.tags, ['doma']);
    assert.deepEqual(await listTags(db), [{ name: 'doma', count: 1 }]);
    await deleteItem(db, note.id);
    assert.equal(await getItem(db, note.id), null);
  });

  it('fills event times and converts between types', async () => {
    const db = await createMigratedDb();
    const note = await createItem(db, { type: 'note', title: 'Zavolať' });
    const task = await convertItem(db, note.id, 'task', NOW);
    assert.equal(task.type, 'task');
    const event = await convertItem(db, task.id, 'event', NOW);
    // NOW is exactly 10:00, which is already on a half-hour boundary.
    assert.equal(event.startAt, at(2026, 11, 7, 10));
    assert.equal(event.endAt, at(2026, 11, 7, 11));
    const back = await convertItem(db, event.id, 'task', NOW);
    assert.equal(back.dueAt, at(2026, 11, 7, 10));
    assert.equal(back.startAt, null);
  });

  it('lists tasks by view', async () => {
    const db = await createMigratedDb();
    const inbox = await createItem(db, { type: 'task', title: 'inbox' });
    const overdue = await createItem(db, { type: 'task', title: 'overdue', dueAt: at(2026, 11, 5) });
    const today = await createItem(db, { type: 'task', title: 'today', dueAt: at(2026, 11, 7, 17) });
    const later = await createItem(db, { type: 'task', title: 'later', dueAt: at(2026, 11, 9) });
    const done = await createItem(db, { type: 'task', title: 'done', completedAt: NOW });
    const ids = async (v: Parameters<typeof listTasks>[1]) => (await listTasks(db, v, NOW)).map((t) => t.id);
    assert.deepEqual(await ids('inbox'), [inbox.id]);
    assert.deepEqual(await ids('today'), [overdue.id, today.id]);
    assert.deepEqual(await ids('upcoming'), [later.id]);
    assert.deepEqual(await ids('done'), [done.id]);
  });

  it('time-blocks tasks and shows them in the calendar range', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'report' });
    assert.equal((await listUnscheduledTasks(db)).length, 1);
    await scheduleTask(db, t.id, at(2026, 11, 9, 9), 90);
    assert.equal((await listUnscheduledTasks(db)).length, 0);
    const items = await listTimedItems(db, at(2026, 11, 9), at(2026, 11, 10));
    const occ = expandItems(items, at(2026, 11, 9), at(2026, 11, 10));
    assert.equal(occ.length, 1);
    assert.equal(occ[0].kind, 'block');
    assert.equal(occ[0].end - occ[0].start, 90 * 60_000);
  });

  it('includes recurring events that started before the range', async () => {
    const db = await createMigratedDb();
    await createItem(db, {
      type: 'event',
      title: 'joga',
      startAt: at(2026, 1, 5, 18),
      endAt: at(2026, 1, 5, 19),
      rrule: 'FREQ=WEEKLY',
    });
    const items = await listTimedItems(db, at(2026, 11, 9), at(2026, 11, 16));
    const occ = expandItems(items, at(2026, 11, 9), at(2026, 11, 16));
    assert.deepEqual(
      occ.map((o) => o.start),
      [at(2026, 11, 9, 18)],
    );
  });

  it('completing a recurring task moves it to the next occurrence', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'smeti', dueAt: at(2026, 11, 2, 19), rrule: 'FREQ=WEEKLY' });
    const after = await toggleTaskDone(db, t.id, NOW);
    assert.equal(after.completedAt, null);
    assert.equal(after.dueAt, at(2026, 11, 9, 19));
    const plain = await createItem(db, { type: 'task', title: 'raz' });
    assert.equal((await toggleTaskDone(db, plain.id, NOW)).completedAt, NOW);
    assert.equal((await toggleTaskDone(db, plain.id, NOW)).completedAt, null);
  });

  it('searches, filters notes, links items and keeps checklists', async () => {
    const db = await createMigratedDb();
    const a = await createItem(db, { type: 'note', title: 'Recept na 100% koláč', tags: ['varenie'] });
    const b = await createItem(db, { type: 'event', title: 'Večera', startAt: at(2026, 11, 8, 18) });
    assert.deepEqual((await searchItems(db, '100%')).map((i) => i.id), [a.id]);
    assert.deepEqual((await searchItems(db, 'varen')).map((i) => i.id), [a.id]);
    assert.equal((await listNotes(db, { tag: 'VARENIE' })).length, 1);
    await linkItems(db, a.id, b.id);
    await linkItems(db, b.id, a.id);
    assert.deepEqual((await listLinkedItems(db, b.id)).map((i) => i.id), [a.id]);
    await addChecklistEntry(db, a.id, 'múka');
    await addChecklistEntry(db, a.id, 'vajcia');
    assert.deepEqual((await listChecklist(db, a.id)).map((c) => c.text), ['múka', 'vajcia']);
  });

  it('journal note is unique per day', async () => {
    const db = await createMigratedDb();
    const j1 = await getOrCreateJournal(db, NOW);
    const j2 = await getOrCreateJournal(db, NOW);
    assert.equal(j1.id, j2.id);
    assert.equal(j1.journalDate, '2026-11-07');
  });

  it('stores alerts and plans their fire times', async () => {
    const db = await createMigratedDb();
    const e = await createItem(db, { type: 'event', title: 'porada', startAt: at(2026, 11, 7, 14), endAt: at(2026, 11, 7, 15) });
    await setAlerts(db, e.id, [15, 60, 15]);
    await setAlerts(db, e.id, [15, 1440]);
    const alerts = await listAlerts(db, e.id);
    assert.deepEqual(alerts.map((a) => a.offsetMinutes), [15, 1440]);
    const plan = planAlerts(e, [15, 1440], NOW);
    // 1 day before is already in the past and the event doesn't repeat.
    assert.deepEqual(plan, [{ offsetMinutes: 15, fireAt: at(2026, 11, 7, 13, 45), occurrence: at(2026, 11, 7, 14) }]);
    const weekly = await updateItem(db, e.id, { rrule: 'FREQ=WEEKLY' });
    const p2 = planAlerts(weekly, [1440], NOW);
    assert.equal(p2[0].occurrence, at(2026, 11, 14, 14));
  });
});

describe('habits', () => {
  it('logs and computes streaks', async () => {
    const db = await createMigratedDb();
    const h = await createHabit(db, { name: 'Voda', targetPerDay: 2 }, at(2026, 10, 1));
    for (const d of [4, 5, 6]) {
      await logHabit(db, h.id, ymd(at(2026, 11, d)), 2);
    }
    await logHabit(db, h.id, ymd(at(2026, 11, 3)), 1);
    const logs = (await getHabitLogs(db, '2026-10-01', '2026-11-30')).get(h.id);
    // Today (7th) not done yet: streak counts 4–6.
    assert.equal(computeStreak(h, logs, NOW), 3);
    await logHabit(db, h.id, ymd(NOW), 1);
    await logHabit(db, h.id, ymd(NOW), 1);
    await logHabit(db, h.id, ymd(NOW), -5);
    const logs2 = (await getHabitLogs(db, '2026-10-01', '2026-11-30')).get(h.id);
    assert.equal(logs2?.get('2026-11-07'), undefined);
  });

  it('skips unscheduled days in the streak', () => {
    // Weekdays only; Sat 7 Nov, Fri 6 and Thu 5 done.
    const h = { days: '1111100', targetPerDay: 1, createdAt: at(2026, 10, 1) };
    const logs = new Map([
      ['2026-11-05', 1],
      ['2026-11-06', 1],
    ]);
    assert.equal(computeStreak(h, logs, NOW), 2);
  });
});

describe('settings, backup, ics', () => {
  it('stores settings with defaults', async () => {
    const db = await createMigratedDb();
    assert.deepEqual((await getSettings(db)).defaultAlerts, [15]);
    await setSetting(db, 'deviceCalendarIds', ['a', 'b']);
    assert.deepEqual((await getSettings(db)).deviceCalendarIds, ['a', 'b']);
  });

  it('round-trips a backup', async () => {
    const db = await createMigratedDb();
    const n = await createItem(db, { type: 'note', title: 'zálohuj ma', tags: ['x'] });
    await setAlerts(db, n.id, [5]);
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const db2 = await createMigratedDb();
    await createItem(db2, { type: 'task', title: 'zmizne' });
    await importBackup(db2, backup);
    const notes = await listNotes(db2);
    assert.deepEqual(notes.map((x) => [x.title, x.tags]), [['zálohuj ma', ['x']]]);
    assert.equal((await searchItems(db2, 'zmizne')).length, 0);
    await assert.rejects(importBackup(db2, { foo: 1 }));
  });

  it('exports events to ics', async () => {
    const db = await createMigratedDb();
    await createItem(db, { type: 'event', title: 'A, B; C', startAt: at(2026, 11, 8, 15), endAt: at(2026, 11, 8, 16), rrule: 'FREQ=WEEKLY;BYDAY=SU' });
    const ics = toIcs(await listTimedItems(db, 0, at(2030, 1, 1)), NOW);
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /SUMMARY:A\\, B\\; C/);
    assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=SU/);
  });
});

describe('layoutDay', () => {
  it('places overlapping occurrences side by side', () => {
    const mk = (key: string, s: number, e: number) => ({
      key, kind: 'event' as const, id: key, title: key, start: s, end: e, allDay: false, color: null, done: false, recurring: false,
    });
    const out = layoutDay([mk('a', at(2026, 11, 7, 9), at(2026, 11, 7, 11)), mk('b', at(2026, 11, 7, 10), at(2026, 11, 7, 12)), mk('c', at(2026, 11, 7, 13), at(2026, 11, 7, 14))]);
    const byKey = Object.fromEntries(out.map((l) => [l.occ.key, [l.column, l.columns]]));
    assert.deepEqual(byKey, { a: [0, 2], b: [1, 2], c: [0, 1] });
  });
});
