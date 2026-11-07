import type { Db } from './types';

/**
 * Ordered migrations. Never edit a shipped migration; append a new one instead.
 * Each runs in a transaction together with the user_version bump.
 */
export const MIGRATIONS: string[] = [
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
      await db.execAsync(MIGRATIONS[v]);
    }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  });
}
