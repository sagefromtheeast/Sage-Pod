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
  s.push('DELETE FROM queue;', 'DELETE FROM playback_history;', 'DELETE FROM episodes;', 'DELETE FROM feeds;',
    "DELETE FROM settings WHERE key LIKE 'meta:%';", "DELETE FROM sqlite_sequence WHERE name IN ('feeds','episodes','playback_history');");
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
  // Now Playing: the player restores this episode (paused) on startup.
  s.push(`INSERT INTO settings (key, value) VALUES ('meta:lastEpisodeId', '3') ON CONFLICT(key) DO UPDATE SET value = excluded.value;`);
  return s.join('\n');
}
export function artSvg(id) {
  const [title, , color] = FEEDS[(Number(id) - 1) % FEEDS.length] ?? ['?', '', '#555'];
  const initials = title.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#111"/></linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/><circle cx="470" cy="130" r="90" fill="#fff" opacity=".12"/>
  <text x="50" y="520" font-family="sans-serif" font-weight="700" font-size="190" fill="#fff">${initials}</text></svg>`;
}
