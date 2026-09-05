import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Bump this when adding a migration below. `migrate()` walks from the
 * database's stored `user_version` up to this number, applying each step once.
 */
export const LATEST_SCHEMA_VERSION = 2;

const V1 = `
CREATE TABLE IF NOT EXISTS feeds (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_url          TEXT    NOT NULL UNIQUE,
  title             TEXT    NOT NULL,
  author            TEXT,
  description       TEXT,
  image_url         TEXT,
  link              TEXT,
  language          TEXT,
  explicit          INTEGER NOT NULL DEFAULT 0,
  etag              TEXT,
  last_modified     TEXT,
  last_refreshed_at INTEGER,
  auto_download     INTEGER NOT NULL DEFAULT 0,
  keep_updated      INTEGER NOT NULL DEFAULT 1,
  created_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS episodes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id          INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  guid             TEXT    NOT NULL,
  title            TEXT    NOT NULL,
  description      TEXT,
  link             TEXT,
  published_at     INTEGER,
  duration         INTEGER,
  media_url        TEXT    NOT NULL,
  media_type       TEXT,
  media_size       INTEGER,
  image_url        TEXT,
  season           INTEGER,
  episode_number   INTEGER,
  position         INTEGER NOT NULL DEFAULT 0,
  is_played        INTEGER NOT NULL DEFAULT 0,
  is_favorite      INTEGER NOT NULL DEFAULT 0,
  is_new           INTEGER NOT NULL DEFAULT 1,
  played_at        INTEGER,
  local_path       TEXT,
  download_state   TEXT    NOT NULL DEFAULT 'none',
  downloaded_bytes INTEGER,
  created_at       INTEGER NOT NULL,
  UNIQUE (feed_id, guid)
);

CREATE INDEX IF NOT EXISTS idx_episodes_feed_published
  ON episodes (feed_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_published
  ON episodes (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_played_at
  ON episodes (played_at DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_downloads
  ON episodes (download_state);

-- The play queue. 'sort_order' is a float so an item can be dropped between two
-- neighbours by averaging their orders, without renumbering the whole table.
CREATE TABLE IF NOT EXISTS queue (
  episode_id INTEGER PRIMARY KEY REFERENCES episodes(id) ON DELETE CASCADE,
  sort_order REAL    NOT NULL,
  added_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_order ON queue (sort_order);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const V2 = `
ALTER TABLE feeds ADD COLUMN playback_speed REAL;
ALTER TABLE feeds ADD COLUMN skip_intro_seconds INTEGER;

ALTER TABLE episodes ADD COLUMN chapters_url TEXT;

CREATE TABLE IF NOT EXISTS playback_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  listened_seconds INTEGER NOT NULL,
  date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_playback_history_date
  ON playback_history (date);
`;

/** Ordered migrations. Index 0 migrates version 0 -> 1, and so on. */
const MIGRATIONS: string[] = [V1, V2];

/**
 * Applies any pending migrations.
 *
 * Called once at startup from `SQLiteProvider`'s `onInit`, before any screen
 * queries the database.
 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < LATEST_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    await db.execAsync(step);
    version += 1;
    // PRAGMA statements can't be parameterised, and `version` is a local
    // integer counter, so interpolation here is safe.
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}
