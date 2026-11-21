import { parseNormalPlayTime } from '../../feed/podloveChapters';
import type { Chapter } from '../chapters';
import { ascii, utf8, type ByteSource } from './bytes';

/**
 * Chapters in Vorbis comments, as Ogg Vorbis, Ogg Opus and FLAC files carry
 * them (the "Vorbis chapter extension", which AntennaPod reads too):
 *
 *   CHAPTER001=00:00:00.000
 *   CHAPTER001NAME=Intro
 *   CHAPTER001URL=https://…
 *
 * Only the comment header is read; the audio after it never is.
 */

/** Pages walked looking for the comment header before giving up. */
const MAX_PAGES = 512;
/** A comment longer than this (cover art) is skipped unread. */
const MAX_COMMENT = 4096;
/** Comments read at most, so a broken count can't spin. */
const MAX_COMMENTS = 1024;

const le32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/**
 * Reads a span of bytes that may be split across several places in the file
 * (a packet spread over Ogg pages), as if it were one run.
 */
class Spans {
  private readonly src: ByteSource;
  private readonly spans: { offset: number; length: number }[];
  readonly length: number;

  constructor(src: ByteSource, spans: { offset: number; length: number }[]) {
    this.src = src;
    this.spans = spans;
    this.length = spans.reduce((total, span) => total + span.length, 0);
  }

  async read(at: number, length: number): Promise<Uint8Array> {
    const out = new Uint8Array(Math.max(0, Math.min(length, this.length - at)));
    let filled = 0;
    let start = 0;
    for (const span of this.spans) {
      if (filled === out.length) break;
      const end = start + span.length;
      if (at + filled < end) {
        const from = at + filled - start;
        const take = Math.min(span.length - from, out.length - filled);
        const got = await this.src.read(span.offset + from, take);
        out.set(got, filled);
        filled += got.length;
        if (got.length < take) break;
      }
      start = end;
    }
    return out.subarray(0, filled);
  }
}

/** Where the Ogg stream's second packet (the comment header) lies in the file. */
async function oggCommentPacket(src: ByteSource): Promise<Spans | null> {
  const spans: { offset: number; length: number }[] = [];
  let offset = 0;
  let packet = 0;
  let serial: number | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const header = await src.read(offset, 27);
    if (header.length < 27 || ascii(header, 0, 4) !== 'OggS') return null;
    const segments = header[26];
    const lacing = await src.read(offset + 27, segments);
    if (lacing.length < segments) return null;
    const pageSerial = le32(header, 14);
    serial ??= pageSerial;
    let at = offset + 27 + segments;
    // Pages of another stream (a multiplexed file) don't belong to ours.
    const ours = pageSerial === serial;
    for (let i = 0; i < segments; i++) {
      const size = lacing[i];
      if (ours && packet === 1 && size > 0) spans.push({ offset: at, length: size });
      at += size;
      // A lacing value under 255 ends the packet.
      if (ours && size < 255) {
        if (packet === 1) return new Spans(src, spans);
        packet++;
      }
    }
    offset = at;
  }
  return null;
}

/** Parses a Vorbis comment block starting at `at` in `data` into chapters. */
async function chaptersFromComments(data: Spans, at: number): Promise<Chapter[]> {
  const read32 = async (offset: number) => {
    const b = await data.read(offset, 4);
    return b.length === 4 ? le32(b, 0) : null;
  };
  const vendor = await read32(at);
  if (vendor === null) return [];
  at += 4 + vendor;
  const count = await read32(at);
  if (count === null) return [];
  at += 4;

  const starts = new Map<string, number>();
  const names = new Map<string, string>();
  const urls = new Map<string, string>();
  for (let i = 0; i < Math.min(count, MAX_COMMENTS); i++) {
    const length = await read32(at);
    if (length === null) break;
    at += 4;
    if (length <= MAX_COMMENT) {
      const comment = utf8(await data.read(at, length));
      const eq = comment.indexOf('=');
      const match = eq > 0 ? /^CHAPTER(\d+)(NAME|URL)?$/i.exec(comment.slice(0, eq)) : null;
      if (match) {
        const [, id, field] = match;
        const value = comment.slice(eq + 1).trim();
        if (!field) {
          const start = parseNormalPlayTime(value);
          if (start !== null) starts.set(id, start);
        } else if (field.toUpperCase() === 'NAME') names.set(id, value);
        else if (/^https?:\/\//i.test(value)) urls.set(id, value);
      }
    }
    at += length;
  }

  return [...starts]
    .map(([id, startTime]): Chapter => {
      const url = urls.get(id);
      return url ? { startTime, title: names.get(id) ?? '', url } : { startTime, title: names.get(id) ?? '' };
    })
    .sort((a, b) => a.startTime - b.startTime);
}

/** Chapters in an Ogg Vorbis or Ogg Opus file. */
export async function readOggChapters(src: ByteSource): Promise<Chapter[]> {
  const packet = await oggCommentPacket(src);
  if (!packet) return [];
  const head = await packet.read(0, 8);
  // Vorbis: packet type 3 then "vorbis"; Opus: "OpusTags".
  if (head.length >= 7 && head[0] === 3 && ascii(head, 1, 6) === 'vorbis') return chaptersFromComments(packet, 7);
  if (head.length >= 8 && ascii(head, 0, 8) === 'OpusTags') return chaptersFromComments(packet, 8);
  return [];
}

/** Chapters in a FLAC file's VORBIS_COMMENT block. */
export async function readFlacChapters(src: ByteSource): Promise<Chapter[]> {
  let offset = 4; // after "fLaC"
  for (let block = 0; block < 128; block++) {
    const header = await src.read(offset, 4);
    if (header.length < 4) return [];
    const type = header[0] & 0x7f;
    const length = (header[1] << 16) | (header[2] << 8) | header[3];
    if (type === 4) return chaptersFromComments(new Spans(src, [{ offset: offset + 4, length }]), 0);
    if (header[0] & 0x80) return []; // that was the last metadata block
    offset += 4 + length;
  }
  return [];
}
