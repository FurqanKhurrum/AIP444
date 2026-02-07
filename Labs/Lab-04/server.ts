/*
    Server.ts - code explanation
    this is a Hono API server that provides an endpoint to generate flashcards 
    based on user-provided notes. it has 2 main components:
     1. POST method (/api/generate), it accepts JSON body with the notes 
     and count, of how many flashcards we want made. 
     Zod schema is used to validate the input and then calls the generateFlashcards
     errors are handled with a 500 status response
     2. Middleware included is logger and timing for request monitoring,
     and CORS for API routes

*/
import { serve } from '@hono/node-server';
// Hono is a fast lightweight alternative to express. it still uses patterns like app.use/post/get
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { timing } from 'hono/timing';
import { logger } from 'hono/logger';
import { zValidator } from '@hono/zod-validator';
import * as z from 'zod';

// NOTE: you will implement this code
import { generateFlashcards } from '../Lab-04/flashcard-generator.js';

const app = new Hono();

// logs HTTP requests like method, path & response time(ie: timing())
app.use(logger(), timing());
app.use('/api/*', cors());

// this is schema(defines a set of rules data must follow) is using Zod, a .ts first validator
const generateSchema = z.object({ // expects a js obj
  notes: z.string().min(1, "Field 'notes' is required."), // the notes, must have atleast 1 char
  count: z.number().optional().default(3), // optional field, if counts not provided, default to 3
});

/*  Instead of using separate req & res, Hono uses a context obj (c) that contains the req and response
    zValidator intercepts the req, reads it, parses it as json, validates it against the schema we defined
    if valid: attaches validated data, and we use it to call generateFlashcards.
    if not valid: returns error response.
*/
app.post('/api/generate', zValidator('json', generateSchema), async (c) => {
  try {
    const { notes, count } = await c.req.valid('json');
    const result = await generateFlashcards(notes, count);

    return c.json(result);
  } catch (error: any) {
    console.error('Server Error:', error);
    return c.json(
      {
        error: 'Failed to generate flashcards.',
        details: error.message,
      },
      500
    );
  }
});

const port = 3000;
console.log(`🚀 Server running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});