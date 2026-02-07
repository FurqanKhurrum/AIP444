import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Path to test notes file
const notesPath = 'notes.md';

async function main() {
  try {
    // 1. Read the notes file (make sure this file exists!)
    console.log(`📖 Reading notes from: ${notesPath}`);
    const notesContent = await readFile(notesPath, 'utf-8');

    // 2. Prepare the payload
    const payload = {
      notes: notesContent,
      count: 3, // Request 3 flashcards
    };

    console.log('⚡ Sending request to server...');
    const startTime = performance.now();

    // 3. Send POST request
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const endTime = performance.now();
    console.log(`⏱️  Request took ${((endTime - startTime) / 1000).toFixed(2)}s`);

    // 4. Handle Response
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 5. Pretty Print the JSON
    console.log('\n✅ Success! Received Structured Data:');
    console.log(JSON.stringify(data, null, 2));

    // 6. Display flashcards in a readable format
    console.log('\n📚 Generated Flashcards:\n');
    data.flashcards.forEach((card, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`FLASHCARD ${index + 1}`);
      console.log('='.repeat(60));
      console.log(`\n🎬 Scenario:\n   ${card.scenario}`);
      console.log(`\n❓ Question:\n   ${card.question}`);
      console.log(`\n✅ Response:\n   ${card.response}`);
      console.log(`\n📖 Reference:\n   "${card.reference}"`);
      console.log(`\n💡 Why It Matters:\n   ${card.why_it_matters}`);
      console.log(`\n❌ Common Mistake:\n   "${card.common_mistake}"`);
    });
    console.log(`\n${'='.repeat(60)}\n`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();