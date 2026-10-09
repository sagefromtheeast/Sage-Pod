import type { Chapter } from '../chapters';
import { ascii, type ByteSource } from './bytes';
import { readId3Chapters } from './id3';
import { readMp4Chapters } from './mp4';

export { blockSource, bufferSource, type ByteSource } from './bytes';

/**
 * Chapters stored in the audio file itself, for episodes whose feed has no
 * chapters file (D-027): ID3v2 CHAP frames in MP3s, and QuickTime or Nero
 * chapters in M4A / MP4. Anything else, or a file that can't be read, has
 * none.
 */
export async function readEmbeddedChapters(src: ByteSource): Promise<Chapter[]> {
  const head = await src.read(0, 12);
  if (head.length >= 3 && ascii(head, 0, 3) === 'ID3') return readId3Chapters(src);
  if (head.length >= 8 && ascii(head, 4, 4) === 'ftyp') return readMp4Chapters(src);
  return [];
}
