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
};

/** An episode joined with the feed it belongs to — what every list screen needs. */
export type EpisodeWithFeed = EpisodeRow & {
  feed_title: string;
  feed_image_url: string | null;
  feed_author: string | null;
  feed_playback_speed: number | null;
  feed_skip_intro_seconds: number | null;
};

/** A subscription plus its unplayed count, for the library grid. */
export type FeedWithCounts = FeedRow & {
  episode_count: number;
  unplayed_count: number;
  latest_published_at: number | null;
};
