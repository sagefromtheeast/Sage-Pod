/**
 * The columns behind `EpisodeWithFeed`, for any query that joins
 * `episodes e` to `feeds f`.
 *
 * One list so every such query returns the full shape the type promises —
 * the queue once hand-wrote a shorter list, silently dropping the per-podcast
 * speed and skip-intro settings the player reads.
 */
export const EPISODE_WITH_FEED_COLUMNS = `
  e.*,
  f.title AS feed_title,
  f.image_url AS feed_image_url,
  f.author AS feed_author,
  f.playback_speed AS feed_playback_speed,
  f.skip_intro_seconds AS feed_skip_intro_seconds
`;
