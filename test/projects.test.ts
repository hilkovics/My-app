import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MIGRATIONS, SCHEMA_VERSION, migrate } from '../src/db/schema';
import type { Db } from '../src/db/types';
import { addManualLog, createActivity, listLogs } from '../src/features/activities/repository';
import { exportBackup, importBackup } from '../src/features/backup/backup';
import {
  convertItem,
  createItem,
  deleteItem,
  getItem,
  listBoardTasks,
  listProjectItems,
  setTaskStatus,
  toggleTaskDone,
  updateItem,
} from '../src/features/items/repository';
import {
  createGoal,
  createProject,
  deleteGoal,
  deleteProject,
  getProject,
  listGoals,
  listProjects,
  updateProject,
} from '../src/features/projects/repository';
import { fmtCountdown, fmtGoalValue, goalProgress, projectProgress } from '../src/features/projects/stats';
import { listTemplates } from '../src/features/templates/repository';
import { createMigratedDb, createNodeDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const NOW = at(2026, 11, 9, 12);

describe('migration v4 → v5', () => {
  it('derives task status from completion and adds sample templates', async () => {
    const db = createNodeDb();
    await db.execAsync('PRAGMA foreign_keys = ON;');
    for (const m of MIGRATIONS.slice(0, 3)) await db.execAsync(m as string);
    await db.execAsync('PRAGMA user_version = 3');
    await (MIGRATIONS[3] as (d: Db) => Promise<void>)(db);
    await db.execAsync('PRAGMA user_version = 4');
    await db.runAsync("INSERT INTO items (id, type, title, completed_at, created_at, updated_at) VALUES ('open', 'task', 'a', NULL, 1, 1)");
    await db.runAsync("INSERT INTO items (id, type, title, completed_at, created_at, updated_at) VALUES ('done', 'task', 'b', 5, 1, 1)");
    await db.runAsync("INSERT INTO items (id, type, title, created_at, updated_at) VALUES ('note', 'note', 'c', 1, 1)");
    await migrate(db);

    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    assert.equal(v?.user_version, SCHEMA_VERSION);
    assert.equal((await getItem(db, 'open'))?.status, 'todo');
    assert.equal((await getItem(db, 'done'))?.status, 'done');
    assert.equal((await getItem(db, 'note'))?.status, null);
    assert.deepEqual(
      (await listTemplates(db)).map((t) => t.name).sort(),
      ['Balenie na cestu', 'Koncert / vystúpenie', 'Nákupný zoznam', 'Porada', 'Týždenná revízia'].sort(),
    );
    assert.ok((await listTemplates(db)).every((t) => t.rrule == null), 'samples do not repeat');
  });
});

describe('task status', () => {
  it('moves tasks through the kanban states and keeps completion in sync', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'zavolať' });
    assert.equal(t.status, 'todo');
    assert.equal((await setTaskStatus(db, t.id, 'doing', undefined, NOW)).status, 'doing');
    const waiting = await setTaskStatus(db, t.id, 'waiting', 'Peter', NOW);
    assert.deepEqual([waiting.status, waiting.waitingFor], ['waiting', 'Peter']);
    const done = await setTaskStatus(db, t.id, 'done', undefined, NOW);
    assert.deepEqual([done.status, done.completedAt, done.waitingFor], ['done', NOW, null]);
    const reopened = await setTaskStatus(db, t.id, 'doing', undefined, NOW);
    assert.deepEqual([reopened.status, reopened.completedAt], ['doing', null]);
    await assert.rejects(setTaskStatus(db, (await createItem(db, { type: 'note', title: 'n' })).id, 'doing'));
  });

  it('toggling and plain completedAt updates keep status consistent', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'x' });
    assert.equal((await toggleTaskDone(db, t.id, NOW)).status, 'done');
    assert.equal((await toggleTaskDone(db, t.id, NOW)).status, 'todo');
    assert.equal((await updateItem(db, t.id, { completedAt: NOW })).status, 'done');
    assert.equal((await updateItem(db, t.id, { completedAt: null })).status, 'todo');
    const doing = await setTaskStatus(db, t.id, 'doing');
    assert.equal((await updateItem(db, doing.id, { title: 'y' })).status, 'doing', 'unrelated edits keep the state');
  });

  it('a recurring task completes into its next occurrence and returns to todo', async () => {
    const db = await createMigratedDb();
    const t = await createItem(db, { type: 'task', title: 'smeti', dueAt: at(2026, 11, 2, 19), rrule: 'FREQ=WEEKLY' });
    await setTaskStatus(db, t.id, 'doing', undefined, NOW);
    const next = await setTaskStatus(db, t.id, 'done', undefined, NOW);
    assert.deepEqual([next.status, next.completedAt, next.dueAt], ['todo', null, at(2026, 11, 9, 19)]);
  });

  it('sets the status when converting between types', async () => {
    const db = await createMigratedDb();
    const note = await createItem(db, { type: 'note', title: 'n' });
    assert.equal(note.status, null);
    const task = await convertItem(db, note.id, 'task', NOW);
    assert.equal(task.status, 'todo');
    await setTaskStatus(db, task.id, 'waiting', 'Anna', NOW);
    const event = await convertItem(db, task.id, 'event', NOW);
    assert.deepEqual([event.status, event.waitingFor], [null, null]);
  });

  it('groups the board, filters by project and drops tasks finished long ago', async () => {
    const db = await createMigratedDb();
    const p = await createProject(db, { name: 'Koncert' });
    const a = await createItem(db, { type: 'task', title: 'a', projectId: p.id, dueAt: at(2026, 11, 12) });
    const b = await createItem(db, { type: 'task', title: 'b', projectId: p.id, priority: 2 });
    const c = await createItem(db, { type: 'task', title: 'c' });
    const old = await createItem(db, { type: 'task', title: 'old' });
    const recent = await createItem(db, { type: 'task', title: 'recent' });
    await setTaskStatus(db, b.id, 'doing', undefined, NOW);
    await setTaskStatus(db, c.id, 'waiting', 'Peter', NOW);
    await setTaskStatus(db, old.id, 'done', undefined, NOW - 20 * 86_400_000);
    await setTaskStatus(db, recent.id, 'done', undefined, NOW - 2 * 86_400_000);
    const all = await listBoardTasks(db, {}, NOW);
    assert.deepEqual(all.todo.map((i) => i.id), [a.id]);
    assert.deepEqual(all.doing.map((i) => i.id), [b.id]);
    assert.deepEqual(all.waiting.map((i) => i.id), [c.id]);
    assert.deepEqual(all.done.map((i) => i.id), [recent.id], 'finished 20 days ago is hidden');
    const mine = await listBoardTasks(db, { projectId: p.id }, NOW);
    assert.deepEqual([...mine.todo, ...mine.doing, ...mine.waiting, ...mine.done].map((i) => i.id).sort(), [a.id, b.id].sort());
  });
});

describe('projects and goals', () => {
  it('computes project progress and the deadline countdown', async () => {
    const db = await createMigratedDb();
    const p = await createProject(db, { name: 'Web', deadline: at(2026, 11, 14) });
    await createItem(db, { type: 'task', title: '1', projectId: p.id, completedAt: NOW });
    await createItem(db, { type: 'task', title: '2', projectId: p.id, dueAt: at(2026, 11, 8) });
    await createItem(db, { type: 'task', title: '3', projectId: p.id, dueAt: at(2026, 11, 9) });
    await createItem(db, { type: 'task', title: '4', projectId: p.id, dueAt: at(2026, 11, 12) });
    await createItem(db, { type: 'note', title: 'poznámka', projectId: p.id });
    const items = await listProjectItems(db, p.id);
    assert.equal(items.length, 5);
    const prog = projectProgress(items, NOW);
    assert.deepEqual([prog.total, prog.done, prog.pct, prog.overdue], [4, 1, 25, 1], 'a date-only due today is not overdue yet');
    assert.equal(prog.nextDue, at(2026, 11, 8));
    assert.equal(projectProgress([], NOW).pct, 0);
    assert.equal(fmtCountdown(at(2026, 11, 14), NOW), 'o 5 dní');
    assert.equal(fmtCountdown(at(2026, 11, 10, 8), NOW), 'zajtra');
    assert.equal(fmtCountdown(at(2026, 11, 9, 23), NOW), 'dnes');
    assert.equal(fmtCountdown(at(2026, 11, 6), NOW), '3 dni po termíne');
    assert.equal(fmtCountdown(at(2026, 11, 8), NOW), '1 deň po termíne');
  });

  it('marking a project done stores the time; deleting keeps its items', async () => {
    const db = await createMigratedDb();
    const p = await createProject(db, { name: 'P' });
    assert.equal(p.colorSlot, 0);
    assert.equal((await createProject(db, { name: 'Q' })).colorSlot, 1);
    const t = await createItem(db, { type: 'task', title: 't', projectId: p.id });
    await updateProject(db, p.id, { status: 'done' }, NOW);
    assert.deepEqual([(await getProject(db, p.id))?.status, (await getProject(db, p.id))?.completedAt], ['done', NOW]);
    await updateProject(db, p.id, { status: 'active' });
    assert.equal((await getProject(db, p.id))?.completedAt, null);
    assert.deepEqual((await listProjects(db, 'active')).map((x) => x.name), ['P', 'Q']);
    await deleteProject(db, p.id);
    assert.equal((await getItem(db, t.id))?.projectId, null);
    await deleteItem(db, t.id);
  });

  it('derives a goal from its projects', async () => {
    const db = await createMigratedDb();
    const goal = await createGoal(db, { name: 'Koncert', kind: 'projects' });
    const a = await createProject(db, { name: 'A', goalId: goal.id });
    const b = await createProject(db, { name: 'B', goalId: goal.id });
    await createItem(db, { type: 'task', title: '1', projectId: a.id, completedAt: NOW });
    await createItem(db, { type: 'task', title: '2', projectId: a.id });
    await createItem(db, { type: 'task', title: '3', projectId: b.id, completedAt: NOW });
    await createItem(db, { type: 'task', title: '4', projectId: b.id });
    const items = [...(await listProjectItems(db, a.id)), ...(await listProjectItems(db, b.id))];
    const g = goalProgress(goal, { projectItems: items, logs: [] }, NOW);
    assert.deepEqual([g.value, g.target, g.pct, g.unit, g.expected, g.onTrack, g.reached], [2, 4, 50, 'tasks', null, true, false]);
    await deleteGoal(db, goal.id);
    assert.equal((await getProject(db, a.id))?.goalId, null);
    assert.equal((await listGoals(db)).length, 0);
  });

  it('derives a goal from an activity and compares it with the linear plan', async () => {
    const db = await createMigratedDb();
    const now = at(2026, 11, 16, 12); // 15.5 of 30 days of the period have passed
    const run = await createActivity(db, { name: 'Beh', kind: 'timed', trackDistance: true });
    const goal = await createGoal(db, {
      name: '50 km v novembri',
      kind: 'activity',
      activityId: run.id,
      metric: 'km',
      target: 50,
      startAt: at(2026, 11, 1),
      deadline: at(2026, 11, 30),
    });
    await addManualLog(db, { activityId: run.id, startedAt: at(2026, 10, 30, 7), minutes: 60, distanceKm: 12 }); // before the period
    await addManualLog(db, { activityId: run.id, startedAt: at(2026, 11, 3, 7), minutes: 50, distanceKm: 10 });
    await addManualLog(db, { activityId: run.id, startedAt: at(2026, 11, 7, 7), minutes: 40, distanceKm: 8 });
    const logs = () => listLogs(db, '2026-10-01', '2026-12-31', run.id);
    let g = goalProgress(goal, { projectItems: [], logs: await logs() }, now);
    assert.equal(g.value, 18);
    assert.equal(g.pct, 36);
    assert.ok(Math.abs(g.expected! - (50 * 15.5) / 30) < 1e-6);
    assert.equal(g.onTrack, false, '18 km is behind the ~25.8 km plan');
    await addManualLog(db, { activityId: run.id, startedAt: at(2026, 11, 15, 7), minutes: 60, distanceKm: 10 });
    g = goalProgress(goal, { projectItems: [], logs: await logs() }, now);
    assert.equal(g.onTrack, true);
    assert.equal(fmtGoalValue(g.value, g.unit), '28 km');

    const minutes = goalProgress({ ...goal, metric: 'minutes', target: 300 }, { projectItems: [], logs: await logs() }, now);
    assert.deepEqual([minutes.value, minutes.pct], [150, 50]);
    const sessions = goalProgress({ ...goal, metric: 'sessions', target: 4 }, { projectItems: [], logs: await logs() }, now);
    assert.deepEqual([sessions.value, sessions.reached], [3, false]);
    const done = goalProgress({ ...goal, target: 20 }, { projectItems: [], logs: await logs() }, now);
    assert.deepEqual([done.pct, done.reached], [100, true]);
  });

  it('round-trips through a backup and fixes up an older one', async () => {
    const db = await createMigratedDb();
    const goal = await createGoal(db, { name: 'G', kind: 'projects' });
    const p = await createProject(db, { name: 'P', goalId: goal.id });
    const t = await createItem(db, { type: 'task', title: 't', projectId: p.id });
    await setTaskStatus(db, t.id, 'waiting', 'Anna');
    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    const db2 = await createMigratedDb();
    await importBackup(db2, backup);
    const back = await getItem(db2, t.id);
    assert.deepEqual([back?.projectId, back?.status, back?.waitingFor], [p.id, 'waiting', 'Anna']);
    assert.equal((await getProject(db2, p.id))?.goalId, goal.id);
    assert.equal((await listTemplates(db2)).length, 5);

    // A v4 backup: tasks without status/project columns, no templates table content
    const db3 = await createMigratedDb();
    await importBackup(db3, {
      app: 'planovac',
      schemaVersion: 4,
      exportedAt: 0,
      tables: {
        items: [
          { id: 'x', type: 'task', title: 'x', completed_at: null, created_at: 1, updated_at: 1 },
          { id: 'y', type: 'task', title: 'y', completed_at: 9, created_at: 1, updated_at: 1 },
        ],
      },
    });
    assert.equal((await getItem(db3, 'x'))?.status, 'todo');
    assert.equal((await getItem(db3, 'y'))?.status, 'done');
    assert.equal((await listTemplates(db3)).length, 5, 'sample templates are added');
  });
});
