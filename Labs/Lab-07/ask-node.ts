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

const openai = new OpenAI({
  apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
});

const client = new ChromaClient({ host: 'localhost', port: 8000 });
const embeddingFunction = new OpenRouterEmbeddingFunction(apiKey);

function buildSystemPrompt(chunks: { doc: string; source: string; breadcrumb: string }[]): string {
  const contextXml = chunks
    .map(
      (c) => `  <doc source="${c.source}" breadcrumb="${c.breadcrumb}">
${c.doc}
  </doc>`
    )
    .join('\n');

  return `You are ask-node, an expert Node.js assistant that answers questions about the Node.js API.

Here is some context from the official Node.js documentation:

<context>
${contextXml}
</context>

Instructions:
1. Answer the user's question based ONLY on the provided context above.
2. If the answer is not in the context, say "I don't have enough information to answer that based on the Node.js documentation."
3. Cite the source file(s) (e.g., fs.md) where you found the information.
4. Be concise and precise.`;
}

async function main() {
  const question = process.argv.slice(2).join(' ');
  if (!question) {
    console.error('Usage: npx tsx ask-node.ts <your question>');
    process.exit(1);
  }

  // Step 1: Retrieve relevant chunks
  const collection = await client.getCollection({
    name: 'node-docs',
    embeddingFunction,
  });

  const results = await collection.query({
    queryTexts: [question],
    nResults: 5,
  });

  // Step 2: Build context from retrieved chunks
  const chunks = results.documents[0].map((doc, i) => {
    const metadata = results.metadatas[0][i] as Record<string, string>;
    return {
      doc: doc ?? '',
      source: metadata.source,
      breadcrumb: metadata.breadcrumb,
    };
  });

  // Print sources to stderr (debug/transparency)
  console.error('\n📚 Retrieved sources:');
  chunks.forEach((c, i) => {
    console.error(`  ${i + 1}. ${c.source} — ${c.breadcrumb}`);
  });
  console.error();

  // Step 3: Build prompt and call LLM
  const systemPrompt = buildSystemPrompt(chunks);

  const response = await openai.chat.completions.create({
    model: 'google/gemini-2.0-flash-001',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
  });

  const answer = response.choices[0].message.content;

  // Step 4: Print answer to stdout
  console.log('\n🤖 ask-node:\n');
  console.log(answer);
}

main();