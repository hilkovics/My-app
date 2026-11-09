// Text <-> structure for editing template lists in a multiline field.
import type { ProjectTaskPayload } from './types';

/** One non-empty trimmed entry per line. */
export function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Project tasks, one per line: "Title" or "Title | 7" (due date in 7 days). Lines starting with "-"
 * are checklist entries of the task above them.
 */
export function parseProjectTasks(text: string): ProjectTaskPayload[] {
  const tasks: ProjectTaskPayload[] = [];
  for (const line of parseLines(text)) {
    if (line.startsWith('-')) {
      const entry = line.replace(/^-+\s*/, '').trim();
      const last = tasks[tasks.length - 1];
      if (entry && last) (last.checklist ??= []).push(entry);
      continue;
    }
    const [title, offset] = line.split('|').map((x) => x.trim());
    if (!title) continue;
    const n = offset != null && /^\d+$/.test(offset) ? Number(offset) : null;
    tasks.push({ title, dueOffsetDays: n });
  }
  return tasks;
}

export function formatProjectTasks(tasks: ProjectTaskPayload[]): string {
  return tasks
    .flatMap((t) => [t.dueOffsetDays != null ? `${t.title} | ${t.dueOffsetDays}` : t.title, ...(t.checklist ?? []).map((c) => `- ${c}`)])
    .join('\n');
}
