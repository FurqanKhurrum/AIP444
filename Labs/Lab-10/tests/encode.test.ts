import { describe, it, expect } from 'vitest';
import { encodeFile, encodeBuffer } from '../src/encode';
import { EXTENSION_TO_MIME } from '../src/types';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

const pngPath = path.join(fixturesDir, 'test.png');
const jpgPath = path.join(fixturesDir, 'test.jpg');
const svgPath = path.join(fixturesDir, 'test.svg');
const mp3Path = path.join(fixturesDir, 'test.mp3');
const emptyPath = path.join(fixturesDir, 'test.md');

function expectDataURIShape(raw: string, mediaType: string, category: string) {
  expect(raw.startsWith(`data:${mediaType};base64,`)).toBe(true);
  const [, base64] = raw.split('base64,');
  expect(base64.length).toBeGreaterThan(0);
  expect(category.length).toBeGreaterThan(0);
}

describe('encodeFile', () => {
  it('encodes PNG with correct MIME type', async () => {
    const result = await encodeFile(pngPath);
    expect(result.mediaType).toBe('image/png');
    expect(result.category).toBe('image');
    expectDataURIShape(result.raw, 'image/png', 'image');
  });

  it('encodes JPG with correct MIME type', async () => {
    const result = await encodeFile(jpgPath);
    expect(result.mediaType).toBe('image/jpeg');
    expect(result.category).toBe('image');
    expectDataURIShape(result.raw, 'image/jpeg', 'image');
  });

  it('encodes SVG with correct MIME type', async () => {
    const result = await encodeFile(svgPath);
    expect(result.mediaType).toBe('image/svg+xml');
    expect(result.category).toBe('image');
    expectDataURIShape(result.raw, 'image/svg+xml', 'image');
  });

  it('encodes MP3 with correct MIME type', async () => {
    const result = await encodeFile(mp3Path);
    expect(result.mediaType).toBe('audio/mpeg');
    expect(result.category).toBe('audio');
    expectDataURIShape(result.raw, 'audio/mpeg', 'audio');
  });

  it('throws for missing file', async () => {
    await expect(encodeFile(path.join(fixturesDir, 'missing.png'))).rejects.toThrow('file not found');
  });

  it('throws for unsupported file extension', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'data-uri-'));
    const filePath = path.join(tmpDir, 'file.bmp');
    await fs.writeFile(filePath, Buffer.from([1, 2, 3]));
    await expect(encodeFile(filePath)).rejects.toThrow('unsupported file extension');
  });

  it('throws for empty file', async () => {
    await expect(encodeFile(emptyPath)).rejects.toThrow('file is empty');
  });
});

describe('encodeBuffer', () => {
  it('encodes a buffer with provided MIME type', async () => {
    const data = await fs.readFile(pngPath);
    const result = encodeBuffer(data, EXTENSION_TO_MIME.png);
    expect(result.mediaType).toBe('image/png');
    expect(result.category).toBe('image');
    expectDataURIShape(result.raw, 'image/png', 'image');
  });

  it('throws for unsupported MIME type', () => {
    const data = Buffer.from([1, 2, 3]);
    expect(() => encodeBuffer(data, 'image/bmp')).toThrow('unsupported MIME type');
  });

  it('throws for empty buffer', () => {
    const data = Buffer.alloc(0);
    expect(() => encodeBuffer(data, 'image/png')).toThrow('buffer is empty');
  });
});
