import type { Db, Item } from '../../db/types';
import { addDays, startOfDay, ymd } from '../../lib/dates';
import { listLogs } from '../activities/repository';
import { listItemsWithProject } from '../items/repository';
import { listProjects, type Goal, type Project } from './repository';
import { goalProgress, type GoalProgress } from './stats';

export interface GoalView {
  goal: Goal;
  progress: GoalProgress;
  /** Projects of the goal with their items (projects goals; also shown for activity goals if linked). */
  projects: { project: Project; items: Item[] }[];
}

/** Loads everything needed to show the progress of the given goals. */
export async function loadGoalViews(db: Db, goals: Goal[], now = Date.now()): Promise<GoalView[]> {
  const [projects, items] = await Promise.all([listProjects(db), listItemsWithProject(db)]);
  const out: GoalView[] = [];
  for (const goal of goals) {
    const mine = projects.filter((p) => p.goalId === goal.id).map((project) => ({ project, items: items.filter((i) => i.projectId === project.id) }));
    const logs =
      goal.kind === 'activity' && goal.activityId
        ? await listLogs(db, ymd(startOfDay(goal.startAt ?? 0)), ymd(goal.deadline ?? addDays(startOfDay(now), 1)), goal.activityId)
        : [];
    out.push({ goal, projects: mine, progress: goalProgress(goal, { projectItems: mine.flatMap((p) => p.items), logs }, now) });
  }
  return out;
}
