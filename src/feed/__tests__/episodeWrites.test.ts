import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '../../db/schema';
import {
  episodeUpdateBatches,
  UPDATE_BATCH_SIZE,
  UPDATE_CHANGED_EPISODES,
  type EpisodeMetadata,
} from '../episodeWrites';

let db: DatabaseSync;

/** The app's real schema, applied through the same migrations, on Node's SQLite. */
async function openDatabase(): Promise<DatabaseSync> {
  const sqlite = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    getFirstAsync: async (sql: string) => sqlite.prepare(sql).get(),
  } as unknown as SQLiteDatabase;
  await migrate(adapter);
  sqlite.exec(`INSERT INTO feeds (id, feed_url, title, created_at) VALUES (1, 'https://example.com/feed', 'Feed', 0)`);
  return sqlite;
}

function episode(id: number, overrides: Partial<EpisodeMetadata> = {}): EpisodeMetadata {
  return {
    id,
    title: `Episode ${id}`,
    description: `<p>Notes for ${id}</p>`,
    link: null,
    publishedAt: 1_700_000_000_000 + id * 1000,
    duration: 1800 + id,
    mediaUrl: `https://example.com/${id}.mp3`,
    mediaType: 'audio/mpeg',
    mediaSize: 1_000_000 + id,
    imageUrl: null,
    season: null,
    episodeNumber: id,
    chaptersUrl: null,
    chaptersJson: null,
    ...overrides,
  };
}

function store(episodes: EpisodeMetadata[]) {
  const insert = db.prepare(
    `INSERT INTO episodes (id, feed_id, guid, title, description, link, published_at, duration, media_url,
                           media_type, media_size, image_url, season, episode_number, chapters_url, created_at)
     VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  );
  for (const e of episodes) {
    insert.run(
      e.id,
      `guid-${e.id}`,
      e.title,
      e.description,
      e.link,
      e.publishedAt,
      e.duration,
      e.mediaUrl,
      e.mediaType,
      e.mediaSize,
      e.imageUrl,
      e.season,
      e.episodeNumber,
      e.chaptersUrl
    );
  }
}

/** Rows written by applying `updates`, batch by batch, as the refresh does. */
function apply(updates: EpisodeMetadata[]): number {
  let changes = 0;
  for (const batch of episodeUpdateBatches(updates)) {
    changes += Number(db.prepare(UPDATE_CHANGED_EPISODES).run(batch).changes);
  }
  return changes;
}

const row = (id: number) => db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as Record<string, unknown>;

describe('UPDATE_CHANGED_EPISODES', () => {
  beforeEach(async () => {
    db = await openDatabase();
  });

  it('writes nothing when the feed is unchanged', () => {
    const episodes = Array.from({ length: 500 }, (_, i) => episode(i + 1));
    store(episodes);
    assert.equal(apply(episodes), 0);
  });

  it('writes only the episodes whose metadata changed', () => {
    const episodes = Array.from({ length: 50 }, (_, i) => episode(i + 1));
    store(episodes);
    const updates = episodes.map((e) =>
      e.id === 7 ? { ...e, title: 'Renamed' } : e.id === 30 ? { ...e, description: null } : e
    );
    assert.equal(apply(updates), 2);
    assert.equal(row(7).title, 'Renamed');
    assert.equal(row(30).description, null);
    assert.equal(row(8).title, 'Episode 8');
  });

  it('keeps the stored duration when the feed omits it, without counting a change', () => {
    store([episode(1)]);
    assert.equal(apply([episode(1, { duration: null })]), 0);
    assert.equal(row(1).duration, 1801);
    assert.equal(apply([episode(1, { duration: null, title: 'New' })]), 1);
    assert.equal(row(1).duration, 1801);
  });

  it('never touches playback state', () => {
    store([episode(1)]);
    db.exec(`UPDATE episodes SET position = 600, is_played = 1, is_favorite = 1, download_state = 'done' WHERE id = 1`);
    apply([episode(1, { title: 'New', mediaSize: 5 })]);
    const updated = row(1);
    assert.deepEqual(
      [updated.position, updated.is_played, updated.is_favorite, updated.download_state, updated.media_size],
      [600, 1, 1, 'done', 5]
    );
  });

  it('round-trips text that needs JSON escaping', () => {
    store([episode(1)]);
    const description = 'Quotes " and \\ backslashes, emoji 🎙️, and\nnewlines';
    assert.equal(apply([episode(1, { description })]), 1);
    assert.equal(row(1).description, description);
    assert.equal(apply([episode(1, { description })]), 0);
  });

  it('splits large refreshes into bounded batches', () => {
    const updates = Array.from({ length: UPDATE_BATCH_SIZE * 2 + 1 }, (_, i) => episode(i + 1));
    assert.equal(episodeUpdateBatches(updates).length, 3);
    assert.deepEqual(episodeUpdateBatches([]), []);
  });
});
