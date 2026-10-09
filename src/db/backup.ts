import { File } from 'expo-file-system';
import {
  backupDatabaseAsync,
  defaultDatabaseDirectory,
  deleteDatabaseAsync,
  openDatabaseAsync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import {
  checkBackup,
  checkColumns,
  NOT_SAGE_POD,
  type BackupCheck,
  type BackupInfo,
  type HtmlFavourite,
  type HtmlFeed,
  type TableColumns,
} from '@/backup/formats';

import { getDb } from './index';
import { LATEST_SCHEMA_VERSION, migrate } from './schema';

/** Scratch databases next to the app's own, so SQLite can open them by name. */
const EXPORT_NAME = 'sagepod-export.db';
const RESTORE_NAME = 'sagepod-restore.db';

function scratchFile(name: string): File {
  return new File(`file://${defaultDatabaseDirectory}/${name}`);
}

async function removeScratch(name: string): Promise<void> {
  await deleteDatabaseAsync(name).catch(() => {
    // Not there, which is what we want.
  });
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const file = scratchFile(name + suffix);
    if (file.exists) file.delete();
  }
}

/**
 * The whole database as one self-contained file's bytes. SQLite's backup API
 * copies a consistent snapshot even while the app writes, and the copy is
 * switched out of WAL mode so a single file carries everything.
 */
export async function exportDatabaseBytes(): Promise<Uint8Array> {
  await removeScratch(EXPORT_NAME);
  const copy = await openDatabaseAsync(EXPORT_NAME);
  try {
    await backupDatabaseAsync({ sourceDatabase: getDb(), destDatabase: copy });
    await copy.execAsync('PRAGMA journal_mode = DELETE;');
  } finally {
    await copy.closeAsync();
  }
  try {
    return await scratchFile(EXPORT_NAME).bytes();
  } finally {
    await removeScratch(EXPORT_NAME);
  }
}

/**
 * A picked backup, opened beside the app's database and brought up to this
 * version, but not yet used. `check` says whether it may replace the app's
 * data; `database` is null when the file isn't an SQLite database at all.
 */
export type StagedBackup = { info: BackupInfo; check: BackupCheck; database: SQLiteDatabase | null };

const NOT_A_DATABASE: BackupInfo = { userVersion: 0, tables: [], integrity: '', feeds: 0, episodes: 0 };

async function readInfo(db: SQLiteDatabase): Promise<BackupInfo> {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const tables = await db.getAllAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  const names = tables.map((table) => table.name);
  const integrity = await db.getFirstAsync<{ quick_check: string }>('PRAGMA quick_check');
  const count = async (table: string) =>
    names.includes(table) ? ((await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0) : 0;
  return {
    userVersion: version?.user_version ?? 0,
    tables: names,
    integrity: integrity?.quick_check ?? '',
    feeds: await count('feeds'),
    episodes: await count('episodes'),
  };
}

/** Every column of the app's own tables, as `db` has them. */
async function columnsOf(db: SQLiteDatabase, tables: readonly string[]): Promise<TableColumns> {
  const columns: Record<string, string[]> = {};
  for (const table of tables) {
    const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info("${table.replace(/"/g, '""')}")`);
    columns[table] = rows.map((row) => row.name);
  }
  return columns;
}

async function appTables(): Promise<string[]> {
  const rows = await getDb().getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
  );
  return rows.map((row) => row.name);
}

/**
 * Copies a picked file in, reads what it holds and, if it passes, brings it up
 * to this version's tables and checks them against the app's. All of it on
 * the scratch copy: nothing of the app's changes.
 */
export async function stageBackup(bytes: Uint8Array): Promise<StagedBackup> {
  await removeScratch(RESTORE_NAME);
  const file = scratchFile(RESTORE_NAME);
  file.create();
  file.write(bytes);
  let database: SQLiteDatabase | null = null;
  let info: BackupInfo;
  try {
    database = await openDatabaseAsync(RESTORE_NAME);
    info = await readInfo(database);
  } catch {
    // Not an SQLite file at all ("file is not a database").
    await database?.closeAsync().catch(() => {});
    await removeScratch(RESTORE_NAME);
    return { info: NOT_A_DATABASE, check: { ok: false, reason: NOT_SAGE_POD }, database: null };
  }
  let check = checkBackup(info, LATEST_SCHEMA_VERSION);
  if (check.ok) {
    try {
      await migrate(database);
      const tables = await appTables();
      check = checkColumns(await columnsOf(getDb(), tables), await columnsOf(database, tables));
    } catch {
      // A migration that can't apply means tables that aren't really ours.
      check = { ok: false, reason: NOT_SAGE_POD };
    }
  }
  return { info, check, database };
}

export async function discardStagedBackup(staged: StagedBackup): Promise<void> {
  await staged.database?.closeAsync().catch(() => {});
  await removeScratch(RESTORE_NAME);
}

/**
 * Replaces everything in the app's database with the staged backup, already
 * at this version, in one step (SQLite's backup API: on failure nothing
 * changes). The caller restarts the app afterwards, since every screen and the
 * player hold state read from the old data.
 */
export async function restoreStagedBackup(staged: StagedBackup): Promise<void> {
  if (!staged.database || !staged.check.ok) throw new Error('Nothing to restore');
  try {
    await backupDatabaseAsync({ sourceDatabase: staged.database, destDatabase: getDb() });
  } finally {
    await discardStagedBackup(staged);
  }
  // Nothing left to migrate; this sets the connection's pragmas again.
  await migrate(getDb());
}

/** Every subscription, for the HTML export. */
export async function listFeedsForExport(): Promise<HtmlFeed[]> {
  return getDb().getAllAsync<HtmlFeed>(
    `SELECT COALESCE(custom_title, title) AS title, author, feed_url AS feedUrl, link, image_url AS imageUrl
       FROM feeds WHERE state = 'subscribed'
      ORDER BY COALESCE(custom_title, title) COLLATE NOCASE`
  );
}

/** Every favourite episode, grouped by podcast for the favourites export. */
export async function listFavouritesForExport(): Promise<HtmlFavourite[]> {
  return getDb().getAllAsync<HtmlFavourite>(
    `SELECT f.id AS feedId, COALESCE(f.custom_title, f.title) AS feedTitle, f.link AS feedLink, e.title AS title, e.link AS link,
            e.media_url AS mediaUrl, e.published_at AS publishedAt
       FROM episodes e JOIN feeds f ON f.id = e.feed_id
      WHERE e.is_favorite = 1
      ORDER BY COALESCE(f.custom_title, f.title) COLLATE NOCASE, f.id, e.published_at DESC`
  );
}
