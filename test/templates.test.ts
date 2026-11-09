import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createItem, getItem, listChecklist, listProjectItems, addChecklistEntry } from '../src/features/items/repository';
import { createProject, listProjects } from '../src/features/projects/repository';
import {
  applyTemplate,
  createTemplate,
  deleteTemplate,
  fillPlaceholders,
  getTemplate,
  listTemplates,
  restoreSamples,
  runDueTemplates,
  templateFromItem,
  templateFromProject,
  updateTemplate,
} from '../src/features/templates/repository';
import type { NotePayload, ProjectPayload, TaskPayload } from '../src/features/templates/types';
import { createMigratedDb } from './helpers/node-db';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
const NOW = at(2026, 11, 9, 12);

const named = async (db: Awaited<ReturnType<typeof createMigratedDb>>, name: string) => {
  const t = (await listTemplates(db)).find((x) => x.name === name);
  assert.ok(t, `template ${name}`);
  return t;
};

describe('applying templates', () => {
  it('creates a task with checklist, tags, due date and placeholder', async () => {
    const db = await createMigratedDb();
    const review = await named(db, 'Týždenná revízia');
    const p = await createProject(db, { name: 'Osobné' });
    const { kind, id } = await applyTemplate(db, review, { at: NOW, projectId: p.id });
    assert.equal(kind, 'task');
    const task = (await getItem(db, id))!;
    assert.equal(task.title, 'Týždenná revízia 9. 11.');
    assert.deepEqual(task.tags, ['revízia']);
    assert.equal(task.dueAt, at(2026, 11, 9), 'due today, date only');
    assert.equal(task.status, 'todo');
    assert.equal(task.projectId, p.id);
    assert.equal((await listChecklist(db, id)).length, 5);
  });

  it('creates a note and applies due offsets', async () => {
    const db = await createMigratedDb();
    const meeting = await named(db, 'Porada');
    const note = (await getItem(db, (await applyTemplate(db, meeting, { at: NOW })).id))!;
    assert.deepEqual([note.type, note.title, note.tags], ['note', 'Porada 9. 11.', ['porada']]);
    assert.match(note.body, /Rozhodnutia/);
    const packing = await named(db, 'Balenie na cestu');
    const task = (await getItem(db, (await applyTemplate(db, packing, { at: NOW })).id))!;
    assert.equal(task.dueAt, at(2026, 11, 10));
  });

  it('creates a project with its tasks, their due dates and checklists', async () => {
    const db = await createMigratedDb();
    const concert = await named(db, 'Koncert / vystúpenie');
    const { kind, id } = await applyTemplate(db, concert, { at: NOW });
    assert.equal(kind, 'project');
    const [project] = await listProjects(db);
    assert.equal(project.id, id);
    assert.equal(project.deadline, at(2026, 12, 21), '42 days later');
    const items = await listProjectItems(db, id);
    assert.equal(items.length, (concert.payload as ProjectPayload).tasks.length);
    const practise = items.find((i) => i.title === 'Nacvičiť skladby')!;
    assert.equal(practise.dueAt, at(2026, 12, 7));
    assert.equal((await listChecklist(db, practise.id)).length, 3);
  });

  it('fills placeholders', () => {
    assert.equal(fillPlaceholders('Nákup {datum} ({DATUM})', NOW), 'Nákup 9. 11. (9. 11.)');
  });
});

describe('saving templates from records', () => {
  it('saves a task with its checklist and a relative due date', async () => {
    const db = await createMigratedDb();
    const task = await createItem(db, { type: 'task', title: 'Zálohovať fotky', tags: ['údržba'], priority: 2, dueAt: at(2026, 11, 12) });
    await addChecklistEntry(db, task.id, 'telefón');
    await addChecklistEntry(db, task.id, 'notebook');
    const tpl = await templateFromItem(db, task.id, NOW);
    assert.equal(tpl.kind, 'task');
    const payload = tpl.payload as TaskPayload;
    assert.deepEqual([payload.checklist, payload.dueOffsetDays, payload.priority, payload.tags], [['telefón', 'notebook'], 3, 2, ['údržba']]);
    const again = await applyTemplate(db, tpl, { at: at(2026, 12, 1) });
    assert.equal((await getItem(db, again.id))?.dueAt, at(2026, 12, 4));
    await assert.rejects(templateFromItem(db, (await createItem(db, { type: 'event', title: 'e', startAt: NOW })).id));
    const note = await createItem(db, { type: 'note', title: 'Recept', body: 'text' });
    assert.equal(((await templateFromItem(db, note.id)).payload as NotePayload).body, 'text');
  });

  it('saves a project with offsets relative to its creation', async () => {
    const db = await createMigratedDb();
    const p = await createProject(db, { name: 'Web', deadline: at(2026, 12, 9) }, at(2026, 11, 9));
    const t = await createItem(db, { type: 'task', title: 'Návrh', projectId: p.id, dueAt: at(2026, 11, 16) });
    await addChecklistEntry(db, t.id, 'farby');
    const tpl = await templateFromProject(db, p.id, await listProjectItems(db, p.id));
    const payload = tpl.payload as ProjectPayload;
    assert.equal(payload.deadlineOffsetDays, 30);
    assert.deepEqual(payload.tasks, [{ title: 'Návrh', dueOffsetDays: 7, checklist: ['farby'] }]);
  });

  it('restores deleted samples without duplicating the others', async () => {
    const db = await createMigratedDb();
    await deleteTemplate(db, (await named(db, 'Porada')).id);
    assert.equal(await restoreSamples(db), 1);
    assert.equal(await restoreSamples(db), 0);
    assert.equal((await listTemplates(db)).length, 5);
  });
});

describe('repeating templates', () => {
  const sundayReview = async (db: Awaited<ReturnType<typeof createMigratedDb>>) => {
    const tpl = await named(db, 'Týždenná revízia');
    await updateTemplate(db, tpl.id, { rrule: 'FREQ=WEEKLY;BYDAY=SU', anchorAt: at(2026, 11, 15, 18) });
    return tpl.id;
  };
  const titles = async (db: Awaited<ReturnType<typeof createMigratedDb>>) =>
    (await db.getAllAsync<{ title: string }>("SELECT title FROM items WHERE type = 'task' ORDER BY created_at, rowid")).map((r) => r.title);

  it('creates nothing before the first occurrence, one record on the day, and never twice', async () => {
    const db = await createMigratedDb();
    const id = await sundayReview(db);
    assert.deepEqual(await runDueTemplates(db, at(2026, 11, 14, 20)), []);
    const first = await runDueTemplates(db, at(2026, 11, 15, 9));
    assert.equal(first.length, 1);
    assert.deepEqual(await titles(db), ['Týždenná revízia 15. 11.']);
    assert.equal((await getItem(db, first[0].id))?.dueAt, at(2026, 11, 15));
    assert.deepEqual(await runDueTemplates(db, at(2026, 11, 15, 21)), []);
    assert.equal((await getTemplate(db, id))?.lastRunAt, at(2026, 11, 15, 18));
    assert.deepEqual(await titles(db), ['Týždenná revízia 15. 11.']);
  });

  it('after a long absence creates only the latest missed occurrence', async () => {
    const db = await createMigratedDb();
    await sundayReview(db);
    await runDueTemplates(db, at(2026, 11, 15, 9));
    const later = await runDueTemplates(db, at(2026, 12, 8, 10)); // Sundays 22.11., 29.11., 6.12. were missed
    assert.equal(later.length, 1);
    assert.deepEqual(await titles(db), ['Týždenná revízia 15. 11.', 'Týždenná revízia 6. 12.']);
  });

  it('restarts when the repetition is changed, and ignores templates without one', async () => {
    const db = await createMigratedDb();
    const id = await sundayReview(db);
    await runDueTemplates(db, at(2026, 11, 15, 9));
    await updateTemplate(db, id, { rrule: 'FREQ=DAILY', anchorAt: at(2026, 11, 16, 8) });
    assert.equal((await getTemplate(db, id))?.lastRunAt, null);
    assert.deepEqual(await runDueTemplates(db, at(2026, 11, 15, 22)), []);
    assert.equal((await runDueTemplates(db, at(2026, 11, 16, 9))).length, 1);
    await updateTemplate(db, id, { rrule: null });
    assert.equal((await getTemplate(db, id))?.anchorAt, null);
    assert.deepEqual(await runDueTemplates(db, at(2026, 11, 20)), []);
  });

  it('repeats project templates too', async () => {
    const db = await createMigratedDb();
    const tpl = await createTemplate(db, {
      name: 'Mesačný report',
      kind: 'project',
      payload: { name: 'Report {datum}', icon: '📊', description: '', deadlineOffsetDays: 7, tasks: [{ title: 'Zozbierať čísla' }] },
      rrule: 'FREQ=MONTHLY',
      anchorAt: at(2026, 12, 1, 8),
    });
    assert.deepEqual(await runDueTemplates(db, at(2026, 11, 30)), []);
    const made = await runDueTemplates(db, at(2026, 12, 1, 9));
    assert.equal(made[0].kind, 'project');
    assert.equal((await listProjects(db))[0].name, 'Report 1. 12.');
    assert.equal(tpl.name, 'Mesačný report');
  });
});

describe('template text format', () => {
  it('round-trips project tasks with offsets and checklists', async () => {
    const { formatProjectTasks, parseLines, parseProjectTasks } = await import('../src/features/templates/format');
    const text = 'Vybrať repertoár | 7\nNacvičiť skladby | 28\n- Skladba 1\n-   Skladba 2\n\nGenerálka\n- ich | nie číslo';
    const tasks = parseProjectTasks(text);
    assert.deepEqual(tasks, [
      { title: 'Vybrať repertoár', dueOffsetDays: 7 },
      { title: 'Nacvičiť skladby', dueOffsetDays: 28, checklist: ['Skladba 1', 'Skladba 2'] },
      { title: 'Generálka', dueOffsetDays: null, checklist: ['ich | nie číslo'] },
    ]);
    assert.deepEqual(parseProjectTasks(formatProjectTasks(tasks)), tasks);
    assert.deepEqual(parseLines('  a \n\n b\n'), ['a', 'b']);
    assert.deepEqual(parseProjectTasks('- osirelý bod\nÚloha | x'), [{ title: 'Úloha', dueOffsetDays: null }]);
  });
});

describe('snapToWeekday', () => {
  it('finds the first matching day on or after a date', async () => {
    const { snapToWeekday } = await import('../src/lib/dates');
    assert.equal(snapToWeekday(at(2026, 11, 9, 15), 6), at(2026, 11, 15), 'Monday → Sunday');
    assert.equal(snapToWeekday(at(2026, 11, 15, 8), 6), at(2026, 11, 15), 'already Sunday');
    assert.equal(snapToWeekday(at(2026, 11, 15, 8), 0), at(2026, 11, 16), 'Sunday → Monday');
  });
});
