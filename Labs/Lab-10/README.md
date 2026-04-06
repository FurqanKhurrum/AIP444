# Media Data URI Library

This library encodes common image, audio, and video files as Base64 Data URIs and decodes Data URIs back into binary data. It provides strict MIME type validation, structured parsing, and small helpers for working with Data URIs in multimodal or media-processing workflows.

## Supported Media Types

| Category | MIME Type |
| --- | --- |
| Image | image/png |
| Image | image/jpeg |
| Image | image/gif |
| Image | image/webp |
| Image | image/svg+xml |
| Audio | audio/mpeg |
| Audio | audio/wav |
| Audio | audio/ogg |
| Video | video/mp4 |
| Video | video/webm |

## Installation

```bash
npm install Lab-10
```

## Usage

### Encode

```ts
import { encodeFile, encodeBuffer } from 'Lab-10';
import { promises as fs } from 'node:fs';

const dataUriFromFile = await encodeFile('tests/fixtures/test.png');
console.log(dataUriFromFile.raw);

const bytes = await fs.readFile('tests/fixtures/test.jpg');
const dataUriFromBuffer = encodeBuffer(bytes, 'image/jpeg');
console.log(dataUriFromBuffer.mediaType);
```

### Decode

```ts
import { parseDataURI, decodeToBuffer, decodeToFile } from 'Lab-10';

const parsed = parseDataURI('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
console.log(parsed.category);

const bytes = decodeToBuffer(parsed.raw);
console.log(bytes.length);

await decodeToFile(parsed.raw, 'out.png');
```

## Running Tests

```bash
pnpm test
pnpm run test:watch
pnpm run typecheck
```

## API At A Glance

- `encodeFile(filePath: string): Promise<DataURI>`
- `encodeBuffer(data: Buffer | Uint8Array, mimeType: string): DataURI`
- `parseDataURI(uri: string): DataURI`
- `decodeToBuffer(uri: string): Buffer`
- `decodeToFile(uri: string, outputPath: string): Promise<void>`

## Notes

- Only the supported MIME types listed above are accepted.
- Data URIs must use the `data:<mime>;base64,<payload>` format.
