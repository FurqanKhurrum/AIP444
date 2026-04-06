// src/decode.ts
import { DataURI, DataURISchema, MediaTypeSchema, getCategory } from './types';
import { promises as fs } from 'node:fs';

/**
 * Parses a Data URI string into its components.
 *
 * @param uri - A complete Data URI string
 *   (e.g. "data:image/png;base64,iVBOR...")
 * @returns A DataURI object with parsed components
 * @throws Error if the string is not a valid Data URI
 * @throws Error if the MIME type is unsupported
 * @throws Error if the Base64 content is invalid
 */
export function parseDataURI(uri: string): DataURI {
  if (!uri.startsWith('data:')) {
    throw new Error('missing data: prefix');
  }

  const separatorIndex = uri.indexOf(';base64,');
  if (separatorIndex === -1) {
    throw new Error('missing base64 delimiter');
  }

  const mediaType = uri.slice('data:'.length, separatorIndex);
  const mediaTypeResult = MediaTypeSchema.safeParse(mediaType);
  if (!mediaTypeResult.success) {
    throw new Error('unsupported MIME type');
  }

  const base64 = uri.slice(separatorIndex + ';base64,'.length);
  if (base64.length === 0) {
    throw new Error('invalid base64 content');
  }

  try {
    const decoded = Buffer.from(base64, 'base64');
    if (decoded.length === 0) {
      throw new Error('invalid base64 content');
    }
    const reencoded = decoded.toString('base64').replace(/=+$/, '');
    const normalized = base64.replace(/=+$/, '');
    if (reencoded !== normalized) {
      throw new Error('invalid base64 content');
    }
  } catch {
    throw new Error('invalid base64 content');
  }

  return DataURISchema.parse({
    mediaType: mediaTypeResult.data,
    category: getCategory(mediaTypeResult.data),
    base64,
    raw: uri,
  });
}

/**
 * Decodes a Data URI string back into raw binary data.
 *
 * @param uri - A complete Data URI string
 * @returns A Buffer containing the decoded binary data
 * @throws Error if the URI is invalid
 */
export function decodeToBuffer(uri: string): Buffer {
  const parsed = parseDataURI(uri);
  return Buffer.from(parsed.base64, 'base64');
}

/**
 * Decodes a Data URI and writes the result to a file.
 *
 * @param uri - A complete Data URI string
 * @param outputPath - Where to write the decoded file
 * @throws Error if the URI is invalid
 */
export async function decodeToFile(uri: string, outputPath: string): Promise<void> {
  const data = decodeToBuffer(uri);
  await fs.writeFile(outputPath, data);
}
