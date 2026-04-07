import { Env } from '@env';
import { GoogleGenAI } from '@google/genai';

export async function extractReceiptInfo(base64Image: string) {
  const apiKey = Env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }
  const ai = new GoogleGenAI({ apiKey });
  const contents = [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    },
    {
      text: `You are an OCR model specialized in receipts across all categories (restaurant, grocery, retail, pharmacy, services, etc.).
    Extract purchased line items and receipt-level tax/tip.
Return JSON only (no markdown) in this exact shape:
    {"items":[{"item":"Laundry Detergent","price":12.99}],"tax":2.14,"tip":0}

Rules:
    - Include only purchased line items in items (exclude subtotal/total/tax/tip/payment/discount lines).
    - Each item should represent a product or service line from the receipt.
- "price" must be a number.
- "tax" must be the total tax amount on the receipt (0 if missing).
- "tip" must be the gratuity/tip amount on the receipt (0 if missing).
- If uncertain, make a best effort and keep valid JSON.`,
    },
  ];
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: contents,
  });
  return response.text;
}
