/**
 * Writing over a video's bytes in place
 *
 * Both container parsers describe what a video loses as patches: stretches of
 * the file to overwrite, with zeros or a few new bytes, at the same length, so
 * nothing else in the file moves. These are the patches and the byte helpers
 * the parsers share.
 *
 * @module modules/media/video-bytes
 */

export type Bytes = Uint8Array<ArrayBuffer>;

/** Bytes to write over part of the file, zeros where none are given. */
export interface Patch {
  start: number;
  end: number;
  bytes?: Bytes;
}

export type Range = [start: number, end: number];

/** Whether the file already holds what a patch would write. */
export function alreadyWritten(bytes: Bytes, { start, end, bytes: written }: Patch): boolean {
  for (let index = start; index < end; index += 1)
    if (bytes[index] !== (written ? written[index - start] : 0)) return false;
  return true;
}

export function hasBytes(bytes: Bytes, offset: number, expected: number[]): boolean {
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

export function text(bytes: Bytes, offset: number, length: number): string {
  let value = "";
  for (let index = offset; index < Math.min(offset + length, bytes.length); index += 1)
    value += String.fromCharCode(bytes[index]);
  return value;
}

export function ascii(value: string): Bytes {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

export function viewOf(bytes: Bytes): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
