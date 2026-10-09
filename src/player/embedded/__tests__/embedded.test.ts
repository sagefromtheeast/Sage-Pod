import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { blockSource, bufferSource, readEmbeddedChapters, type ByteSource } from '../index';
import { linkFrame, pictureFrame, textFrame } from '../id3';
import { sampleText } from '../mp4';

const bytes = (...parts: (number[] | Uint8Array | string)[]) => {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') for (const c of Buffer.from(part, 'latin1')) flat.push(c);
    else for (const c of part) flat.push(c);
  }
  return Uint8Array.from(flat);
};
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const be64 = (n: number) => [...be32(Math.floor(n / 2 ** 32)), ...be32(n >>> 0)];
const syncsafe = (n: number) => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const utf8 = (s: string) => Uint8Array.from(Buffer.from(s, 'utf8'));

/** An ID3v2 frame, sized for `version`. */
const frame = (version: number, id: string, body: Uint8Array) =>
  bytes(id, version === 4 ? syncsafe(body.length) : be32(body.length), [0, 0], body);
const tit2 = (version: number, title: string) => frame(version, 'TIT2', bytes([3], utf8(title)));
const chap = (version: number, id: string, startMs: number, ...subs: Uint8Array[]) =>
  frame(
    version,
    'CHAP',
    bytes(id, [0], be32(startMs), be32(startMs + 1000), be32(0xffffffff), be32(0xffffffff), ...subs)
  );
const id3 = (version: number, ...frames: Uint8Array[]) => {
  const body = bytes(...frames, new Array(32).fill(0)); // padding
  return bytes('ID3', [version, 0, 0], syncsafe(body.length), body, 'audio data');
};

/** An MP4 box. */
const box = (type: string, ...body: (number[] | Uint8Array | string)[]) => {
  const inner = bytes(...body);
  return bytes(be32(inner.length + 8), type, inner);
};

/** Counts reads, to check that large parts of the file are never fetched. */
const counting = (src: ByteSource) => {
  const reads: [number, number][] = [];
  return {
    reads,
    source: { size: src.size, read: (o: number, l: number) => (reads.push([o, l]), src.read(o, l)) } as ByteSource,
  };
};

describe('ID3 chapters', () => {
  for (const version of [3, 4]) {
    it(`reads CHAP frames from ID3v2.${version}`, async () => {
      const tag = id3(
        version,
        frame(version, 'TIT2', bytes([0], 'Episode')),
        chap(version, 'ch2', 90_500, tit2(version, 'Second')),
        chap(version, 'ch1', 0, tit2(version, 'Intro — ünïcode'))
      );
      assert.deepEqual(await readEmbeddedChapters(bufferSource(tag)), [
        { startTime: 0, title: 'Intro — ünïcode' },
        { startTime: 90.5, title: 'Second' },
      ]);
    });
  }

  it('reads the chapter link and picture', async () => {
    const link = frame(3, 'WXXX', bytes([0], 'desc', [0], 'https://example.com/a'));
    const pic = frame(3, 'APIC', bytes([0], 'image/png', [0, 3], 'cover', [0], [1, 2, 3]));
    const [chapter] = await readEmbeddedChapters(bufferSource(id3(3, chap(3, 'c', 5000, tit2(3, 'A'), link, pic))));
    assert.equal(chapter.url, 'https://example.com/a');
    assert.equal(chapter.img, 'data:image/png;base64,AQID');
  });

  it('skips a large cover without reading it', async () => {
    const cover = frame(3, 'APIC', bytes([0], 'image/jpeg', [0, 3], [0], new Uint8Array(2_000_000)));
    const tag = id3(3, cover, chap(3, 'c', 1000, tit2(3, 'Only')));
    const { reads, source } = counting(bufferSource(tag));
    assert.deepEqual(await readEmbeddedChapters(source), [{ startTime: 1, title: 'Only' }]);
    assert.ok(reads.every(([, length]) => length <= 4096));
  });

  it('decodes each text encoding', () => {
    assert.equal(textFrame(bytes([0], 'Caf', [0xe9])), 'Café');
    assert.equal(textFrame(bytes([1, 0xff, 0xfe], 'H', [0], 'i', [0], [0, 0], 'junk')), 'Hi');
    assert.equal(textFrame(bytes([2], [0], 'H', [0], 'i')), 'Hi');
    assert.equal(textFrame(bytes([3], utf8('日本'), [0])), '日本');
    assert.equal(linkFrame(bytes([1, 0xff, 0xfe], 'd', [0], [0, 0], 'http://x.y')), 'http://x.y');
    assert.equal(pictureFrame(bytes([0], '-->', [0, 3, 0], 'http://x.y/a.jpg')), null);
    assert.equal(pictureFrame(bytes([0], 'JPG', [0, 3, 0], [9])), 'data:image/jpeg;base64,CQ==');
  });

  it('has no chapters without a tag, or with ID3v2.2', async () => {
    assert.deepEqual(await readEmbeddedChapters(bufferSource(bytes([0xff, 0xfb, 0x90, 0x00], 'mp3 frames'))), []);
    assert.deepEqual(await readEmbeddedChapters(bufferSource(bytes('ID3', [2, 0, 0], syncsafe(0)))), []);
  });
});

/** A minimal M4A: an audio track pointing at a text chapter track, plus Nero chapters. */
function m4a({ moovLast = false, nero = true, track = true } = {}) {
  const titles = ['Opening', 'Middle'].map((title) => bytes([0, utf8(title).length], utf8(title)));
  const mdat = box('mdat', new Uint8Array(5000), ...titles);
  const tkhd = (id: number) => box('tkhd', [0, 0, 0, 0], be32(0), be32(0), be32(id), new Array(60).fill(0));
  const audio = box('trak', tkhd(1), track ? box('tref', box('chap', be32(2))) : [], box('mdia'));
  const text = (mdatAt: number) =>
    box(
      'trak',
      tkhd(2),
      box(
        'mdia',
        box('mdhd', [0, 0, 0, 0], be32(0), be32(0), be32(1000), be32(120_000), [0, 0, 0, 0]),
        box('hdlr', [0, 0, 0, 0], be32(0), 'text', new Array(12).fill(0), [0]),
        box(
          'minf',
          box(
            'stbl',
            box('stts', [0, 0, 0, 0], be32(2), be32(1), be32(30_000), be32(1), be32(90_000)),
            box('stsc', [0, 0, 0, 0], be32(1), be32(1), be32(2), be32(1)),
            box('stsz', [0, 0, 0, 0], be32(0), be32(2), be32(titles[0].length), be32(titles[1].length)),
            box('stco', [0, 0, 0, 0], be32(1), be32(mdatAt + 8 + 5000))
          )
        )
      )
    );
  const chpl = box(
    'udta',
    box('chpl', [1, 0, 0, 0], be32(0), [2], be64(0), [4], 'Nero', be64(600_000_000), [3], 'Two')
  );
  const ftyp = box('ftyp', 'M4A ', be32(0), 'M4A isom');
  const moov = (mdatAt: number) => box('moov', audio, text(mdatAt), nero ? chpl : []);
  if (!moovLast) {
    const size = moov(0).length;
    return bytes(ftyp, moov(ftyp.length + size), mdat);
  }
  return bytes(ftyp, mdat, moov(ftyp.length));
}

describe('MP4 chapters', () => {
  it('reads the QuickTime chapter track first', async () => {
    assert.deepEqual(await readEmbeddedChapters(bufferSource(m4a())), [
      { startTime: 0, title: 'Opening' },
      { startTime: 30, title: 'Middle' },
    ]);
  });

  it('finds moov at the end of the file', async () => {
    const file = m4a({ moovLast: true });
    const { reads, source } = counting(bufferSource(file));
    assert.equal((await readEmbeddedChapters(source)).length, 2);
    assert.ok(
      reads.every(([, length]) => length < 4000),
      'the media data is never read whole'
    );
  });

  it('falls back to Nero chapters', async () => {
    assert.deepEqual(await readEmbeddedChapters(bufferSource(m4a({ track: false }))), [
      { startTime: 0, title: 'Nero' },
      { startTime: 60, title: 'Two' },
    ]);
    assert.deepEqual(await readEmbeddedChapters(bufferSource(m4a({ track: false, nero: false }))), []);
  });

  it('skips samples too large to be titles, or outside the file', async () => {
    const file = m4a({ nero: false });
    const view = Buffer.from(file);
    const stsz = view.indexOf('stsz');
    view.writeUInt32BE(0xffffffff, stsz + 4 + 12); // first sample's size
    const { reads, source } = counting(bufferSource(Uint8Array.from(view)));
    // Both titles share a chunk, so the bogus size also pushes the second one past the end.
    assert.deepEqual(await readEmbeddedChapters(source), []);
    assert.ok(reads.every(([, length]) => length < 4000));
  });

  it('decodes UTF-16 text samples', () => {
    assert.equal(sampleText(bytes([0, 6, 0xfe, 0xff, 0, 'H'.charCodeAt(0), 0, 'i'.charCodeAt(0)])), 'Hi');
    assert.equal(sampleText(bytes([0])), '');
  });
});

describe('block source', () => {
  it('reads across blocks, fetching each block once', async () => {
    const data = Uint8Array.from({ length: 200_000 }, (_, i) => i % 251);
    const fetched: number[] = [];
    const src = blockSource(async (offset, length) => {
      fetched.push(offset);
      return data.subarray(offset, offset + length);
    }, data.length);
    assert.deepEqual(await src.read(65_530, 20), data.subarray(65_530, 65_550));
    assert.deepEqual(await src.read(65_536, 10), data.subarray(65_536, 65_546));
    assert.deepEqual(await src.read(199_990, 100), data.subarray(199_990));
    assert.deepEqual(fetched, [0, 65_536, 196_608]);
  });
});
