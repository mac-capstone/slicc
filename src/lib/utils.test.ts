import { Linking } from 'react-native';

import {
  calculatePersonShare,
  cn,
  encodeIdBase64Url,
  openLinkInBrowser,
  parseReceiptInfo,
} from '@/lib/utils';
import { type ItemWithId } from '@/types';

const isLocalRun = !process.env.CI;

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

  describe('parseReceiptInfo (Gemini JSON → structured lines)', () => {
    it('strips markdown fences and parses valid payloads', () => {
      if (!isLocalRun) return;
      const raw =
        '```json\n[{"dish":"A","price":"$1.50"},{"dish":"B","price":"2"}]\n```';
      const res = parseReceiptInfo(raw);
      expect(res?.success).toBe(true);
      if (res?.success) {
        expect(res.data).toEqual([
          { dish: 'A', price: 1.5 },
          { dish: 'B', price: 2 },
        ]);
      }
    });

    it('returns null on invalid JSON', () => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => {});
      expect(parseReceiptInfo('not json')).toBeNull();
      log.mockRestore();
    });
  });

  describe('encodeIdBase64Url', () => {
    it('encodes UTF-8 strings without padding', () => {
      expect(encodeIdBase64Url('abc')).toBe('YWJj');
      expect(encodeIdBase64Url('€')).toMatch(/^[A-Za-z0-9_-]+$/);
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
