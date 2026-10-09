import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AUTO_BACKUP_EVERY_MS,
  autoBackupDue,
  backgroundIntervalMinutes,
  backupsToDelete,
  fileNameFromUri,
} from '../schedule';

describe('automatic backup', () => {
  const now = Date.UTC(2026, 9, 9, 12);

  it('is due the first time and every 3 days after', () => {
    assert.equal(autoBackupDue(null, now), true);
    assert.equal(autoBackupDue(now - AUTO_BACKUP_EVERY_MS + 60_000, now), false);
    assert.equal(autoBackupDue(now - AUTO_BACKUP_EVERY_MS, now), true);
  });

  it('is due again if the clock went backwards', () => {
    assert.equal(autoBackupDue(now + AUTO_BACKUP_EVERY_MS, now), true);
    assert.equal(autoBackupDue(Number.NaN, now), true);
  });

  it('keeps the newest five of its own backups and nothing else', () => {
    const names = [
      'sagepod-backup-2026-09-01.db',
      'sagepod-backup-2026-09-04.db',
      'sagepod-backup-2026-09-07.db',
      'sagepod-backup-2026-09-10.db',
      'sagepod-backup-2026-09-13.db',
      'sagepod-backup-2026-09-13 (1).db',
      'sagepod-backup-2026-09-16.db',
      'holiday.jpg',
      'sagepod-feeds-2026-09-01.opml',
      'sagepod-backup-2026-09-01.db.bak',
    ];
    // Seven of Sage Pod's own; the two oldest go. "(1)" is the later copy of the 13th.
    assert.deepEqual(backupsToDelete(names), ['sagepod-backup-2026-09-04.db', 'sagepod-backup-2026-09-01.db']);
    assert.deepEqual(backupsToDelete(names, 2), [
      'sagepod-backup-2026-09-13.db',
      'sagepod-backup-2026-09-10.db',
      'sagepod-backup-2026-09-07.db',
      'sagepod-backup-2026-09-04.db',
      'sagepod-backup-2026-09-01.db',
    ]);
    assert.deepEqual(backupsToDelete(names.slice(0, 3)), []);
  });

  it('reads file names from Android folder URIs', () => {
    assert.equal(
      fileNameFromUri(
        'content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2Fsagepod-backup-2026-10-09.db'
      ),
      'sagepod-backup-2026-10-09.db'
    );
    assert.equal(fileNameFromUri('file:///data/Backups/sagepod-backup-2026-10-09.db'), 'sagepod-backup-2026-10-09.db');
    assert.equal(fileNameFromUri('file:///data/Backups/100%.db'), '100%.db');
  });
});

describe('background refresh interval', () => {
  it('never asks for less than the system minimum', () => {
    assert.equal(backgroundIntervalMinutes(15), 15);
    assert.equal(backgroundIntervalMinutes(5), 15);
    assert.equal(backgroundIntervalMinutes(720), 720);
  });
});
