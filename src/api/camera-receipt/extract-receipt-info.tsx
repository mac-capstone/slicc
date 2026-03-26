import { Env } from '@env';
import { GoogleGenAI } from '@google/genai';

export async function extractReceiptInfo(base64Image: string) {
  const apiKey = Env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'EXPO_PUBLIC_GEMINI_API_KEY is required for receipt extraction. Add it to your .env file.'
    );
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
      text: `You are an OCR model specialized in restaurant receipts. Extract only the items ordered (dish names) and their prices. Return the results as a JSON array of objects, each with keys "dish" and "price", like this: [{"dish": "Chicken Curry", "price": "$12.99"}, {"dish": "Spring Rolls", "price": "$5.50"}]`,
    },
  ];
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: contents,
  });
  return response.text;
}
