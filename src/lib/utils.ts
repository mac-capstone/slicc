import { Linking } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { z } from 'zod';
import type { StoreApi, UseBoundStore } from 'zustand';

import { type ItemWithId } from '@/types';

export function openLinkInBrowser(url: string) {
  Linking.canOpenURL(url).then((canOpen) => canOpen && Linking.openURL(url));
}

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  let store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (let k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export const cn = (...classes: string[]) => {
  return twMerge(classes.filter(Boolean).join(' '));
};

export const calculatePersonShare = (
  item: ItemWithId,
  personId: string
): number => {
  if (!item.split.shares[personId]) return 0;
  const totalShares = Object.values(item.split.shares).reduce(
    (acc: number, share: number) => acc + share,
    0
  );
  return (
    (item.split.shares[personId] * item.amount * (1 + item.taxRate / 100)) /
    totalShares
  );
};

export const parseReceiptInfo = (
  result: string
): z.SafeParseReturnType<
  { dish: string; price: number }[],
  { dish: string; price: number }[]
> | null => {
  // remove the ```json and ``` from the result
  const cleanedResult = result
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/g, '')
    .replace(/\s*```$/g, '')
    .trim();
  // Parse JSON string first, then validate with zod
  let parsedJson;
  try {
    parsedJson = JSON.parse(cleanedResult);
  } catch (parseError) {
    console.log('JSON parse error:', parseError);
    return null;
  }
  const parsedResult = z
    .array(
      z.object({
        dish: z.string(),
        price: z.string().transform((val) => Number(val.replace('$', ''))),
      })
    )
    .safeParse(parsedJson);
  return parsedResult;
};

export const encodeIdBase64Url = (value: string): string => {
  const utf8FallbackEncode = (input: string): Uint8Array => {
    const bytes: number[] = [];

    for (const char of input) {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) continue;

      if (codePoint <= 0x7f) {
        bytes.push(codePoint);
      } else if (codePoint <= 0x7ff) {
        bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint <= 0xffff) {
        bytes.push(
          0xe0 | (codePoint >> 12),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      } else {
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }

    return Uint8Array.from(bytes);
  };

  const bytes =
    typeof globalThis.TextEncoder === 'function'
      ? new globalThis.TextEncoder().encode(value)
      : utf8FallbackEncode(value);
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let output = '';
  let i = 0;

  while (i + 2 < bytes.length) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    output += alphabet[(n >> 18) & 63];
    output += alphabet[(n >> 12) & 63];
    output += alphabet[(n >> 6) & 63];
    output += alphabet[n & 63];
    i += 3;
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const n = bytes[i] << 16;
    output += alphabet[(n >> 18) & 63];
    output += alphabet[(n >> 12) & 63];
  } else if (remaining === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    output += alphabet[(n >> 18) & 63];
    output += alphabet[(n >> 12) & 63];
    output += alphabet[(n >> 6) & 63];
  }

  return output;
};
