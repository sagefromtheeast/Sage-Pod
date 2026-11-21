/**
 * The metadata a refresh may change on an episode already stored. Playback
 * state (position, played, favourite, downloads) is never among it.
 */
export type EpisodeMetadata = {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  publishedAt: number | null;
  duration: number | null;
  mediaUrl: string;
  mediaType: string | null;
  mediaSize: number | null;
  imageUrl: string | null;
  season: number | null;
  episodeNumber: number | null;
  chaptersUrl: string | null;
  /** JSON array of chapters from the feed, or null. */
  chaptersJson: string | null;
};

/** Episodes per statement: bounds the JSON parameter, not the number of rows written. */
export const UPDATE_BATCH_SIZE = 200;

/**
 * Applies a JSON array of `EpisodeMetadata` in one statement, writing only the
 * rows whose metadata actually differs. A refresh re-reads every episode in
 * the feed, and nearly all of them are unchanged: skipping those keeps the
 * write short (other queries wait on the one connection meanwhile) and wakes
 * no screen for nothing. A missing duration keeps the stored one, as before.
 */
export const UPDATE_CHANGED_EPISODES = `
UPDATE episodes
   SET title = n.title, description = n.description, link = n.link,
       published_at = n.published_at, duration = COALESCE(n.duration, episodes.duration),
       media_url = n.media_url, media_type = n.media_type, media_size = n.media_size,
       image_url = n.image_url, season = n.season, episode_number = n.episode_number,
       chapters_url = n.chapters_url, chapters_json = n.chapters_json
  FROM (SELECT value ->> '$.id' AS id, value ->> '$.title' AS title,
               value ->> '$.description' AS description, value ->> '$.link' AS link,
               value ->> '$.publishedAt' AS published_at, value ->> '$.duration' AS duration,
               value ->> '$.mediaUrl' AS media_url, value ->> '$.mediaType' AS media_type,
               value ->> '$.mediaSize' AS media_size, value ->> '$.imageUrl' AS image_url,
               value ->> '$.season' AS season, value ->> '$.episodeNumber' AS episode_number,
               value ->> '$.chaptersUrl' AS chapters_url, value ->> '$.chaptersJson' AS chapters_json
          FROM json_each(?)) AS n
 WHERE episodes.id = n.id
   AND (episodes.title IS NOT n.title OR episodes.description IS NOT n.description
        OR episodes.link IS NOT n.link OR episodes.published_at IS NOT n.published_at
        OR (n.duration IS NOT NULL AND episodes.duration IS NOT n.duration)
        OR episodes.media_url IS NOT n.media_url OR episodes.media_type IS NOT n.media_type
        OR episodes.media_size IS NOT n.media_size OR episodes.image_url IS NOT n.image_url
        OR episodes.season IS NOT n.season OR episodes.episode_number IS NOT n.episode_number
        OR episodes.chapters_url IS NOT n.chapters_url OR episodes.chapters_json IS NOT n.chapters_json)`;

/** `updates` split into the JSON parameters for `UPDATE_CHANGED_EPISODES`. */
export function episodeUpdateBatches(updates: readonly EpisodeMetadata[]): string[] {
  const batches: string[] = [];
  for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
    batches.push(JSON.stringify(updates.slice(i, i + UPDATE_BATCH_SIZE)));
  }
  return batches;
}
