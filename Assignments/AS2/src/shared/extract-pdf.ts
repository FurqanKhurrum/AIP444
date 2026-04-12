// src/shared/extract-pdf.ts
// Two-stage PDF extraction:
// 1. Try pdf-parse (fast, free, works for text-layer PDFs)
// 2. If text is too short (image-based PDF), fall back to Gemini vision API
//    which accepts raw PDF bytes as base64 — no native deps needed.

import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { openai, MODELS } from './llm.js';
import { logger } from './logger.js';

const MIN_TEXT_LENGTH = 200; // below this = image PDF, use vision fallback

// ─── Stage 1: text-layer extraction ──────────────────────────────────────────

async function extractTextLayer(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text.trim();
}

// ─── Stage 2: vision fallback (Gemini reads PDF directly) ────────────────────

async function extractViaVision(buffer: Buffer, filename: string): Promise<string> {
  logger.info(`Image-based PDF detected — using vision extraction for ${filename}`);
  const base64 = buffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: MODELS.extract,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'This is a job posting PDF. Extract ALL text content from every page exactly as it appears. Include job title, company, location, salary, requirements, responsibilities, and any other visible text. Output the raw text only.',
          },
          {
            // Gemini accepts application/pdf inline
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${base64}` },
          } as any,
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content ?? '';
  logger.debug(`Vision extraction returned ${text.length} chars`);
  return text;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractPdf(filePath: string): Promise<string> {
  const absPath = path.resolve(filePath);
  logger.debug(`Extracting PDF: ${path.basename(filePath)}`);

  // Also support plain .txt files — just read them directly
  if (filePath.endsWith('.txt')) {
    const text = await fs.readFile(absPath, 'utf-8');
    logger.debug(`Read .txt file: ${text.length} chars`);
    return text;
  }

  const buffer = await fs.readFile(absPath);

  // Stage 1
  const textLayer = await extractTextLayer(buffer);
  logger.debug(`Text layer: ${textLayer.length} chars`);

  if (textLayer.length >= MIN_TEXT_LENGTH) {
    return textLayer;
  }

  // Stage 2: image PDF
  return extractViaVision(buffer, path.basename(filePath));
}