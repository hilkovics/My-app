import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createItem, deleteItem, getItem, toggleTaskDone } from '../src/features/items/repository';
import { restoreSnapshot, snapshotOf } from '../src/features/items/snapshot';
import { deleteSession, listSessions, restoreSession, startSession, stopSession } from '../src/features/focus/repository';
import { TOAST_DURATION_MS, toastReducer, type ToastState } from '../src/lib/toast-store';
import { createMigratedDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();

describe('undo: tasks', () => {
  it('completing a task and undoing restores the previous state', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'report', dueAt: at(2026, 11, 10, 9) });
    const before = snapshotOf(t);
    const done = await toggleTaskDone(db, t.id);
    assert.ok(done.completedAt != null);
    assert.equal(done.status, 'done');
    await restoreSnapshot(db, t.id, before);
    const back = (await getItem(db, t.id))!;
    assert.equal(back.completedAt, null);
    assert.equal(back.status, 'todo');
    assert.equal(back.dueAt, t.dueAt);
  });

  it('undoing a recurring task goes back to the original date and rule', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'smeti', dueAt: at(2026, 11, 10, 19), rrule: 'FREQ=WEEKLY' });
    const before = snapshotOf(t);
    const next = await toggleTaskDone(db, t.id, at(2026, 11, 10, 20));
    assert.notEqual(next.dueAt, t.dueAt, 'moved to the next occurrence');
    await restoreSnapshot(db, t.id, before);
    const back = (await getItem(db, t.id))!;
    assert.equal(back.dueAt, t.dueAt);
    assert.equal(back.rrule, t.rrule);
    assert.equal(back.completedAt, null);
  });

  it('undoing a quick-add deletes the created task', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'mlieko' });
    await deleteItem(db, t.id);
    assert.equal(await getItem(db, t.id), null);
  });

  it('undoing scheduling puts the dates back', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'zubár' });
    const before = snapshotOf(t);
    const { scheduleTask } = await import('../src/features/items/repository');
    const s = await scheduleTask(db, t.id, at(2026, 11, 10, 15), 30);
    assert.equal(s.startAt, at(2026, 11, 10, 15));
    await restoreSnapshot(db, t.id, before);
    const back = (await getItem(db, t.id))!;
    assert.equal(back.startAt, null);
    assert.equal(back.endAt, null);
  });
});

describe('undo: focus log', () => {
  it('a deleted session comes back with the same id and times', async () => {
    const db = await createMigratedDb();
    const t0 = at(2026, 11, 10, 9);
    await startSession(db, { mode: 'stopwatch' }, t0);
    const done = (await stopSession(db, t0 + 30 * 60_000))!;
    await deleteSession(db, done.id);
    assert.equal((await listSessions(db, t0 - 1, t0 + 86_400_000)).length, 0);
    await restoreSession(db, done);
    const list = await listSessions(db, t0 - 1, t0 + 86_400_000);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, done.id);
    assert.equal(list[0].startedAt, done.startedAt);
    assert.equal(list[0].endedAt, done.endedAt);
  });
});

describe('toast reducer', () => {
  const show = (state: ToastState | null, message: string) => toastReducer(state, { type: 'show', toast: { message, undo: null, durationMs: TOAST_DURATION_MS } });

  it('a new toast replaces the visible one and gets a new id', () => {
    const a = show(null, 'A')!;
    const b = show(a, 'B')!;
    assert.equal(b.message, 'B');
    assert.ok(b.id > a.id);
  });

  it('dismiss only affects the toast with that id', () => {
    const a = show(null, 'A')!;
    const b = show(a, 'B')!;
    assert.equal(toastReducer(b, { type: 'dismiss', id: a.id }), b, 'a stale timer must not close the newer toast');
    assert.equal(toastReducer(b, { type: 'dismiss', id: b.id }), null);
    assert.equal(toastReducer(b, { type: 'dismiss' }), null);
  });

  it('lasts 3.8 seconds', () => {
    assert.equal(TOAST_DURATION_MS, 3800);
  });
});
