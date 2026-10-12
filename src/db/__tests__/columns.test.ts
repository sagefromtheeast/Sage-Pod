import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';

import type { SQLiteDatabase } from 'expo-sqlite';

import { EPISODE_WITH_FEED_COLUMNS, EPISODE_WITH_NOTES_COLUMNS } from '../columns';
import { migrate } from '../schema';

async function openDatabase(): Promise<DatabaseSync> {
  const sqlite = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    getFirstAsync: async (sql: string) => sqlite.prepare(sql).get(),
  } as unknown as SQLiteDatabase;
  await migrate(adapter);
  sqlite.exec(`INSERT INTO feeds (id, feed_url, title, created_at) VALUES (1, 'https://example.com/feed', 'Feed', 0)`);
  sqlite.exec(`INSERT INTO episodes (id, feed_id, guid, title, description, media_url, created_at)
               VALUES (1, 1, 'g', 'Episode', '<p>Notes</p>', 'https://example.com/1.mp3', 0)`);
  return sqlite;
}

const select = (db: DatabaseSync, columns: string) =>
  db.prepare(`SELECT ${columns} FROM episodes e JOIN feeds f ON f.id = e.feed_id`).get() as Record<string, unknown>;

describe('episode columns', () => {
  it('list every episode column but the show notes', async () => {
    const db = await openDatabase();
    const episodeColumns = (db.prepare('PRAGMA table_info(episodes)').all() as { name: string }[]).map((c) => c.name);
    const listed = Object.keys(select(db, EPISODE_WITH_FEED_COLUMNS));
    assert.deepEqual(
      episodeColumns.filter((name) => !listed.includes(name)),
      ['description']
    );
  });

  it('include the show notes for the episode page', async () => {
    const db = await openDatabase();
    assert.equal(select(db, EPISODE_WITH_NOTES_COLUMNS).description, '<p>Notes</p>');
  });
});
