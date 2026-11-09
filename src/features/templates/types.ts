// Template payloads (stored as JSON in templates.payload). Free of app imports so that the
// schema migration can use the sample templates.
export type TemplateKind = 'task' | 'note' | 'project';

export interface TaskPayload {
  title: string;
  body: string;
  tags: string[];
  priority: number;
  checklist: string[];
  /** Days after creation; null = no due date. */
  dueOffsetDays: number | null;
}

export interface NotePayload {
  title: string;
  body: string;
  tags: string[];
  checklist: string[];
}

export interface ProjectTaskPayload {
  title: string;
  checklist?: string[];
  dueOffsetDays?: number | null;
}

export interface ProjectPayload {
  name: string;
  icon: string;
  description: string;
  deadlineOffsetDays: number | null;
  tasks: ProjectTaskPayload[];
}

export type TemplatePayload = TaskPayload | NotePayload | ProjectPayload;
