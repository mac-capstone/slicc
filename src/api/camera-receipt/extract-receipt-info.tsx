import { GoogleGenAI } from '@google/genai';

const geminiApiKey = 'AIzaSyB-e1mHwUNsdjnqPp2Z-nel4M-6JRsF4Vg';

export async function extractReceiptInfo(base64Image: string) {
  // Replace with your API key, or load from env
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
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
