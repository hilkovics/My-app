import { notifyChange } from '../../db/changes';
import type { Db, Item } from '../../db/types';
import { DAY, addDays, endOfDay, startOfDay } from '../../lib/dates';
import { newId } from '../../lib/id';
import { occurrencesBetween, parseRule } from '../../lib/recurrence';
import { addChecklistEntry, createItem, getItem, listChecklist } from '../items/repository';
import { createProject, getProject } from '../projects/repository';
import type { NotePayload, ProjectPayload, TaskPayload, TemplateKind, TemplatePayload } from './types';
import { insertSampleTemplates } from './samples';

export interface Template {
  id: string;
  name: string;
  icon: string;
  kind: TemplateKind;
  payload: TemplatePayload;
  /** Repeating templates create a record at every occurrence. */
  rrule: string | null;
  /** First/anchor occurrence of a repeating template. */
  anchorAt: number | null;
  /** The occurrence that was last created. */
  lastRunAt: number | null;
  createdAt: number;
}

interface Row {
  id: string;
  name: string;
  icon: string;
  kind: TemplateKind;
  payload: string;
  rrule: string | null;
  anchor_at: number | null;
  last_run_at: number | null;
  created_at: number;
}

const toTemplate = (r: Row): Template => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  kind: r.kind,
  payload: JSON.parse(r.payload) as TemplatePayload,
  rrule: r.rrule,
  anchorAt: r.anchor_at,
  lastRunAt: r.last_run_at,
  createdAt: r.created_at,
});

// ---------------------------------------------------------------- CRUD

export type TemplateInput = Pick<Template, 'name' | 'kind' | 'payload'> & Partial<Pick<Template, 'icon' | 'rrule' | 'anchorAt'>>;

export async function createTemplate(db: Db, input: TemplateInput, now = Date.now()): Promise<Template> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO templates (id, name, icon, kind, payload, rrule, anchor_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    input.name.trim(),
    input.icon ?? '📋',
    input.kind,
    JSON.stringify(input.payload),
    input.rrule ?? null,
    input.rrule ? (input.anchorAt ?? now) : null,
    now,
  );
  notifyChange();
  return (await getTemplate(db, id))!;
}

/** Changing the repetition restarts it (nothing is created for occurrences before the new anchor). */
export async function updateTemplate(db: Db, id: string, input: Partial<TemplateInput>): Promise<void> {
  const cur = await getTemplate(db, id);
  if (!cur) return;
  const rrule = 'rrule' in input ? (input.rrule ?? null) : cur.rrule;
  const repetitionChanged = rrule !== cur.rrule || ('anchorAt' in input && input.anchorAt !== cur.anchorAt);
  await db.runAsync(
    'UPDATE templates SET name = ?, icon = ?, kind = ?, payload = ?, rrule = ?, anchor_at = ?, last_run_at = ? WHERE id = ?',
    (input.name ?? cur.name).trim(),
    input.icon ?? cur.icon,
    input.kind ?? cur.kind,
    JSON.stringify(input.payload ?? cur.payload),
    rrule,
    rrule ? ('anchorAt' in input ? (input.anchorAt ?? null) : cur.anchorAt) : null,
    repetitionChanged ? null : cur.lastRunAt,
    id,
  );
  notifyChange();
}

export async function deleteTemplate(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM templates WHERE id = ?', id);
  notifyChange();
}

export async function getTemplate(db: Db, id: string): Promise<Template | null> {
  const r = await db.getFirstAsync<Row>('SELECT * FROM templates WHERE id = ?', id);
  return r ? toTemplate(r) : null;
}

export async function listTemplates(db: Db, kind?: TemplateKind): Promise<Template[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT * FROM templates ${kind ? 'WHERE kind = ?' : ''} ORDER BY created_at, name`,
    ...(kind ? [kind] : []),
  );
  return rows.map(toTemplate);
}

/** Re-adds the sample templates that were deleted; returns how many came back. */
export async function restoreSamples(db: Db): Promise<number> {
  const n = await insertSampleTemplates(db);
  notifyChange();
  return n;
}

// ---------------------------------------------------------------- Applying

/** "{datum}" → "9. 11." */
export function fillPlaceholders(text: string, at: number): string {
  const d = new Date(at);
  return text.replace(/\{datum\}/gi, `${d.getDate()}. ${d.getMonth() + 1}.`);
}

export interface ApplyOptions {
  /** Moment the record is "for" (creation time, or the occurrence of a repeating template). */
  at?: number;
  /** Put the new record into this project (tasks and notes). */
  projectId?: string | null;
}

export interface Created {
  kind: TemplateKind;
  id: string;
}

const dueFrom = (at: number, offset: number | null | undefined): number | null =>
  offset == null ? null : addDays(startOfDay(at), offset);

/** Creates the record (or project with its tasks) described by a template. */
export async function applyTemplate(db: Db, template: Template, opts: ApplyOptions = {}): Promise<Created> {
  const at = opts.at ?? Date.now();
  if (template.kind === 'project') {
    const p = template.payload as ProjectPayload;
    const project = await createProject(db, {
      name: fillPlaceholders(p.name, at),
      icon: p.icon,
      description: p.description,
      deadline: dueFrom(at, p.deadlineOffsetDays),
    });
    for (const t of p.tasks) {
      const task = await createItem(db, {
        type: 'task',
        title: fillPlaceholders(t.title, at),
        projectId: project.id,
        dueAt: dueFrom(at, t.dueOffsetDays),
      });
      for (const c of t.checklist ?? []) await addChecklistEntry(db, task.id, c);
    }
    return { kind: 'project', id: project.id };
  }
  const p = template.payload as TaskPayload & NotePayload;
  const item = await createItem(db, {
    type: template.kind,
    title: fillPlaceholders(p.title, at),
    body: p.body,
    tags: p.tags,
    projectId: opts.projectId ?? null,
    ...(template.kind === 'task' ? { priority: p.priority ?? 0, dueAt: dueFrom(at, p.dueOffsetDays) } : {}),
  });
  for (const c of p.checklist ?? []) await addChecklistEntry(db, item.id, c);
  return { kind: template.kind, id: item.id };
}

// ---------------------------------------------------------------- From existing records

/** Saves a task or note (with its checklist) as a template. */
export async function templateFromItem(db: Db, itemId: string, now = Date.now()): Promise<Template> {
  const item = await getItem(db, itemId);
  if (!item) throw new Error('Záznam neexistuje');
  if (item.type === 'event') throw new Error('Z udalosti sa šablóna nerobí');
  const checklist = (await listChecklist(db, itemId)).map((c) => c.text);
  const payload: TaskPayload | NotePayload =
    item.type === 'task'
      ? {
          title: item.title,
          body: item.body,
          tags: item.tags,
          priority: item.priority,
          checklist,
          dueOffsetDays: item.dueAt != null ? Math.max(0, Math.round((startOfDay(item.dueAt) - startOfDay(now)) / DAY)) : null,
        }
      : { title: item.title, body: item.body, tags: item.tags, checklist };
  return createTemplate(db, { name: item.title || 'Šablóna', kind: item.type, payload, icon: item.type === 'task' ? '☑️' : '📝' }, now);
}

/** Saves a project and its tasks as a template; due dates become offsets from the project's creation. */
export async function templateFromProject(db: Db, projectId: string, tasks: Item[], now = Date.now()): Promise<Template> {
  const project = await getProject(db, projectId);
  if (!project) throw new Error('Projekt neexistuje');
  const base = startOfDay(project.createdAt);
  const offset = (t: number | null) => (t == null ? null : Math.max(0, Math.round((startOfDay(t) - base) / DAY)));
  const payload: ProjectPayload = {
    name: project.name,
    icon: project.icon,
    description: project.description,
    deadlineOffsetDays: offset(project.deadline),
    tasks: await Promise.all(
      tasks
        .filter((t) => t.type === 'task')
        .map(async (t) => ({
          title: t.title,
          dueOffsetDays: offset(t.dueAt),
          checklist: (await listChecklist(db, t.id)).map((c) => c.text),
        })),
    ),
  };
  return createTemplate(db, { name: project.name, kind: 'project', payload, icon: project.icon }, now);
}

// ---------------------------------------------------------------- Repeating templates

let running: Promise<Created[]> | null = null;

/**
 * Creates the record of every repeating template whose occurrence has come (up to the end of today).
 * Only the latest missed occurrence is created, so a long absence doesn't produce a pile of copies,
 * and running it again creates nothing new.
 */
export function runDueTemplates(db: Db, now = Date.now()): Promise<Created[]> {
  running ??= runDue(db, now).finally(() => {
    running = null;
  });
  return running;
}

async function runDue(db: Db, now: number): Promise<Created[]> {
  const created: Created[] = [];
  const rows = await db.getAllAsync<Row>('SELECT * FROM templates WHERE rrule IS NOT NULL AND anchor_at IS NOT NULL');
  const until = endOfDay(now) + 1;
  for (const r of rows) {
    const t = toTemplate(r);
    const rule = parseRule(t.rrule);
    if (!rule || t.anchorAt == null) continue;
    const from = t.lastRunAt != null ? t.lastRunAt + 1 : t.anchorAt;
    const due = occurrencesBetween(t.anchorAt, rule, from, until);
    const latest = due[due.length - 1];
    if (latest == null) continue;
    // Record the occurrence first: a failure then skips one run instead of creating duplicates.
    await db.runAsync('UPDATE templates SET last_run_at = ? WHERE id = ?', latest, t.id);
    created.push(await applyTemplate(db, t, { at: latest }));
  }
  if (created.length) notifyChange();
  return created;
}
