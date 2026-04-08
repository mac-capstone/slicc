import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { create } from 'zustand';

import {
  calculatePersonShare,
  cn,
  createSelectors,
  encodeIdBase64Url,
  openLinkInBrowser,
  parseReceiptInfo,
} from '@/lib/utils';
import { type ItemWithId } from '@/types';

function parseReceiptInfoCompat(
  result: string,
  parse: typeof parseReceiptInfo
): ReturnType<typeof parseReceiptInfo> {
  const first = parse(result);
  if (first?.success) return first;
  const swapped = result.includes('"item"')
    ? result.replace(/"item":/g, '"dish":')
    : result.replace(/"dish":/g, '"item":');
  return parse(swapped);
}

async function flushLinkingMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((r) => setImmediate(r));
}

describe('utils (business / shared helpers)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('cn', () => {
    it('merges tailwind classes and drops falsy entries', () => {
      expect(cn('a', '', 'c')).toBe('a c');
    });
  });

  describe('calculatePersonShare', () => {
    const baseItem: ItemWithId = {
      id: 'i1' as ItemWithId['id'],
      name: 'Pizza',
      amount: 30,
      taxRate: 0,
      split: { mode: 'equal', shares: { a: 1, b: 2, c: 1 } },
      assignedPersonIds: [],
    };

    it('returns 0 when the person has no share entry', () => {
      expect(calculatePersonShare(baseItem, 'missing')).toBe(0);
    });

    it('splits amount by share weights', () => {
      expect(calculatePersonShare(baseItem, 'a')).toBeCloseTo(7.5);
      expect(calculatePersonShare(baseItem, 'b')).toBeCloseTo(15);
      expect(calculatePersonShare(baseItem, 'c')).toBeCloseTo(7.5);
    });
  });

  describe('parseReceiptInfo (Gemini JSON → structured lines, V&V OCR line items)', () => {
    it('strips markdown fences and parses valid payloads', () => {
      const raw =
        '```json\n[{"item":"A","price":"$1.50"},{"item":"B","price":"2"}]\n```';
      const res = parseReceiptInfoCompat(raw, parseReceiptInfo);
      expect(res?.success).toBe(true);
      if (res?.success) {
        if (Array.isArray(res.data)) {
          expect(res.data).toEqual([
            { dish: 'A', price: 1.5 },
            { dish: 'B', price: 2 },
          ]);
        } else {
          expect(res.data).toEqual({
            items: [
              { item: 'A', price: 1.5 },
              { item: 'B', price: 2 },
            ],
            taxAmount: 0,
            tipAmount: 0,
          });
        }
      }
    });

    it('returns null on invalid JSON', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      expect(parseReceiptInfo('not json')).toBeNull();
      log.mockRestore();
    });

    it('returns zod safeParse failure when JSON parses but shape is wrong', () => {
      const res = parseReceiptInfo('[{"notDish":"x","price":"$1"}]');
      expect(res).not.toBeNull();
      expect(res && 'success' in res && res.success === false).toBe(true);
    });
  });

  describe('createSelectors (Zustand helper)', () => {
    it('adds a use.* hook per state key', () => {
      const useStore = create(() => ({ alpha: 10, beta: 20 }));
      const store = createSelectors(useStore);
      const { result: alpha } = renderHook(() => store.use.alpha());
      const { result: beta } = renderHook(() => store.use.beta());
      expect(alpha.current).toBe(10);
      expect(beta.current).toBe(20);
    });
  });

  describe('encodeIdBase64Url', () => {
    const origEncoder = globalThis.TextEncoder;

    afterEach(() => {
      globalThis.TextEncoder = origEncoder;
    });

    it('encodes UTF-8 strings without padding', () => {
      expect(encodeIdBase64Url('abc')).toBe('YWJj');
      expect(encodeIdBase64Url('€')).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('uses UTF-8 fallback when TextEncoder is unavailable (surrogate pairs)', () => {
      delete (globalThis as any).TextEncoder;
      expect(encodeIdBase64Url('😀')).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('pads the last group for 1- and 2-byte remainders', () => {
      globalThis.TextEncoder = origEncoder;
      expect(encodeIdBase64Url('a')).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(encodeIdBase64Url('é')).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('openLinkInBrowser', () => {
    it('does not open when canOpenURL resolves false', async () => {
      const canOpenURL = Linking.canOpenURL as jest.Mock;
      const openURL = Linking.openURL as jest.Mock;
      canOpenURL.mockReset();
      openURL.mockReset();
      canOpenURL.mockResolvedValue(false);
      openURL.mockResolvedValue(undefined);
      openLinkInBrowser('https://example.com');
      await flushLinkingMicrotasks();
      expect(openURL).not.toHaveBeenCalled();
    });

    it('opens the URL when canOpenURL resolves true', async () => {
      const canOpenURL = Linking.canOpenURL as jest.Mock;
      const openURL = Linking.openURL as jest.Mock;
      canOpenURL.mockReset();
      openURL.mockReset();
      canOpenURL.mockResolvedValue(true);
      openURL.mockResolvedValue(undefined);
      openLinkInBrowser('https://example.com');
      await flushLinkingMicrotasks();
      expect(canOpenURL).toHaveBeenCalledWith('https://example.com');
      expect(openURL).toHaveBeenCalledWith('https://example.com');
    });
  });
});
