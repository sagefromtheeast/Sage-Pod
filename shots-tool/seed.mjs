// Deterministic demo data for Sage Pod screenshots. Exports SQL relative to a fixed NOW.
export const NOW = Date.UTC(2026, 9, 6, 15, 0, 0); // 2026-10-06T15:00Z, also frozen in the browser clock
const DAY = 86400000;
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const FEEDS = [
  ['The Quiet Hour', 'Mara Lindqvist', '#2f6f4f', 'Slow conversations about craft, attention and the long game.'],
  ['Signal & Noise', 'Dev Patel', '#3d5a99', 'A weekly look at the tech news that actually matters.'],
  ['Field Notes', 'Ana Okafor', '#a0522d', 'Natural history, told from the trail.'],
  ['Deep Time', 'Hugo Brandt', '#6b3fa0', 'Geology, cosmology and the very, very old.'],
  ['Kitchen Table Economics', 'Rosa Jimenez', '#b8860b', 'Money explained like you are a person.'],
  ['Night Shift Stories', 'Sam Ito', '#8b1e3f', 'True stories from people who work while you sleep.'],
];
const TOPICS = ['The art of doing less', 'Inside the chip shortage', 'Following the river', 'A billion years in a pebble',
  'What inflation really feels like', 'The 3am bakery', 'Why we stopped writing letters', 'Rewilding the city',
  'Listener questions', 'The comet that came back', 'Interview: a lighthouse keeper', 'Season finale'];
export function seedSql() {
  const s = [];
  // The table only exists from schema 6; creating it here lets a "before" run on
  // an older build take the same seed (same columns as migration 6).
  s.push(`CREATE TABLE IF NOT EXISTS download_log (id INTEGER PRIMARY KEY AUTOINCREMENT, episode_id INTEGER NOT NULL,
    episode_title TEXT NOT NULL, feed_title TEXT, url TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT,
    error_message TEXT, created_at INTEGER NOT NULL);`);
  s.push('DELETE FROM download_log;', 'DELETE FROM queue;', 'DELETE FROM playback_history;', 'DELETE FROM episodes;', 'DELETE FROM feeds;',
    "DELETE FROM settings WHERE key LIKE 'meta:%';", "DELETE FROM sqlite_sequence WHERE name IN ('feeds','episodes','playback_history');");
  // Schema 7 adds feeds.notify (default 0, so the inserts below need nothing new).
  let epId = 0;
  FEEDS.forEach(([title, author, , desc], fi) => {
    const id = fi + 1;
    s.push(`INSERT INTO feeds (id, feed_url, title, author, description, image_url, link, language, last_refreshed_at, created_at)
      VALUES (${id}, ${q(`https://feeds.sagepod.test/${id}.xml`)}, ${q(title)}, ${q(author)}, ${q(desc)},
      ${q(`https://art.sagepod.test/${id}.svg`)}, ${q(`https://sagepod.test/${id}`)}, 'en', ${NOW}, ${NOW - 90 * DAY});`);
    for (let n = 0; n < 8; n++) {
      epId++;
      const published = NOW - (n * 3 + fi) * DAY - fi * 3600000;
      const duration = 1500 + ((epId * 977) % 3600);
      const isNew = n < 2 ? 1 : 0;
      const isPlayed = n >= 5 ? 1 : 0;
      const position = n === 2 ? Math.floor(duration * 0.4) : 0;
      const fav = epId % 7 === 0 ? 1 : 0;
      const topic = TOPICS[(epId + fi) % TOPICS.length];
      s.push(`INSERT INTO episodes (id, feed_id, guid, title, description, link, published_at, duration, media_url, media_type,
        image_url, season, episode_number, position, is_played, is_favorite, is_new, played_at, download_state, created_at)
        VALUES (${epId}, ${id}, ${q(`ep-${epId}`)}, ${q(`${120 - n}. ${topic}`)},
        ${q(`<p>In this episode of <b>${title}</b>, ${author} digs into ${topic.toLowerCase()}.</p><ul><li>00:00 Intro</li><li>05:30 The main story</li><li>32:10 Listener mail</li></ul><p>Show notes and links at <a href="https://sagepod.test">sagepod.test</a>.</p>`)},
        ${q(`https://sagepod.test/${id}/${epId}`)}, ${published}, ${duration}, ${q(`https://media.sagepod.test/${epId}.wav?d=${duration}`)}, 'audio/wav',
        NULL, 3, ${120 - n}, ${position}, ${isPlayed}, ${fav}, ${isNew}, ${isPlayed || position ? published + DAY : 'NULL'}, 'none', ${published});`);
    }
  });
  // Queue: a few episodes from different shows.
  [3, 11, 19, 27, 35].forEach((e, i) => s.push(`INSERT INTO queue (episode_id, sort_order, added_at) VALUES (${e}, ${i + 1}, ${NOW - i * 60000});`));
  // Listening history for the stats screen.
  for (let d = 0; d < 14; d++) s.push(`INSERT INTO playback_history (episode_id, feed_id, listened_seconds, date)
    VALUES (${(d % 6) * 8 + 6}, ${(d % 6) + 1}, ${600 + ((d * 1337) % 3000)}, '${new Date(NOW - d * DAY).toISOString().slice(0, 10)}');`);
  // Phase 15: a year of older listening for Statistics › Years, in the same
  // proportions per podcast as the fortnight above so Home's classics keep their order.
  const recent = [0, 0, 0, 0, 0, 0];
  for (let d = 0; d < 14; d++) recent[d % 6] += 600 + ((d * 1337) % 3000);
  [0.3, 0.5, 0.8, 0.4, 0.6, 0.9, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.5].forEach((weight, i) => {
    const date = new Date(NOW);
    date.setUTCDate(12);
    date.setUTCMonth(date.getUTCMonth() - i - 1);
    recent.forEach((total, f) => s.push(`INSERT INTO playback_history (episode_id, feed_id, listened_seconds, date)
      VALUES (${f * 8 + 6}, ${f + 1}, ${Math.round(total * weight)}, '${date.toISOString().slice(0, 10)}');`));
  });
  // Phase 9: funding links on The Quiet Hour, a failed refresh on Night Shift
  // Stories, and a podcast being previewed (not subscribed: kept out of Library).
  s.push(`UPDATE feeds SET funding = ${q(JSON.stringify([{ url: 'https://sagepod.test/support', label: 'Become a member' }]))} WHERE id = 1;`);
  s.push(`UPDATE feeds SET last_refresh_error = 'The server answered 503 (Service Unavailable).' WHERE id = 6;`);
  // Phase 10: per-podcast settings on The Quiet Hour (none change how other screens look).
  s.push(`UPDATE feeds SET tags = 'Craft, Interviews', skip_ending_seconds = 30, new_episodes_action = 'queue',
    download_exclude = 'bonus' WHERE id = 1;`);
  s.push(`INSERT INTO feeds (id, feed_url, title, author, description, image_url, link, language, last_refreshed_at, created_at, state)
    VALUES (7, 'https://feeds.sagepod.test/7.xml', 'Window Seat', 'Lena Ortiz', 'Stories told from the window seat of night trains.',
    'https://art.sagepod.test/3.svg', 'https://sagepod.test/7', 'en', ${NOW}, ${NOW}, 'preview');`);
  for (let n = 0; n < 3; n++) {
    const id = 49 + n;
    s.push(`INSERT INTO episodes (id, feed_id, guid, title, description, published_at, duration, media_url, media_type, is_new, created_at)
      VALUES (${id}, 7, 'ep-${id}', ${q(`${3 - n}. ${['Night train to Lisbon', 'The sleeper car', 'Platform nine'][n]}`)},
      '<p>A preview episode.</p>', ${NOW - n * 7 * DAY}, ${1800 + n * 300}, 'https://media.sagepod.test/${id}.wav?d=${1800 + n * 300}', 'audio/wav', 0, ${NOW});`);
  }
  // Library tags, and an archived podcast (unsubscribed with "Archive") with two episodes.
  s.push(`UPDATE feeds SET tags = 'Tech' WHERE id = 2;`, `UPDATE feeds SET tags = 'Science' WHERE id IN (3, 4);`);
  s.push(`INSERT INTO feeds (id, feed_url, title, author, description, image_url, link, language, last_refreshed_at, created_at, state)
    VALUES (8, 'https://feeds.sagepod.test/8.xml', 'Old Radio Hour', 'Iris Bell', 'Vintage radio drama, restored.',
    'https://art.sagepod.test/5.svg', 'https://sagepod.test/8', 'en', ${NOW - 30 * DAY}, ${NOW - 200 * DAY}, 'archived');`);
  for (let n = 0; n < 2; n++) {
    const id = 52 + n;
    s.push(`INSERT INTO episodes (id, feed_id, guid, title, description, published_at, duration, media_url, media_type, is_new, created_at)
      VALUES (${id}, 8, 'ep-${id}', ${q(`${2 - n}. ${['The last broadcast', 'Static'][n]}`)},
      '<p>An archived episode.</p>', ${NOW - (40 + n * 7) * DAY}, 2400, 'https://media.sagepod.test/${id}.wav?d=2400', 'audio/wav', 0, ${NOW});`);
  }
  // Downloads: five finished (two played), one waiting, one failed, and their log.
  [[2, 41], [10, 38], [18, 52], [7, 33], [15, 29]].forEach(([e, mb]) => s.push(`UPDATE episodes SET download_state = 'done',
    local_path = 'file:///episodes/${e}.wav', downloaded_bytes = ${mb * 1048576} WHERE id = ${e};`));
  s.push(`UPDATE episodes SET download_state = 'queued' WHERE id = 26;`, `UPDATE episodes SET download_state = 'error' WHERE id = 34;`);
  [[34, 'failed', 'NOT_FOUND', 'The podcast file was not found on the server (404/410).', 2], [15, 'success', null, null, 5],
   [7, 'success', null, null, 9], [18, 'success', null, null, 26]].forEach(([e, status, code, message, hoursAgo]) =>
    s.push(`INSERT INTO download_log (episode_id, episode_title, feed_title, url, status, error_code, error_message, created_at)
      SELECT e.id, e.title, f.title, e.media_url, '${status}', ${q(code)}, ${q(message)}, ${NOW - hoursAgo * 3600000}
        FROM episodes e JOIN feeds f ON f.id = e.feed_id WHERE e.id = ${e};`));
  // Chapters for the Now Playing episode (served by shoot.mjs from CHAPTERS).
  s.push(`UPDATE episodes SET chapters_url = 'https://chapters.sagepod.test/3.json' WHERE id = 3;`);
  // Now Playing: the player restores this episode (paused) on startup.
  s.push(`INSERT INTO settings (key, value) VALUES ('meta:lastEpisodeId', '3') ON CONFLICT(key) DO UPDATE SET value = excluded.value;`);
  return s.join('\n');
}
// Episode 3 is 4431 s long and restored at 1772 s, inside "A detour" (which has its own art).
export const CHAPTERS = {
  version: '1.2.0',
  chapters: [
    { startTime: 0, title: 'Intro' },
    { startTime: 330, title: 'The main story' },
    { startTime: 1500, title: 'A detour into deep time', img: 'https://art.sagepod.test/4.svg' },
    { startTime: 2400, title: 'Interview' },
    { startTime: 3800, title: 'Listener mail' },
  ],
};
export function artSvg(id) {
  const [title, , color] = FEEDS[(Number(id) - 1) % FEEDS.length] ?? ['?', '', '#555'];
  const initials = title.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#111"/></linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/><circle cx="470" cy="130" r="90" fill="#fff" opacity=".12"/>
  <text x="50" y="520" font-family="sans-serif" font-weight="700" font-size="190" fill="#fff">${initials}</text></svg>`;
}
