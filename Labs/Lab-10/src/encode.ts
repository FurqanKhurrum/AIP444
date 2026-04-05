// src/encode.ts
import { DataURI, DataURISchema, EXTENSION_TO_MIME, MediaTypeSchema, getCategory } from './types';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Reads a media file from disk and returns it as a Data URI.
 *
 * @param filePath - Path to the media file
 * @returns A DataURI object with the encoded content
 * @throws Error if the file doesn't exist
 * @throws Error if the file extension is unsupported
 * @throws Error if the file is empty (0 bytes)
 */
export async function encodeFile(filePath: string): Promise<DataURI> {
  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error('file not found');
    }
    throw error;
  }

  if (data.length === 0) {
    throw new Error('file is empty');
  }

  const extension = path.extname(filePath).slice(1).toLowerCase();
  const mediaType = EXTENSION_TO_MIME[extension];
  if (!mediaType) {
    throw new Error('unsupported file extension');
  }

  const base64 = data.toString('base64');
  const raw = `data:${mediaType};base64,${base64}`;
  return DataURISchema.parse({
    mediaType,
    category: getCategory(mediaType),
    base64,
    raw,
  });
}

/**
 * Encodes a raw Buffer/Uint8Array as a Data URI with
 * the given MIME type.
 *
 * @param data - The raw binary data
 * @param mimeType - A valid MIME type string
 * @returns A DataURI object
 * @throws Error if the MIME type is unsupported
 * @throws Error if the data is empty
 */
export function encodeBuffer(data: Buffer | Uint8Array, mimeType: string): DataURI {
  const parseResult = MediaTypeSchema.safeParse(mimeType);
  if (!parseResult.success) {
    throw new Error('unsupported MIME type');
  }

  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (buffer.length === 0) {
    throw new Error('buffer is empty');
  }

  const mediaType = parseResult.data;
  const base64 = buffer.toString('base64');
  const raw = `data:${mediaType};base64,${base64}`;
  return DataURISchema.parse({
    mediaType,
    category: getCategory(mediaType),
    base64,
    raw,
  });
}
