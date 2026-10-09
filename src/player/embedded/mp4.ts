import type { Chapter } from '../chapters';
import { ascii, u16, u32, u64, utf16, utf8, type ByteSource } from './bytes';

/**
 * MP4 / M4A chapters, in the two forms podcast tools write: a QuickTime text
 * track the audio track points at (`tref/chap`, Apple's form), and Nero's
 * `moov/udta/chpl` list. Only the box headers on the way to `moov`, `moov`
 * itself and the chapter titles are read, wherever in the file `moov` is.
 */

/** A `moov` larger than this (hours of tiny samples) is left unread. */
const MAX_MOOV = 16 * 1024 * 1024;
const MAX_CHAPTERS = 1000;
/** Chapter titles closer together than this are read in one go. */
const MAX_SPAN = 256 * 1024;
/** A chapter title sample is a few bytes; anything larger is a corrupt table, not a title. */
const MAX_SAMPLE = 4096;

type Box = { type: string; start: number; end: number };

export async function readMp4Chapters(src: ByteSource): Promise<Chapter[]> {
  const moov = await findMoov(src);
  if (!moov) return [];
  const fromTrack = await trackChapters(src, moov);
  return fromTrack.length ? fromTrack : neroChapters(moov);
}

async function findMoov(src: ByteSource): Promise<Uint8Array | null> {
  let at = 0;
  for (let i = 0; i < 1000; i++) {
    const h = await src.read(at, 16);
    if (h.length < 8) return null;
    let size = u32(h, 0);
    const type = ascii(h, 4, 4);
    if (size === 1) {
      if (h.length < 16) return null;
      size = u64(h, 8);
    } else if (size === 0) {
      if (src.size == null) return null;
      size = src.size - at;
    }
    if (size < 8) return null;
    if (type === 'moov') {
      if (size > MAX_MOOV) return null;
      const moov = await src.read(at, size);
      return moov.length === size ? moov : null;
    }
    at += size;
    if (src.size != null && at >= src.size) return null;
  }
  return null;
}

/** The boxes directly inside `b[start, end)`. */
function children(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    let size = u32(b, at);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) break;
      size = u64(b, at + 8);
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < header || at + size > end) break;
    out.push({ type: ascii(b, at + 4, 4), start: at + header, end: at + size });
    at += size;
  }
  return out;
}

/** The first box along `path` below `box`. */
function find(b: Uint8Array, box: Box, ...path: string[]): Box | null {
  let current: Box | null = box;
  for (const type of path) {
    current = children(b, current.start, current.end).find((child) => child.type === type) ?? null;
    if (!current) return null;
  }
  return current;
}

/** Nero chapters: a count, then each start (in 100 ns) with a length-prefixed UTF-8 title. */
export function neroChapters(moov: Uint8Array): Chapter[] {
  const root: Box = { type: 'moov', start: 8, end: moov.length };
  const chpl = find(moov, root, 'udta', 'chpl');
  if (!chpl) return [];
  let at = chpl.start;
  const version = moov[at];
  at += 4 + (version ? 4 : 0);
  const count = moov[at++];
  const chapters: Chapter[] = [];
  for (let i = 0; i < count && at + 9 <= chpl.end; i++) {
    const start = u64(moov, at);
    const length = moov[at + 8];
    at += 9;
    if (at + length > chpl.end) break;
    chapters.push({ startTime: start / 1e7, title: utf8(moov.subarray(at, at + length)).trim() });
    at += length;
  }
  return chapters.sort((a, b) => a.startTime - b.startTime);
}

type Sample = { time: number; offset: number; size: number };

/** Each sample's start time and where it is in the file, from a track's sample tables. */
export function chapterSamples(moov: Uint8Array, trak: Box): Sample[] {
  const mdhd = find(moov, trak, 'mdia', 'mdhd');
  const stbl = find(moov, trak, 'mdia', 'minf', 'stbl');
  if (!mdhd || !stbl) return [];
  const timescale = u32(moov, mdhd.start + (moov[mdhd.start] === 1 ? 20 : 12));
  const table = (type: string) => find(moov, stbl, type);
  const stts = table('stts');
  const stsz = table('stsz');
  const stsc = table('stsc');
  const stco = table('stco');
  const co64 = table('co64');
  if (!timescale || !stts || !stsz || !stsc || (!stco && !co64)) return [];

  const sampleCount = Math.min(u32(moov, stsz.start + 8), MAX_CHAPTERS);
  const fixedSize = u32(moov, stsz.start + 4);
  const sizeOf = (i: number) => (fixedSize ? fixedSize : u32(moov, stsz.start + 12 + 4 * i));

  const chunks = stco ?? co64!;
  const chunkCount = u32(moov, chunks.start + 4);
  const chunkOffset = (i: number) => (stco ? u32(moov, stco.start + 8 + 4 * i) : u64(moov, co64!.start + 8 + 8 * i));

  const runs = Array.from({ length: u32(moov, stsc.start + 4) }, (_, i) => ({
    firstChunk: u32(moov, stsc.start + 8 + 12 * i),
    perChunk: u32(moov, stsc.start + 12 + 12 * i),
  }));

  const samples: Sample[] = [];
  let sample = 0;
  for (let chunk = 1; chunk <= chunkCount && sample < sampleCount; chunk++) {
    const run = runs.filter((r) => r.firstChunk <= chunk).pop();
    if (!run) break;
    let offset = chunkOffset(chunk - 1);
    for (let k = 0; k < run.perChunk && sample < sampleCount; k++, sample++) {
      samples.push({ time: 0, offset, size: sizeOf(sample) });
      offset += sizeOf(sample);
    }
  }

  let time = 0;
  let index = 0;
  const entries = u32(moov, stts.start + 4);
  for (let e = 0; e < entries && index < samples.length; e++) {
    const count = u32(moov, stts.start + 8 + 8 * e);
    const delta = u32(moov, stts.start + 12 + 8 * e);
    for (let k = 0; k < count && index < samples.length; k++, index++) {
      samples[index].time = time / timescale;
      time += delta;
    }
  }
  return samples.slice(0, index);
}

/** The text track an audio track names as its chapters, read sample by sample. */
async function trackChapters(src: ByteSource, moov: Uint8Array): Promise<Chapter[]> {
  const root: Box = { type: 'moov', start: 8, end: moov.length };
  const traks = children(moov, root.start, root.end).filter((box) => box.type === 'trak');
  const idOf = (trak: Box) => {
    const tkhd = find(moov, trak, 'tkhd');
    return tkhd ? u32(moov, tkhd.start + (moov[tkhd.start] === 1 ? 20 : 12)) : -1;
  };

  const chapterIds = new Set<number>();
  for (const trak of traks) {
    const chap = find(moov, trak, 'tref', 'chap');
    for (let at = chap?.start ?? 0; chap && at + 4 <= chap.end; at += 4) chapterIds.add(u32(moov, at));
  }
  const textTrak = traks.find((trak) => {
    if (!chapterIds.has(idOf(trak))) return false;
    const hdlr = find(moov, trak, 'mdia', 'hdlr');
    return !!hdlr && ['text', 'sbtl'].includes(ascii(moov, hdlr.start + 8, 4));
  });
  if (!textTrak) return [];

  // The tables are untrusted: read only title-sized samples inside the file.
  const samples = chapterSamples(moov, textTrak).filter(
    (s) => s.size <= MAX_SAMPLE && (src.size == null || s.offset + s.size <= src.size)
  );
  if (!samples.length) return [];
  const first = Math.min(...samples.map((s) => s.offset));
  const last = Math.max(...samples.map((s) => s.offset + s.size));
  const span = last - first <= MAX_SPAN ? await src.read(first, last - first) : null;

  const chapters: Chapter[] = [];
  for (const s of samples) {
    const bytes = span ? span.subarray(s.offset - first, s.offset - first + s.size) : await src.read(s.offset, s.size);
    chapters.push({ startTime: s.time, title: sampleText(bytes) });
  }
  return chapters.sort((a, b) => a.startTime - b.startTime);
}

/** A QuickTime text sample: a 16-bit length, then UTF-8, or UTF-16 after a byte-order mark. */
export function sampleText(b: Uint8Array): string {
  if (b.length < 2) return '';
  const text = b.subarray(2, 2 + Math.min(u16(b, 0), b.length - 2));
  const bom = text.length >= 2 && ((text[0] === 0xfe && text[1] === 0xff) || (text[0] === 0xff && text[1] === 0xfe));
  return (bom ? utf16(text) : utf8(text)).trim();
}
