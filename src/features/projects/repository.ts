import { notifyChange } from '../../db/changes';
import type { Db, SqlParam } from '../../db/types';
import { newId } from '../../lib/id';

export type ProjectStatus = 'active' | 'done' | 'archived';
export type GoalKind = 'projects' | 'activity';
export type GoalMetric = 'minutes' | 'km' | 'sessions';

export interface Project {
  id: string;
  name: string;
  icon: string;
  /** Index into the validated categorical palette (0–7). */
  colorSlot: number;
  description: string;
  goalId: string | null;
  deadline: number | null;
  status: ProjectStatus;
  completedAt: number | null;
  position: number;
  createdAt: number;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** projects: progress = share of finished tasks in its projects; activity: sum of a metric of one activity. */
  kind: GoalKind;
  activityId: string | null;
  metric: GoalMetric | null;
  target: number | null;
  startAt: number | null;
  deadline: number | null;
  archived: boolean;
  position: number;
  createdAt: number;
}

interface ProjectRow {
  id: string;
  name: string;
  icon: string;
  color_slot: number;
  description: string;
  goal_id: string | null;
  deadline: number | null;
  status: ProjectStatus;
  completed_at: number | null;
  position: number;
  created_at: number;
}

interface GoalRow {
  id: string;
  name: string;
  icon: string;
  description: string;
  kind: GoalKind;
  activity_id: string | null;
  metric: GoalMetric | null;
  target: number | null;
  start_at: number | null;
  deadline: number | null;
  archived: number;
  position: number;
  created_at: number;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  colorSlot: r.color_slot,
  description: r.description,
  goalId: r.goal_id,
  deadline: r.deadline,
  status: r.status,
  completedAt: r.completed_at,
  position: r.position,
  createdAt: r.created_at,
});

const toGoal = (r: GoalRow): Goal => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  description: r.description,
  kind: r.kind,
  activityId: r.activity_id,
  metric: r.metric,
  target: r.target,
  startAt: r.start_at,
  deadline: r.deadline,
  archived: !!r.archived,
  position: r.position,
  createdAt: r.created_at,
});

function param(v: unknown): SqlParam {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as SqlParam;
}

async function insert(db: Db, table: string, id: string, columns: Record<string, string>, values: Record<string, unknown>, extra: Record<string, SqlParam>): Promise<void> {
  const cols = [...Object.keys(extra)];
  const params: SqlParam[] = [...Object.values(extra)];
  for (const [k, col] of Object.entries(columns)) {
    if (values[k] !== undefined) {
      cols.push(col);
      params.push(param(values[k]));
    }
  }
  await db.runAsync(`INSERT INTO ${table} (id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})`, id, ...params);
}

async function update(db: Db, table: string, id: string, columns: Record<string, string>, patch: Record<string, unknown>): Promise<void> {
  const sets: string[] = [];
  const params: SqlParam[] = [];
  for (const [k, col] of Object.entries(columns)) {
    if (k in patch) {
      sets.push(`${col} = ?`);
      params.push(param(patch[k]));
    }
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, ...params, id);
}

// ---------------------------------------------------------------- Projects

const PROJECT_COLUMNS: Record<string, string> = {
  name: 'name',
  icon: 'icon',
  colorSlot: 'color_slot',
  description: 'description',
  goalId: 'goal_id',
  deadline: 'deadline',
  status: 'status',
  completedAt: 'completed_at',
};

export type ProjectInput = Pick<Project, 'name'> & Partial<Omit<Project, 'id' | 'createdAt' | 'position'>>;

export async function createProject(db: Db, input: ProjectInput, now = Date.now()): Promise<Project> {
  const stats = await db.getFirstAsync<{ n: number; p: number | null }>('SELECT COUNT(*) AS n, MAX(position) AS p FROM projects');
  const id = newId();
  await insert(
    db,
    'projects',
    id,
    PROJECT_COLUMNS,
    { icon: '📁', colorSlot: (stats?.n ?? 0) % 8, ...input, name: input.name.trim() },
    { position: (stats?.p ?? -1) + 1, created_at: now },
  );
  notifyChange();
  return (await getProject(db, id))!;
}

export async function updateProject(db: Db, id: string, patch: Partial<ProjectInput>, now = Date.now()): Promise<void> {
  const p: Record<string, unknown> = { ...patch };
  if (patch.status === 'done' && !('completedAt' in patch)) p.completedAt = now;
  if (patch.status && patch.status !== 'done' && !('completedAt' in patch)) p.completedAt = null;
  await update(db, 'projects', id, PROJECT_COLUMNS, p);
  notifyChange();
}

/** Deleting a project keeps its items (they just lose the project). */
export async function deleteProject(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM projects WHERE id = ?', id);
  notifyChange();
}

export async function getProject(db: Db, id: string): Promise<Project | null> {
  const r = await db.getFirstAsync<ProjectRow>('SELECT * FROM projects WHERE id = ?', id);
  return r ? toProject(r) : null;
}

export async function listProjects(db: Db, status?: ProjectStatus | ProjectStatus[]): Promise<Project[]> {
  const list = status == null ? null : Array.isArray(status) ? status : [status];
  const rows = await db.getAllAsync<ProjectRow>(
    `SELECT * FROM projects ${list ? `WHERE status IN (${list.map(() => '?').join(', ')})` : ''} ORDER BY position, created_at`,
    ...(list ?? []),
  );
  return rows.map(toProject);
}

// ---------------------------------------------------------------- Goals

const GOAL_COLUMNS: Record<string, string> = {
  name: 'name',
  icon: 'icon',
  description: 'description',
  kind: 'kind',
  activityId: 'activity_id',
  metric: 'metric',
  target: 'target',
  startAt: 'start_at',
  deadline: 'deadline',
  archived: 'archived',
};

export type GoalInput = Pick<Goal, 'name' | 'kind'> & Partial<Omit<Goal, 'id' | 'createdAt' | 'position'>>;

export async function createGoal(db: Db, input: GoalInput, now = Date.now()): Promise<Goal> {
  const stats = await db.getFirstAsync<{ p: number | null }>('SELECT MAX(position) AS p FROM goals');
  const id = newId();
  await insert(
    db,
    'goals',
    id,
    GOAL_COLUMNS,
    { icon: '🎯', startAt: now, ...input, name: input.name.trim() },
    { position: (stats?.p ?? -1) + 1, created_at: now },
  );
  notifyChange();
  return (await getGoal(db, id))!;
}

export async function updateGoal(db: Db, id: string, patch: Partial<GoalInput>): Promise<void> {
  await update(db, 'goals', id, GOAL_COLUMNS, patch);
  notifyChange();
}

/** Deleting a goal keeps its projects (they just lose the goal). */
export async function deleteGoal(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM goals WHERE id = ?', id);
  notifyChange();
}

export async function getGoal(db: Db, id: string): Promise<Goal | null> {
  const r = await db.getFirstAsync<GoalRow>('SELECT * FROM goals WHERE id = ?', id);
  return r ? toGoal(r) : null;
}

export async function listGoals(db: Db, includeArchived = false): Promise<Goal[]> {
  const rows = await db.getAllAsync<GoalRow>(`SELECT * FROM goals ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY archived, position, created_at`);
  return rows.map(toGoal);
}
