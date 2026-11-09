// Pure progress calculations for projects and goals.
import { MINUTE, plural, startOfDay } from '../../lib/dates';
import { logDuration, type ActivityLog } from '../activities/repository';
import type { Item } from '../../db/types';
import type { Goal, Project } from './repository';

export interface ProjectProgress {
  total: number;
  done: number;
  /** 0–100 */
  pct: number;
  overdue: number;
  /** Earliest due time among open tasks. */
  nextDue: number | null;
}

/** Progress from a project's tasks (events and notes don't count). */
export function projectProgress(items: Pick<Item, 'type' | 'completedAt' | 'dueAt' | 'startAt' | 'archived'>[], now = Date.now()): ProjectProgress {
  const tasks = items.filter((i) => i.type === 'task' && !i.archived);
  const done = tasks.filter((t) => t.completedAt != null).length;
  const open = tasks.filter((t) => t.completedAt == null);
  const dues = open.map((t) => t.dueAt ?? t.startAt).filter((d): d is number => d != null);
  const overdue = open.filter((t) => {
    const d = t.dueAt;
    if (d == null) return false;
    // A date-only due date is overdue only after that day ends.
    return startOfDay(d) === d ? d < startOfDay(now) : d < now;
  }).length;
  return {
    total: tasks.length,
    done,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    overdue,
    nextDue: dues.length ? Math.min(...dues) : null,
  };
}

/** "dnes", "zajtra", "o 5 dní", "3 dni po termíne" (by calendar days). */
export function fmtCountdown(deadline: number, now = Date.now()): string {
  const days = Math.round((startOfDay(deadline) - startOfDay(now)) / 86_400_000);
  if (days === 0) return 'dnes';
  if (days === 1) return 'zajtra';
  if (days > 1) return `o ${plural(days, 'deň', 'dni', 'dní')}`;
  return `${plural(-days, 'deň', 'dni', 'dní')} po termíne`;
}

export interface GoalProgress {
  /** Current value in the goal's unit (tasks done / minutes / km / sessions). */
  value: number;
  /** Target in the same unit. */
  target: number;
  /** 0–100, capped at 100. */
  pct: number;
  unit: 'tasks' | 'minutes' | 'km' | 'sessions';
  /** Value expected by now if progress were linear to the deadline; null without period or deadline. */
  expected: number | null;
  /** value >= expected (true when there is no plan to compare with). */
  onTrack: boolean;
  reached: boolean;
}

export interface GoalData {
  /** Items of all projects belonging to the goal. */
  projectItems: Pick<Item, 'type' | 'completedAt' | 'archived' | 'dueAt' | 'startAt'>[];
  /** Logs of the goal's activity. */
  logs: ActivityLog[];
}

export function goalProgress(goal: Goal, data: GoalData, now = Date.now()): GoalProgress {
  let value: number;
  let target: number;
  let unit: GoalProgress['unit'];
  if (goal.kind === 'projects') {
    const p = projectProgress(data.projectItems, now);
    value = p.done;
    target = p.total;
    unit = 'tasks';
  } else {
    unit = goal.metric ?? 'minutes';
    target = goal.target ?? 0;
    const from = goal.startAt ?? 0;
    const to = goal.deadline != null ? goal.deadline + 86_400_000 : Infinity;
    const inPeriod = data.logs.filter((l) => l.startedAt >= startOfDay(from) && l.startedAt < to);
    value =
      unit === 'km'
        ? inPeriod.reduce((a, l) => a + (l.distanceM ?? 0), 0) / 1000
        : unit === 'minutes'
          ? inPeriod.reduce((a, l) => a + logDuration(l, now), 0) / MINUTE
          : inPeriod.filter((l) => l.count > 0 || logDuration(l, now) > 0).length;
  }
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  let expected: number | null = null;
  if (goal.kind === 'activity' && goal.startAt != null && goal.deadline != null && target > 0) {
    const start = startOfDay(goal.startAt);
    const end = startOfDay(goal.deadline) + 86_400_000;
    const f = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));
    expected = target * f;
  }
  return { value, target, pct, unit, expected, onTrack: expected == null || value >= expected - 1e-9, reached: target > 0 && value >= target };
}

export function fmtGoalValue(v: number, unit: GoalProgress['unit']): string {
  const r = Math.round(v * 10) / 10;
  switch (unit) {
    case 'km':
      return `${String(r).replace('.', ',')} km`;
    case 'minutes':
      return `${Math.round(v)} min`;
    case 'sessions':
      return `${Math.round(v)}×`;
    default:
      return `${Math.round(v)}`;
  }
}

export function projectsOfGoal(projects: Project[], goalId: string): Project[] {
  return projects.filter((p) => p.goalId === goalId);
}
