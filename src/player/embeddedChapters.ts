import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import type { EpisodeWithFeed } from '@/db/types';
import { basicAuthHeader } from '@/feed/auth';
import { feedCredentialsFor } from '@/feed/credentials';
import { USER_AGENT } from '@/feed/fetch';
import type { Chapter } from '@/player/chapters';
import { getLocalEpisodePath } from '@/player/downloads';
import { blockSource, readEmbeddedChapters, type ByteSource } from '@/player/embedded';

const FIRST_BLOCK = 64 * 1024;

/**
 * Chapters stored in the episode's audio (D-027): read from the download when
 * there is one, otherwise from the stream with HTTP range requests, so only
 * the tag or the `moov` box is fetched. A server that ignores ranges gets
 * no second request and the episode simply has no chapters.
 */
export async function loadEmbeddedChapters(episode: EpisodeWithFeed): Promise<Chapter[]> {
  if (Platform.OS === 'web') return [];
  const local = getLocalEpisodePath(episode);
  if (local) {
    const handle = new File(local).open();
    try {
      return await readEmbeddedChapters(fileSource(handle));
    } finally {
      handle.close();
    }
  }
  const auth = await feedCredentialsFor(episode.feed_id, episode.media_url);
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    ...(auth ? { Authorization: basicAuthHeader(auth) } : {}),
  };
  return readEmbeddedChapters(await httpSource(episode.media_url, headers));
}

type Handle = ReturnType<File['open']>;

function fileSource(handle: Handle): ByteSource {
  const size = handle.size;
  return {
    size,
    async read(offset, length) {
      const end = size == null ? offset + length : Math.min(size, offset + length);
      if (end <= offset) return new Uint8Array(0);
      handle.offset = offset;
      return handle.readBytes(end - offset);
    },
  };
}

async function httpSource(url: string, headers: Record<string, string>): Promise<ByteSource> {
  const ranged = async (offset: number, length: number) => {
    const controller = new AbortController();
    const res = await fetch(url, {
      headers: { ...headers, Range: `bytes=${offset}-${offset + length - 1}` },
      signal: controller.signal,
    });
    if (res.status !== 206) {
      // A 200 is the whole file on its way: stop it rather than download it.
      controller.abort();
      throw new Error(res.ok ? 'Server ignores range requests' : `HTTP ${res.status}`);
    }
    const total = /\/(\d+)\s*$/.exec(res.headers.get('content-range') ?? '');
    return { bytes: new Uint8Array(await res.arrayBuffer()), size: total ? Number(total[1]) : null };
  };

  // The first block also tells the file's length, which finding `moov` needs.
  const first = await ranged(0, FIRST_BLOCK);
  return blockSource(
    async (offset, length) => (offset === 0 ? first.bytes : (await ranged(offset, length)).bytes),
    first.size
  );
}
