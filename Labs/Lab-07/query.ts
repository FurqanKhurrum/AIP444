import path from 'path';
import { fileURLToPath } from 'url';
import { ChromaClient, type EmbeddingFunction } from 'chromadb';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

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
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('Usage: npx tsx query.ts <your question>');
    process.exit(1);
  }

  const collection = await client.getCollection({
    name: 'node-docs',
    embeddingFunction,
  });

  const results = await collection.query({
    queryTexts: [query],
    nResults: 5,
  });

  console.log(`\nQuery: "${query}"\n`);
  console.log('Top 5 results:\n');

  results.documents[0].forEach((doc, i) => {
    const metadata = results.metadatas[0][i] as Record<string, string>;
    const distance = results.distances?.[0][i] ?? 0;
    const similarity = (1 - distance).toFixed(4);

    console.log(`--- Result ${i + 1} (similarity: ${similarity}) ---`);
    console.log(`Source:     ${metadata.source}`);
    console.log(`Breadcrumb: ${metadata.breadcrumb}`);
    console.log(`Preview:    ${doc?.slice(0, 150)}...`);
    console.log();
  });
}

main();