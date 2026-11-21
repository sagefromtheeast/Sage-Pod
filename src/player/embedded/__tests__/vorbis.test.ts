import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bufferSource, readEmbeddedChapters, type ByteSource } from '../index';

const le32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const ascii = (s: string) => [...Buffer.from(s, 'latin1')];
const utf8 = (s: string) => [...Buffer.from(s, 'utf8')];
/** `push(...items)` without the argument limit, for large test files. */
const append = (out: number[], items: number[]) => {
  for (const item of items) out.push(item);
};

/** A Vorbis comment block: vendor, then each comment with its length. */
function commentBlock(comments: (string | number[])[]): number[] {
  const out = [...le32(6), ...ascii('vendor'), ...le32(comments.length)];
  for (const comment of comments) {
    const body = typeof comment === 'string' ? utf8(comment) : comment;
    append(out, le32(body.length));
    append(out, body);
  }
  return out;
}

/**
 * An Ogg stream holding `packets`, cut into pages of at most `perPage`
 * segments so a long packet spans pages. The CRC is left at zero: the reader
 * doesn't check it.
 */
function ogg(packets: number[][], perPage = 255, serial = 7): Uint8Array {
  const lacing: number[] = [];
  const data: number[] = [];
  for (const packet of packets) {
    let left = packet.length;
    while (left >= 255) {
      lacing.push(255);
      left -= 255;
    }
    lacing.push(left);
    append(data, packet);
  }
  const out: number[] = [];
  let at = 0;
  for (let first = 0, page = 0; first < lacing.length; first += perPage, page++) {
    const segments = lacing.slice(first, first + perPage);
    const size = segments.reduce((a, b) => a + b, 0);
    out.push(...ascii('OggS'), 0, page === 0 ? 2 : 0, ...new Array(8).fill(0), ...le32(serial), ...le32(page), ...le32(0));
    out.push(segments.length, ...segments);
    append(out, data.slice(at, at + size));
    at += size;
  }
  out.push(...new Array(64).fill(0x55)); // audio
  return Uint8Array.from(out);
}

const CHAPTERS = [
  'CHAPTER002=00:12:00.500',
  'CHAPTER002NAME=Interview',
  'chapter002url=https://example.com/interview',
  'CHAPTER001=00:00:00.000',
  'CHAPTER001NAME=Intro ✨',
  'CHAPTER003=bad',
  'CHAPTER004=30:00',
  'CHAPTER004URL=javascript:alert(1)',
  'TITLE=Not a chapter',
];
const EXPECTED = [
  { startTime: 0, title: 'Intro ✨' },
  { startTime: 720.5, title: 'Interview', url: 'https://example.com/interview' },
  { startTime: 1800, title: '' },
];

function counting(src: ByteSource) {
  const reads: [number, number][] = [];
  return {
    reads,
    source: { size: src.size, read: (offset: number, length: number) => (reads.push([offset, length]), src.read(offset, length)) },
  };
}

describe('Ogg and FLAC chapters', () => {
  it('reads Opus comments', async () => {
    const file = ogg([[...ascii('OpusHead'), 1, 2, 0, 0], [...ascii('OpusTags'), ...commentBlock(CHAPTERS)]]);
    assert.deepEqual(await readEmbeddedChapters(bufferSource(file)), EXPECTED);
  });

  it('reads Vorbis comments spread over several pages', async () => {
    const tags = [3, ...ascii('vorbis'), ...commentBlock(CHAPTERS), 1];
    const file = ogg([[1, ...ascii('vorbis'), 0, 0], tags, [5, ...ascii('vorbis')]], 1);
    assert.deepEqual(await readEmbeddedChapters(bufferSource(file)), EXPECTED);
  });

  it('skips cover art without reading it', async () => {
    const art = new Array(200_000).fill(0x41);
    const tags = [...ascii('OpusTags')];
    append(tags, commentBlock([art, ...CHAPTERS]));
    const { reads, source } = counting(bufferSource(ogg([[...ascii('OpusHead')], tags])));
    assert.deepEqual(await readEmbeddedChapters(source), EXPECTED);
    assert.ok(reads.every(([, length]) => length <= 4096));
  });

  it('has none without chapter comments, or for another codec', async () => {
    assert.deepEqual(await readEmbeddedChapters(bufferSource(ogg([[...ascii('OpusHead')], [...ascii('OpusTags'), ...commentBlock(['TITLE=x'])]]))), []);
    assert.deepEqual(await readEmbeddedChapters(bufferSource(ogg([[...ascii('Speex   ')], [...ascii('whatever')]]))), []);
    // Cut off in the middle of the comment header.
    assert.deepEqual(await readEmbeddedChapters(bufferSource(ogg([[...ascii('OpusHead')], [...ascii('OpusTags')]]).subarray(0, 40))), []);
  });

  it('reads a FLAC VORBIS_COMMENT block after other blocks', async () => {
    const block = (type: number, last: boolean, body: number[]) => [
      (last ? 0x80 : 0) | type,
      (body.length >> 16) & 0xff,
      (body.length >> 8) & 0xff,
      body.length & 0xff,
      ...body,
    ];
    const file = Uint8Array.from([
      ...ascii('fLaC'),
      ...block(0, false, new Array(34).fill(0)),
      ...block(4, true, commentBlock(CHAPTERS)),
    ]);
    assert.deepEqual(await readEmbeddedChapters(bufferSource(file)), EXPECTED);
  });
});
