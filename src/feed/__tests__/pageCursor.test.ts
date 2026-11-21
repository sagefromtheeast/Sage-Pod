import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, it } from 'node:test';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrate } from '../../db/schema';
import { ADVANCE_PAGE_CURSOR, cursorAfterPage, PAGES_DONE, REFRESH_PAGE_CURSOR } from '../pageCursor';

const PAGE_2 = 'https://example.com/feed?page=2';
const PAGE_3 = 'https://example.com/feed?page=3';

let db: DatabaseSync;

beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => db.exec(sql),
    getFirstAsync: async (sql: string) => db.prepare(sql).get(),
  } as unknown as SQLiteDatabase;
  await migrate(adapter);
  db.exec(`INSERT INTO feeds (id, feed_url, title, created_at) VALUES (1, 'https://example.com/feed', 'Feed', 0)`);
});

const cursor = () => (db.prepare('SELECT next_page_url FROM feeds WHERE id = 1').get() as { next_page_url: string | null }).next_page_url;
const refresh = (next: string | null, full = false) => db.prepare(REFRESH_PAGE_CURSOR).run(full ? 1 : 0, next, 1);
const fetchPage = (next: string | null) => db.prepare(ADVANCE_PAGE_CURSOR).run(cursorAfterPage(next), 1);

describe('page cursor', () => {
  it('starts from page 1’s next link', () => {
    refresh(PAGE_2);
    assert.equal(cursor(), PAGE_2);
  });

  it('stays where paging left it when the feed is refreshed', () => {
    refresh(PAGE_2);
    fetchPage(PAGE_3);
    refresh(PAGE_2);
    assert.equal(cursor(), PAGE_3);
  });

  it('stays finished after the last page', () => {
    refresh(PAGE_2);
    fetchPage(null);
    assert.equal(cursor(), PAGES_DONE);
    refresh(PAGE_2);
    assert.equal(cursor(), PAGES_DONE);
  });

  it('starts over on a full refresh', () => {
    refresh(PAGE_2);
    fetchPage(null);
    refresh(PAGE_2, true);
    assert.equal(cursor(), PAGE_2);
  });

  it('leaves an unpaged feed unpaged', () => {
    refresh(null);
    assert.equal(cursor(), null);
  });
});
