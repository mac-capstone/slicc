import { getGoogleGenAi } from './get-google-gen-ai';

const RECEIPT_PROMPT = `You are an OCR model specialized in restaurant receipts. Extract only the items ordered (dish names) and their prices. Return the results as a JSON array of objects, each with keys "dish" and "price", like this: [{"dish": "Chicken Curry", "price": "$12.99"}, {"dish": "Spring Rolls", "price": "$5.50"}]`;

export async function extractReceiptTextFromBase64(
  base64Image: string
): Promise<string | undefined> {
  const ai = getGoogleGenAi();
  const contents = [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image,
      },
    },
    {
      text: RECEIPT_PROMPT,
    },
  ];
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents,
  });
  return response.text;
}
