import { extractPdf } from './src/shared/extract-pdf.js';
import { openai } from './src/shared/llm.js';

const text = await extractPdf(process.argv[2]);
console.log('=== EXTRACTED TEXT (first 500 chars) ===');
console.log(text.slice(0, 500));
console.log('\n=== TOTAL LENGTH:', text.length);

// Raw LLM call with no schema pressure
const res = await openai.chat.completions.create({
  model: 'google/gemini-2.0-flash-001',
  messages: [
    { role: 'user', content: `What is the job title and company name in this job posting?\n\n${text.slice(0, 2000)}` }
  ]
});
console.log('\n=== LLM RESPONSE ===');
console.log(res.choices[0].message.content);