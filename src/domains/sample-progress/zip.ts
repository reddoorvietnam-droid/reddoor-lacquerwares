import "server-only";
import { deflateRawSync } from "node:zlib";

/**
 * The smallest ZIP writer that produces a valid .xlsx package.
 *
 * SheetJS Community Edition cannot write cell styles or charts, and the
 * exported report has to carry both, so the workbook parts are written as
 * OOXML by hand and packed here. Node's zlib does the compression; nothing
 * else is needed, which keeps a report format this visible free of a new
 * third-party dependency.
 */

export type ZipEntry = { name: string; data: Uint8Array };

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, the only timestamp a classic ZIP entry can carry. */
function dosStamp(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getUTCFullYear());
  return {
    time:
      (date.getUTCHours() << 11) |
      (date.getUTCMinutes() << 5) |
      (date.getUTCSeconds() >> 1),
    date:
      ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
  };
}

class ByteWriter {
  private readonly parts: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array) {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  /** Little-endian fixed-width fields, as every ZIP record uses. */
  u16(value: number) {
    this.push(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number) {
    this.push(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  toUint8Array(): Uint8Array {
    const result = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
}

/**
 * `modified` is passed in rather than read from the clock so that exporting the
 * same saved revision twice produces the same bytes.
 */
export function createZip(entries: ZipEntry[], modified: Date): Uint8Array {
  const stamp = dosStamp(modified);
  const encoder = new TextEncoder();
  const body = new ByteWriter();
  const directory = new ByteWriter();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const deflated = deflateRawSync(entry.data, { level: 9 });
    // Store the entry raw when compressing it would not actually shrink it.
    const stored = deflated.length >= entry.data.length;
    const payload = stored ? entry.data : new Uint8Array(deflated);
    const offset = body.length;

    body.u32(0x04034b50);
    body.u16(20); // version needed to extract
    body.u16(0x0800); // UTF-8 file names
    body.u16(stored ? 0 : 8);
    body.u16(stamp.time);
    body.u16(stamp.date);
    body.u32(crc);
    body.u32(payload.length);
    body.u32(entry.data.length);
    body.u16(name.length);
    body.u16(0); // no extra field
    body.push(name);
    body.push(payload);

    directory.u32(0x02014b50);
    directory.u16(20); // version made by
    directory.u16(20); // version needed to extract
    directory.u16(0x0800);
    directory.u16(stored ? 0 : 8);
    directory.u16(stamp.time);
    directory.u16(stamp.date);
    directory.u32(crc);
    directory.u32(payload.length);
    directory.u32(entry.data.length);
    directory.u16(name.length);
    directory.u16(0); // extra field length
    directory.u16(0); // comment length
    directory.u16(0); // disk number start
    directory.u16(0); // internal attributes
    directory.u32(0); // external attributes
    directory.u32(offset);
    directory.push(name);
  }

  const archive = new ByteWriter();
  archive.push(body.toUint8Array());
  const directoryOffset = archive.length;
  archive.push(directory.toUint8Array());
  archive.u32(0x06054b50);
  archive.u16(0);
  archive.u16(0);
  archive.u16(entries.length);
  archive.u16(entries.length);
  archive.u32(directory.length);
  archive.u32(directoryOffset);
  archive.u16(0); // no archive comment
  return archive.toUint8Array();
}
