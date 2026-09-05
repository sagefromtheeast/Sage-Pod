export const RSS_STANDARD = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Deep Field</title>
    <link>/show</link>
    <language>en-us</language>
    <itunes:author>Orbital Media</itunes:author>
    <itunes:explicit>no</itunes:explicit>
    <description>Long-form science.</description>
    <itunes:image href="https://cdn.example.com/art.jpg"/>
    <item>
      <title>The Great Attractor</title>
      <guid isPermaLink="false">ep-002</guid>
      <pubDate>Tue, 02 Sep 2025 07:00:00 GMT</pubDate>
      <itunes:duration>01:02:33</itunes:duration>
      <itunes:season>2</itunes:season>
      <itunes:episode>14</itunes:episode>
      <content:encoded><![CDATA[<p>Notes with <a href="https://example.com/paper">a paper</a>.</p>]]></content:encoded>
      <enclosure url="https://cdn.example.com/ep2.mp3" type="audio/mpeg" length="60123456"/>
    </item>
    <item>
      <title>Voids</title>
      <guid>ep-001</guid>
      <pubDate>Tue, 26 Aug 2025 07:00:00 GMT</pubDate>
      <itunes:duration>3011</itunes:duration>
      <description>Plain description.</description>
      <enclosure url="/audio/ep1.mp3" type="audio/mpeg" length="4001"/>
    </item>
  </channel>
</rss>`;

// No guid, relative art, duration as MM:SS, video + audio enclosures, single item (not array).
export const RSS_MESSY = `<?xml version="1.0"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Messy Show</title>
    <image><url>art/cover.png</url></image>
    <item>
      <title>Only Episode</title>
      <pubDate>2025-08-01T10:30:00Z</pubDate>
      <itunes:duration>45:10</itunes:duration>
      <media:content url="https://cdn.example.com/vid.mp4" type="video/mp4" fileSize="900"/>
      <enclosure url="https://cdn.example.com/only.m4a" type="audio/x-m4a" length="123"/>
      <itunes:image href="https://cdn.example.com/ep.jpg"/>
    </item>
  </channel>
</rss>`;

// Atom, duplicate guids, an item with no media at all.
export const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Cast</title>
  <link href="https://atom.example.com/"/>
  <entry>
    <title>Alpha</title>
    <id>urn:uuid:alpha</id>
    <updated>2025-07-04T12:00:00Z</updated>
    <summary>First.</summary>
    <enclosure url="https://cdn.example.com/a.mp3" type="audio/mpeg"/>
  </entry>
  <entry>
    <title>Alpha duplicate</title>
    <id>urn:uuid:alpha</id>
    <updated>2025-07-05T12:00:00Z</updated>
    <enclosure url="https://cdn.example.com/a2.mp3" type="audio/mpeg"/>
  </entry>
  <entry>
    <title>No media here</title>
    <id>urn:uuid:beta</id>
    <updated>2025-07-06T12:00:00Z</updated>
  </entry>
</feed>`;

export const NOT_A_FEED = `<html><body><h1>404</h1></body></html>`;
