import * as z from 'zod';

/**
 * Schema for a single SQR flashcard
 * Defines all required fields for the flashcard format
 */
export const flashcardSchema = z.object({
  scenario: z.string().describe('A realistic situation where this concept applies'),
  question: z.string().describe('A specific question about the scenario'),
  response: z.string().describe('The correct answer to the question'),
  reference: z.string().describe('A direct quote from the source notes'),
  why_it_matters: z.string().describe('An explanation of why this concept is significant'),
  common_mistake: z.string().describe('A quote of what a confused student might say'),
});

/**
 * Schema for the API response containing multiple flashcards
 */
export const flashcardsResponseSchema = z.object({
  flashcards: z.array(flashcardSchema).describe('Array of generated flashcards'),
});

/**
 * TypeScript types inferred from the schemas
 * These can be used throughout your application for type safety
 */
export type Flashcard = z.infer<typeof flashcardSchema>;
export type FlashcardsResponse = z.infer<typeof flashcardsResponseSchema>;