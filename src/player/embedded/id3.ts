import type { Chapter } from '../chapters';
import { ascii, binaryString, latin1, syncsafe, u32, utf16, utf8, type ByteSource } from './bytes';

/**
 * ID3v2 chapters (the CHAP frame, ID3v2 Chapter Frame Addendum), as
 * AntennaPod's ChapterReader reads them: a title (TIT2), a link (WXXX) and a
 * picture (APIC) per chapter. Only the frame headers and the CHAP frames are
 * read, so a large cover image at the front of the tag is skipped unread.
 */

/** Chapter pictures larger than this stay unread, and the episode art shows instead. */
const MAX_IMAGE = 512 * 1024;
const MAX_FRAMES = 5000;

type Frame = { id: string; body: number; size: number };

export async function readId3Chapters(src: ByteSource): Promise<Chapter[]> {
  const header = await src.read(0, 10);
  if (header.length < 10 || ascii(header, 0, 3) !== 'ID3') return [];
  const version = header[3];
  const flags = header[5];
  // ID3v2.2 has no chapter frame; a whole-tag unsynchronised v2.3 tag is
  // rare enough not to undo.
  if ((version !== 3 && version !== 4) || flags & 0x80) return [];

  const end = 10 + syncsafe(header, 6);
  let at = 10;
  if (flags & 0x40) {
    const ext = await src.read(10, 4);
    at += version === 4 ? syncsafe(ext, 0) : 4 + u32(ext, 0);
  }

  const chapters: Chapter[] = [];
  for (const frame of await frames(src, version, at, end)) {
    if (frame.id !== 'CHAP') continue;
    const chapter = await readChap(src, version, frame);
    if (chapter) chapters.push(chapter);
  }
  return chapters.sort((a, b) => a.startTime - b.startTime);
}

/** The frames between `start` and `end`, stopping at padding or anything malformed. */
async function frames(src: ByteSource, version: number, start: number, end: number): Promise<Frame[]> {
  const found: Frame[] = [];
  let at = start;
  while (at + 10 <= end && found.length < MAX_FRAMES) {
    const h = await src.read(at, 10);
    if (h.length < 10 || !/^[A-Z0-9]{4}$/.test(ascii(h, 0, 4))) break;
    const size = version === 4 ? syncsafe(h, 4) : u32(h, 4);
    if (size === 0 || at + 10 + size > end) break;
    const format = h[9];
    // Compressed, encrypted or unsynchronised frames are skipped; grouping
    // and data-length fields only move where the body starts.
    const unreadable = version === 4 ? format & 0x0e : format & 0xc0;
    if (!unreadable) {
      const skip = version === 4 ? (format & 0x40 ? 1 : 0) + (format & 0x01 ? 4 : 0) : format & 0x20 ? 1 : 0;
      if (skip < size) found.push({ id: ascii(h, 0, 4), body: at + 10 + skip, size: size - skip });
    }
    at += 10 + size;
  }
  return found;
}

async function readChap(src: ByteSource, version: number, frame: Frame): Promise<Chapter | null> {
  const head = await src.read(frame.body, Math.min(frame.size, 300));
  const idEnd = head.indexOf(0);
  if (idEnd < 0 || idEnd + 17 > frame.size) return null;
  const startMs = u32(head, idEnd + 1);
  const chapter: Chapter = { startTime: startMs / 1000, title: '' };

  const subStart = frame.body + idEnd + 17;
  for (const sub of await frames(src, version, subStart, frame.body + frame.size)) {
    if (sub.id === 'TIT2') {
      chapter.title = textFrame(await src.read(sub.body, Math.min(sub.size, 4096)));
    } else if (sub.id === 'WXXX') {
      const url = linkFrame(await src.read(sub.body, Math.min(sub.size, 4096)));
      if (/^https?:\/\//i.test(url)) chapter.url = url;
    } else if (sub.id === 'APIC' && sub.size <= MAX_IMAGE && !chapter.img) {
      chapter.img = pictureFrame(await src.read(sub.body, sub.size)) ?? undefined;
    }
  }
  return chapter;
}

/** Decodes `b` in ID3's text encoding `encoding`. */
function decode(encoding: number, b: Uint8Array): string {
  if (encoding === 1) return utf16(b);
  if (encoding === 2) return utf16(b, true);
  if (encoding === 3) return utf8(b);
  return latin1(b);
}

/** Where a string in `encoding` starting at `from` ends: its terminator, or the end. */
function terminator(encoding: number, b: Uint8Array, from: number): { end: number; next: number } {
  if (encoding === 1 || encoding === 2) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return { end: i, next: i + 2 };
    return { end: b.length, next: b.length };
  }
  const i = b.indexOf(0, from);
  return i < 0 ? { end: b.length, next: b.length } : { end: i, next: i + 1 };
}

export function textFrame(b: Uint8Array): string {
  if (b.length < 1) return '';
  const encoding = b[0];
  return decode(encoding, b.subarray(1, terminator(encoding, b, 1).end)).trim();
}

/** WXXX: encoding, a description, then the URL in Latin-1. */
export function linkFrame(b: Uint8Array): string {
  if (b.length < 1) return '';
  const encoding = b[0];
  const rest = b.subarray(terminator(encoding, b, 1).next);
  const end = rest.indexOf(0);
  return latin1(end < 0 ? rest : rest.subarray(0, end)).trim();
}

/** APIC: encoding, MIME type, picture type, description, then the image, as a data URI. */
export function pictureFrame(b: Uint8Array): string | null {
  if (b.length < 4) return null;
  const encoding = b[0];
  const mimeEnd = b.indexOf(0, 1);
  if (mimeEnd < 0) return null;
  let mime = latin1(b.subarray(1, mimeEnd)).trim().toLowerCase();
  if (mime === '-->') return null; // a link to the picture, not the picture
  if (!mime.includes('/')) mime = `image/${mime === 'jpg' ? 'jpeg' : mime || 'jpeg'}`;
  if (!mime.startsWith('image/')) return null;
  const data = b.subarray(terminator(encoding, b, mimeEnd + 2).next);
  if (data.length === 0) return null;
  return `data:${mime};base64,${btoa(binaryString(data))}`;
}
