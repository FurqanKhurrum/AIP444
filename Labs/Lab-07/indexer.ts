import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { ChromaClient, type EmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { chunkMarkdown } from './chunker.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('ERROR: OPENROUTER_API_KEY not found in', envPath);
  process.exit(1);
}

class OpenRouterEmbeddingFunction implements EmbeddingFunction {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'openai/text-embedding-3-small') {
    this.model = model;
    this.openai = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }

  async generate(texts: string[]): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts,
    });
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
}

const client = new ChromaClient({ host: 'localhost', port: 8000 });
const embeddingFunction = new OpenRouterEmbeddingFunction(apiKey);

async function main() {
  const collection = await client.getOrCreateCollection({
    name: 'node-docs',
    embeddingFunction,
  });

  const docsDir = path.resolve(__dirname, 'docs');
  const files = await fs.readdir(docsDir);

  for (const file of files) {
    if (!file.endsWith('.md')) continue;

    console.log(`Processing ${file}...`);
    const text = await fs.readFile(path.join(docsDir, file), 'utf-8');

    const chunks = chunkMarkdown(text, file);
    if (chunks.length === 0) continue;

    const ids = chunks.map((c) => c.id);
    const documents = chunks.map((c) => c.content);
    const metadatas = chunks.map((c) => c.metadata);

    await collection.upsert({ ids, documents, metadatas });
  }

  console.log('Indexing complete!');
}

main();