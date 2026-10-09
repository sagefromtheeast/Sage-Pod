/**
 * Random access to an audio file's bytes, from a download on disk or a
 * stream over HTTP ranges, so the chapter readers never load whole files.
 */
export type ByteSource = {
  /** Up to `length` bytes from `offset`; fewer only at the end of the file. */
  read(offset: number, length: number): Promise<Uint8Array>;
  /** Total length, when known. */
  size: number | null;
};

/** A source over bytes already in memory (tests, and small files). */
export function bufferSource(bytes: Uint8Array): ByteSource {
  return {
    size: bytes.length,
    read: async (offset, length) => bytes.subarray(offset, Math.min(bytes.length, offset + length)),
  };
}

const BLOCK = 64 * 1024;

/**
 * Reads in 64 KB blocks and keeps them, so walking many small headers costs
 * one request per block rather than one per header, and skipping a large
 * cover image never fetches it.
 */
export function blockSource(
  readRaw: (offset: number, length: number) => Promise<Uint8Array>,
  size: number | null
): ByteSource {
  const blocks = new Map<number, Promise<Uint8Array>>();
  const block = (index: number) => {
    let got = blocks.get(index);
    if (!got) {
      got = readRaw(index * BLOCK, BLOCK);
      got.catch(() => blocks.delete(index));
      blocks.set(index, got);
    }
    return got;
  };
  return {
    size,
    async read(offset, length) {
      const end = size == null ? offset + length : Math.min(size, offset + length);
      if (end <= offset) return new Uint8Array(0);
      const first = Math.floor(offset / BLOCK);
      const last = Math.floor((end - 1) / BLOCK);
      const parts = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) => block(first + i)));
      const out = new Uint8Array(end - offset);
      let filled = 0;
      for (let i = 0; i < parts.length; i++) {
        const blockStart = (first + i) * BLOCK;
        const from = Math.max(0, offset - blockStart);
        const to = Math.min(parts[i].length, end - blockStart);
        if (to <= from) break;
        out.set(parts[i].subarray(from, to), filled);
        filled += to - from;
        if (parts[i].length < BLOCK) break; // the file ended inside this block
      }
      return filled === out.length ? out : out.subarray(0, filled);
    },
  };
}

export const u16 = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
export const u32 = (b: Uint8Array, at: number) =>
  ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
export const u64 = (b: Uint8Array, at: number) => u32(b, at) * 2 ** 32 + u32(b, at + 4);
/** ID3v2's 7-bits-per-byte integers. */
export const syncsafe = (b: Uint8Array, at: number) =>
  ((b[at] & 0x7f) << 21) | ((b[at + 1] & 0x7f) << 14) | ((b[at + 2] & 0x7f) << 7) | (b[at + 3] & 0x7f);
export const ascii = (b: Uint8Array, at: number, length: number) => String.fromCharCode(...b.subarray(at, at + length));

export function latin1(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
  return out;
}

export function utf8(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; ) {
    const c = b[i];
    let cp: number;
    let n: number;
    if (c < 0x80) [cp, n] = [c, 1];
    else if (c >= 0xc0 && c < 0xe0) [cp, n] = [c & 0x1f, 2];
    else if (c >= 0xe0 && c < 0xf0) [cp, n] = [c & 0x0f, 3];
    else if (c >= 0xf0 && c < 0xf8) [cp, n] = [c & 0x07, 4];
    else [cp, n] = [0xfffd, 1];
    for (let k = 1; k < n; k++) {
      const next = b[i + k];
      if (next === undefined || (next & 0xc0) !== 0x80) {
        [cp, n] = [0xfffd, k];
        break;
      }
      cp = (cp << 6) | (next & 0x3f);
    }
    out += String.fromCodePoint(cp);
    i += n;
  }
  return out;
}

/** UTF-16 with an optional byte-order mark; big-endian without one. */
export function utf16(b: Uint8Array, bigEndian = true): string {
  let at = 0;
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) [bigEndian, at] = [false, 2];
  else if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) [bigEndian, at] = [true, 2];
  const units: number[] = [];
  for (; at + 1 < b.length; at += 2) units.push(bigEndian ? (b[at] << 8) | b[at + 1] : b[at] | (b[at + 1] << 8));
  let out = '';
  for (let i = 0; i < units.length; i += 4096) out += String.fromCharCode(...units.slice(i, i + 4096));
  return out;
}

/** A binary string for `btoa`, in slices so large images don't overflow the call stack. */
export function binaryString(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 4096) out += String.fromCharCode(...b.subarray(i, i + 4096));
  return out;
}
