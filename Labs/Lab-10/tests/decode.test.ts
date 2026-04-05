import { describe, it, expect } from 'vitest';
import { parseDataURI, decodeToBuffer, decodeToFile } from '../src/decode';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

const pngPath = path.join(fixturesDir, 'test.png');

function buildDataUri(mimeType: string, data: Buffer) {
  const base64 = data.toString('base64');
  return `data:${mimeType};base64,${base64}`;
}

describe('parseDataURI', () => {
  it('parses a valid Data URI into components', async () => {
    const data = await fs.readFile(pngPath);
    const uri = buildDataUri('image/png', data);
    const result = parseDataURI(uri);

    expect(result.mediaType).toBe('image/png');
    expect(result.category).toBe('image');
    expect(result.base64).toBe(data.toString('base64'));
    expect(result.raw).toBe(uri);
  });

  it('throws for missing data: prefix', () => {
    const uri = 'image/png;base64,abcd';
    expect(() => parseDataURI(uri)).toThrow('missing data: prefix');
  });

  it('throws for missing base64 delimiter', () => {
    const uri = 'data:image/png,abcd';
    expect(() => parseDataURI(uri)).toThrow('missing base64 delimiter');
  });

  it('throws for unsupported MIME type', () => {
    const uri = 'data:image/bmp;base64,abcd';
    expect(() => parseDataURI(uri)).toThrow('unsupported MIME type');
  });

  it('throws for invalid base64 content', () => {
    const uri = 'data:image/png;base64,%%%';
    expect(() => parseDataURI(uri)).toThrow('invalid base64 content');
  });
});

describe('decodeToBuffer', () => {
  it('decodes a Data URI into original bytes', async () => {
    const data = await fs.readFile(pngPath);
    const uri = buildDataUri('image/png', data);
    const decoded = decodeToBuffer(uri);
    expect(Buffer.compare(decoded, data)).toBe(0);
  });
});

describe('decodeToFile', () => {
  it('writes decoded bytes to file', async () => {
    const data = await fs.readFile(pngPath);
    const uri = buildDataUri('image/png', data);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'data-uri-'));
    const outPath = path.join(tmpDir, 'out.png');

    await decodeToFile(uri, outPath);
    const written = await fs.readFile(outPath);
    expect(Buffer.compare(written, data)).toBe(0);
  });
});
