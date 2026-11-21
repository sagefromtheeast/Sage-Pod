/** Row shapes as stored in SQLite. Booleans are 0/1, timestamps are epoch ms. */

export type DownloadState = 'none' | 'queued' | 'downloading' | 'done' | 'error';

export type FeedRow = {
  id: number;
  feed_url: string;
  title: string;
  author: string | null;
  description: string | null;
  image_url: string | null;
  link: string | null;
  language: string | null;
  explicit: number;
  etag: string | null;
  last_modified: string | null;
  last_refreshed_at: number | null;
  auto_download: number;
  keep_updated: number;
  created_at: number;
  playback_speed: number | null;
  skip_intro_seconds: number | null;
  next_page_url: string | null;
  /** 'preview' while looking before subscribing; previews are kept out of Library, refresh and search. */
  /** 'archived' = unsubscribed but kept (AntennaPod's archive): not refreshed, not in the Library. */
  state: 'subscribed' | 'preview' | 'archived';
  /** Why the last refresh failed, or null if it worked. */
  last_refresh_error: string | null;
  /** Saved podcast-page filter (see src/feed/episodeFilter.ts). */
  episode_filter: string | null;
  /** Saved podcast-page sort (an EpisodeSortKey). */
  episode_sort: string | null;
  /** JSON array of { url, label } funding links. */
  funding: string | null;
  /** The listener's own name for the podcast; `title` (from the feed) is kept. */
  custom_title: string | null;
  /** Comma-separated tags (see parseTags). */
  tags: string | null;
  skip_ending_seconds: number | null;
  /** 1 (off), 0.5 (light) or 0.2 (heavy); null = off. */
  volume_reduction: number | null;
  /** Overrides (null = global): delete played downloads; what new episodes do; auto-download. */
  auto_delete: number | null;
  new_episodes_action: string | null;
  auto_download_override: number | null;
  /** Auto-download filter: comma-separated title words, and a minimum length. */
  download_include: string | null;
  download_exclude: string | null;
  download_min_minutes: number | null;
  /** 1 when new episodes of this podcast post a notification (V7). */
  notify: number;
};

export type EpisodeRow = {
  id: number;
  feed_id: number;
  guid: string;
  title: string;
  description: string | null;
  link: string | null;
  published_at: number | null;
  duration: number | null;
  media_url: string;
  media_type: string | null;
  media_size: number | null;
  image_url: string | null;
  season: number | null;
  episode_number: number | null;
  position: number;
  is_played: number;
  is_favorite: number;
  is_new: number;
  played_at: number | null;
  local_path: string | null;
  download_state: DownloadState;
  downloaded_bytes: number | null;
  created_at: number;
  chapters_url: string | null;
  /** Podlove Simple Chapters from the feed: a JSON array of `Chapter`. */
  chapters_json: string | null;
};

/**
 * An episode joined with the feed it belongs to — what every list screen
 * needs. Without the show notes: they are most of a row's size and only the
 * episode page shows them (`EpisodeWithNotes`).
 */
export type EpisodeWithFeed = Omit<EpisodeRow, 'description'> & {
  feed_title: string;
  feed_image_url: string | null;
  feed_author: string | null;
  feed_playback_speed: number | null;
  feed_skip_intro_seconds: number | null;
  feed_skip_ending_seconds: number | null;
  feed_volume_reduction: number | null;
  feed_auto_delete: number | null;
};

/** One episode with its show notes, for the episode page. */
export type EpisodeWithNotes = EpisodeWithFeed & { description: string | null };

/** A subscription plus its unplayed count, for the library grid. */
export type FeedWithCounts = FeedRow & {
  episode_count: number;
  unplayed_count: number;
  latest_published_at: number | null;
};

/** A Library tile: the counts its number, sort and filter can use. */
export type LibraryFeed = FeedWithCounts & {
  inbox_count: number;
  downloaded_count: number;
  downloaded_unplayed_count: number;
  played_count: number;
};
