import { crc32, inflateRawSync } from "node:zlib";

/**
 * Reads a ZIP the way a strict packager does, CRC check included.
 *
 * Excel's OPC layer refuses a package whose CRC-32 is wrong, while SheetJS and
 * most JavaScript unzippers ignore the field entirely — so a workbook test that
 * only round-trips through SheetJS would pass on a file Excel cannot open.
 */
export type ZipParts = Map<string, Uint8Array>;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_LENGTH = 30;

export function readZipParts(archive: Uint8Array): ZipParts {
  const view = new DataView(
    archive.buffer,
    archive.byteOffset,
    archive.byteLength,
  );
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= 0; offset--)
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      eocd = offset;
      break;
    }
  if (eocd < 0) throw new Error("End of central directory not found.");

  const total = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const parts: ZipParts = new Map();

  for (let index = 0; index < total; index++) {
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE)
      throw new Error(`Central directory entry ${index} is malformed.`);
    const method = view.getUint16(cursor + 10, true);
    const declaredCrc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(
      archive.subarray(cursor + 46, cursor + 46 + nameLength),
    );

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start =
      localOffset + LOCAL_HEADER_LENGTH + localNameLength + localExtraLength;
    const payload = archive.subarray(start, start + compressedSize);
    const content =
      method === 0 ? payload : new Uint8Array(inflateRawSync(payload));

    if (content.length !== uncompressedSize)
      throw new Error(`Entry ${name} has the wrong uncompressed size.`);
    if (crc32(content) !== declaredCrc)
      throw new Error(`Entry ${name} has a CRC-32 Excel would reject.`);
    if (view.getUint32(localOffset + 14, true) !== declaredCrc)
      throw new Error(`Entry ${name} has mismatched local and central CRCs.`);

    parts.set(name, content);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

export function readZipText(archive: Uint8Array, name: string): string {
  const part = readZipParts(archive).get(name);
  if (!part) throw new Error(`Entry ${name} is missing.`);
  return new TextDecoder().decode(part);
}

/**
 * A deliberately strict, dependency-free well-formedness check: every start tag
 * must be closed, in order. It catches the unbalanced-tag mistakes that hand
 * written XML is prone to and that SheetJS would silently tolerate.
 */
export function assertWellFormedXml(xml: string, label: string): void {
  const stack: string[] = [];
  const tag = /<([/?!]?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(xml))) {
    const [, prefix, name, attributes, selfClose] = match;
    if (prefix === "?" || prefix === "!") continue;
    if (prefix === "/") {
      const open = stack.pop();
      if (open !== name)
        throw new Error(
          `${label}: closing </${name}> does not match <${open ?? "nothing"}>.`,
        );
      continue;
    }
    if (selfClose !== "/" && !attributes?.trimEnd().endsWith("/"))
      stack.push(name!);
  }
  if (stack.length)
    throw new Error(`${label}: unclosed ${stack.map((n) => `<${n}>`).join(", ")}.`);
}
