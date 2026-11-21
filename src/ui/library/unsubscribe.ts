
import { archiveFeeds, deleteFeed } from '@/db/feeds';
import { showDialog } from '@/ui/Dialog';
import { showToast } from '@/ui/UndoToast';

/**
 * AntennaPod's unsubscribe choice: archive (keep the podcast, its episodes,
 * progress and downloads, but stop refreshing it and hide it from the
 * Library) or delete everything. `onDone` runs after either.
 */
export function askToUnsubscribe(feeds: readonly { id: number; title: string }[], onDone?: () => void): void {
  if (feeds.length === 0) return;
  const what = feeds.length === 1 ? feeds[0].title : `${feeds.length} podcasts`;
  showDialog(
    `Unsubscribe from ${what}?`,
    'Archive keeps the episodes, your progress and downloads; you can subscribe again from the archive. Delete removes them from this device.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          onDone?.();
          try {
            await archiveFeeds(feeds.map((feed) => feed.id));
            showToast(feeds.length === 1 ? `${feeds[0].title} archived` : `${feeds.length} podcasts archived`);
          } catch (error) {
            showToast(`Couldn't archive ${what}: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          onDone?.();
          try {
            // One at a time: each removes its own downloaded files first.
            for (const feed of feeds) await deleteFeed(feed.id);
          } catch (error) {
            showToast(`Couldn't delete ${what}: ${error instanceof Error ? error.message : String(error)}`);
          }
        },
      },
    ]
  );
}
