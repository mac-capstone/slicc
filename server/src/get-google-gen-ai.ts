import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

/**
 * Server-only Gemini client. Uses `GEMINI_API_KEY` (never ship this to the mobile app).
 */
export function getGoogleGenAi(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('GEMINI_API_KEY is required for receipt extraction');
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
