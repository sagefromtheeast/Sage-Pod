/**
 * The columns behind `EpisodeWithFeed`, for any query that joins
 * `episodes e` to `feeds f`.
 *
 * One list so every such query returns the full shape the type promises —
 * the queue once hand-wrote a shorter list, silently dropping the per-podcast
 * speed and skip-intro settings the player reads.
 *
 * Every episode column but `description`: show notes run to kilobytes each,
 * and a podcast page of 150 episodes was reading half a megabyte of them to
 * draw rows that never show them. AntennaPod's lists leave them out too.
 */
export const EPISODE_WITH_FEED_COLUMNS = `
  e.id, e.feed_id, e.guid, e.title, e.link, e.published_at, e.duration,
  e.media_url, e.media_type, e.media_size, e.image_url, e.season, e.episode_number,
  e.position, e.is_played, e.is_favorite, e.is_new, e.played_at, e.local_path,
  e.download_state, e.downloaded_bytes, e.created_at, e.chapters_url,
  COALESCE(f.custom_title, f.title) AS feed_title,
  f.image_url AS feed_image_url,
  f.author AS feed_author,
  f.playback_speed AS feed_playback_speed,
  f.skip_intro_seconds AS feed_skip_intro_seconds,
  f.skip_ending_seconds AS feed_skip_ending_seconds,
  f.volume_reduction AS feed_volume_reduction,
  f.auto_delete AS feed_auto_delete
`;

/** `EPISODE_WITH_FEED_COLUMNS` plus the show notes: `EpisodeWithNotes`. */
export const EPISODE_WITH_NOTES_COLUMNS = `e.description, ${EPISODE_WITH_FEED_COLUMNS}`;
