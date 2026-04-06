import { Env } from '@env';

type ExtractReceiptResponse = {
  text?: string;
  error?: string;
};

/**
 * Sends receipt image to the backend; Gemini runs server-side only.
 */
export async function extractReceiptInfo(
  base64Image: string
): Promise<string | undefined> {
  const url = Env.EXPO_PUBLIC_RECEIPT_EXTRACTION_URL?.trim();
  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_RECEIPT_EXTRACTION_URL is required for receipt extraction. Point it at your POST /api/extract-receipt server and keep GEMINI_API_KEY on the server only.'
    );
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image }),
  });

  let data: ExtractReceiptResponse;
  try {
    data = (await response.json()) as ExtractReceiptResponse;
  } catch {
    throw new Error(
      `Receipt extraction failed (${response.status}): expected JSON body`
    );
  }
  if (!response.ok) {
    throw new Error(
      data.error ?? `Receipt extraction failed (${response.status})`
    );
  }

  return data.text;
}
