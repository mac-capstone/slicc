import { Env } from '@env';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { Platform } from 'react-native';

import { fetchIsOnline } from '@/lib/network-status';
import { parseReceiptLinesFromOcrText } from '@/lib/receipt/parse-receipt-ocr';
import { parseReceiptInfo } from '@/lib/utils';

import { extractReceiptInfo } from './extract-receipt-info';

export type ReceiptLineItem = { item: string; price: number };
export type ReceiptExtractSource = 'gemini' | 'mlkit';
export type ReceiptExtractResult = {
  items: ReceiptLineItem[];
  taxAmount: number;
  tipAmount: number;
  source: ReceiptExtractSource;
};

const NETWORK_CHECK_TIMEOUT_MS = 2500;
const GEMINI_TIMEOUT_MS = 15000;
const MLKIT_TIMEOUT_MS = 15000;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Online: Gemini (cloud) when configured; on failure or offline: Google ML Kit on-device OCR.
 */
export async function extractReceiptLineItems(params: {
  base64: string | null | undefined;
  imageUri: string;
}): Promise<ReceiptExtractResult> {
  const { base64, imageUri } = params;
  let online = false;

  try {
    online = await withTimeout(
      fetchIsOnline(),
      NETWORK_CHECK_TIMEOUT_MS,
      'Network status check timed out'
    );
  } catch (e) {
    console.warn('Network status check failed, assuming offline:', e);
  }

  const geminiKey = Env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (online && geminiKey && base64) {
    try {
      const text = await withTimeout(
        extractReceiptInfo(base64),
        GEMINI_TIMEOUT_MS,
        'Gemini receipt extraction timed out'
      );
      if (text) {
        const parsed = parseReceiptInfo(text);
        if (parsed?.success) {
          return {
            items: parsed.data.items,
            taxAmount: parsed.data.taxAmount,
            tipAmount: parsed.data.tipAmount,
            source: 'gemini',
          };
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

  const { text } = await withTimeout(
    recognizeText(imageUri),
    MLKIT_TIMEOUT_MS,
    'On-device receipt scanning timed out. Please try again.'
  );
  const parsed = parseReceiptLinesFromOcrText(text);
  if (parsed.items.length === 0) {
    throw new Error(
      'Could not read line items from the receipt. Try again with better lighting.'
    );
  }
  return {
    items: parsed.items,
    taxAmount: parsed.taxAmount,
    tipAmount: parsed.tipAmount,
    source: 'mlkit',
  };
}
