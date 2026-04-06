import { Env } from '@env';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { Platform } from 'react-native';

import { fetchIsOnline } from '@/lib/network-status';
import { parseReceiptLinesFromOcrText } from '@/lib/receipt/parse-receipt-ocr';
import { parseReceiptInfo } from '@/lib/utils';

import { extractReceiptInfo } from './extract-receipt-info';

export type ReceiptLineItem = { dish: string; price: number };
export type ReceiptExtractSource = 'gemini' | 'mlkit';

/**
 * Online: Gemini (cloud) when configured; on failure or offline: Google ML Kit on-device OCR.
 */
export async function extractReceiptLineItems(params: {
  base64: string | null | undefined;
  imageUri: string;
}): Promise<{ items: ReceiptLineItem[]; source: ReceiptExtractSource }> {
  const { base64, imageUri } = params;
  const online = await fetchIsOnline();
  const geminiKey = Env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (online && geminiKey && base64) {
    try {
      const text = await extractReceiptInfo(base64);
      if (text) {
        const parsed = parseReceiptInfo(text);
        if (parsed?.success) {
          return { items: parsed.data, source: 'gemini' };
        }
      }
    } catch (e) {
      console.warn(
        'Gemini receipt extraction failed, falling back to ML Kit:',
        e
      );
    }
  }

  if (Platform.OS === 'web') {
    throw new Error(
      'On-device receipt scanning is not available on web. Use a phone or tablet.'
    );
  }

  const { text } = await recognizeText(imageUri);
  const items = parseReceiptLinesFromOcrText(text);
  if (items.length === 0) {
    throw new Error(
      'Could not read line items from the receipt. Try again with better lighting.'
    );
  }
  return { items, source: 'mlkit' };
}
