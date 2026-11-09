import { insertSampleTemplates } from '../features/templates/samples';
import { habitsToActivities, insertRows, type LegacyHabit, type LegacyHabitLog } from '../features/activities/legacy';

import type { Db } from './types';

type Migration = string | ((db: Db) => Promise<void>);

/**
 * Ordered migrations. Never edit a shipped migration; append a new one instead.
 * Each runs in a transaction together with the user_version bump.
 */
export const MIGRATIONS: Migration[] = [
  // v1
  `
  CREATE TABLE items (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('event', 'task', 'note')),
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    color TEXT,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    start_at INTEGER,
    end_at INTEGER,
    all_day INTEGER NOT NULL DEFAULT 0,
    due_at INTEGER,
    completed_at INTEGER,
    priority INTEGER NOT NULL DEFAULT 0,
    rrule TEXT,
    journal_date TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX idx_items_type ON items(type);
  CREATE INDEX idx_items_start ON items(start_at);
  CREATE INDEX idx_items_due ON items(due_at);
  CREATE UNIQUE INDEX idx_items_journal ON items(journal_date) WHERE journal_date IS NOT NULL;

  CREATE TABLE tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
  );

  CREATE TABLE item_links (
    from_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    to_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (from_id, to_id),
    CHECK (from_id <> to_id)
  );

  CREATE TABLE external_links (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    calendar_id TEXT,
    external_event_id TEXT NOT NULL,
    PRIMARY KEY (item_id, external_event_id)
  );
  CREATE INDEX idx_external_event ON external_links(external_event_id);

  CREATE TABLE checklist_entries (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    done INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX idx_checklist_item ON checklist_entries(item_id);

  CREATE TABLE alerts (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    offset_minutes INTEGER NOT NULL,
    notification_ids TEXT NOT NULL DEFAULT '[]',
    UNIQUE (item_id, offset_minutes)
  );

  CREATE TABLE habits (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '✓',
    color TEXT NOT NULL DEFAULT '#3c87f7',
    days TEXT NOT NULL DEFAULT '1111111',
    target_per_day INTEGER NOT NULL DEFAULT 1,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE habit_logs (
    habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (habit_id, date)
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // v2: notes attached to a concrete occurrence of a local or phone-calendar event
  `
  CREATE TABLE event_notes (
    note_id TEXT PRIMARY KEY NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('local', 'device')),
    event_id TEXT NOT NULL,
    occurrence_start INTEGER NOT NULL,
    event_title TEXT NOT NULL DEFAULT ''
  );
  CREATE UNIQUE INDEX idx_event_notes_occ ON event_notes(source, event_id, occurrence_start);
  CREATE INDEX idx_event_notes_event ON event_notes(source, event_id);
  `,
  // v3: focus (deep work) sessions
  `
  CREATE TABLE focus_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('stopwatch', 'pomodoro')),
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    planned_minutes INTEGER,
    paused_at INTEGER,
    paused_ms INTEGER NOT NULL DEFAULT 0,
    item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
    tag TEXT,
    note TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX idx_focus_started ON focus_sessions(started_at);
  CREATE INDEX idx_focus_item ON focus_sessions(item_id);
  CREATE UNIQUE INDEX idx_focus_running ON focus_sessions((1)) WHERE ended_at IS NULL;
  `,
  // v4: activities (instrument practice, running, …) replace habits; habits become 'check' activities
  async (db) => {
    await db.execAsync(`
      CREATE TABLE activities (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '⭐',
        color_slot INTEGER NOT NULL DEFAULT 0,
        kind TEXT NOT NULL CHECK (kind IN ('timed', 'check')),
        track_distance INTEGER NOT NULL DEFAULT 0,
        track_rating INTEGER NOT NULL DEFAULT 0,
        days TEXT NOT NULL DEFAULT '1111111',
        target_per_day INTEGER NOT NULL DEFAULT 1,
        goal_type TEXT CHECK (goal_type IN ('sessions', 'minutes', 'km')),
        goal_value REAL,
        archived INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE activity_logs (
        id TEXT PRIMARY KEY NOT NULL,
        activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        paused_at INTEGER,
        paused_ms INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        distance_m REAL,
        count INTEGER NOT NULL DEFAULT 0,
        rating INTEGER,
        note TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_alog_activity_day ON activity_logs(activity_id, day);
      CREATE INDEX idx_alog_day ON activity_logs(day);
      CREATE UNIQUE INDEX idx_alog_running ON activity_logs((1)) WHERE ended_at IS NULL;
    `);
    const habits = await db.getAllAsync<LegacyHabit>('SELECT * FROM habits ORDER BY created_at');
    const logs = await db.getAllAsync<LegacyHabitLog>('SELECT * FROM habit_logs');
    const converted = habitsToActivities(habits, logs);
    await insertRows(db, 'activities', converted.activities);
    await insertRows(db, 'activity_logs', converted.logs);
    await db.execAsync('DROP TABLE habit_logs; DROP TABLE habits;');
  },
  // v5: projects, goals, task status (kanban) and templates
  async (db) => {
    await db.execAsync(`
      CREATE TABLE goals (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '🎯',
        description TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL CHECK (kind IN ('projects', 'activity')),
        activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
        metric TEXT CHECK (metric IN ('minutes', 'km', 'sessions')),
        target REAL,
        start_at INTEGER,
        deadline INTEGER,
        archived INTEGER NOT NULL DEFAULT 0,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📁',
        color_slot INTEGER NOT NULL DEFAULT 0,
        description TEXT NOT NULL DEFAULT '',
        goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
        deadline INTEGER,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
        completed_at INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT '📋',
        kind TEXT NOT NULL CHECK (kind IN ('task', 'note', 'project')),
        payload TEXT NOT NULL,
        rrule TEXT,
        anchor_at INTEGER,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL
      );
      ALTER TABLE items ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
      ALTER TABLE items ADD COLUMN status TEXT;
      ALTER TABLE items ADD COLUMN waiting_for TEXT;
      UPDATE items SET status = CASE WHEN completed_at IS NOT NULL THEN 'done' ELSE 'todo' END WHERE type = 'task';
      CREATE INDEX idx_items_project ON items(project_id);
      CREATE INDEX idx_items_status ON items(status);
    `);
    await insertSampleTemplates(db);
  },
  // v6: time estimate of tasks and how demanding an item is (for the day plan)
  `
  ALTER TABLE items ADD COLUMN estimate_minutes INTEGER;
  ALTER TABLE items ADD COLUMN energy TEXT CHECK (energy IN ('deep', 'routine', 'rest'));
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current > SCHEMA_VERSION) {
    throw new Error('Databáza je novšia, než táto verzia aplikácie podporuje.');
  }
  if (current === SCHEMA_VERSION) return;
  await db.withTransactionAsync(async () => {
    for (let v = current; v < SCHEMA_VERSION; v++) {
      const m = MIGRATIONS[v];
      if (typeof m === 'string') await db.execAsync(m);
      else await m(db);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}
