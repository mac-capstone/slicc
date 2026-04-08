import { Linking } from 'react-native';

import {
  BANK_OPTIONS,
  getBankLabel,
  isBankPreference,
  openBankFlow,
} from '@/lib/payment-utils';

describe('payment-utils (business / infra touchpoints)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    (Linking.openURL as jest.Mock).mockReset();
    (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
  });

  it('isBankPreference accepts known bank slugs and none', () => {
    expect(isBankPreference('rbc')).toBe(true);
    expect(isBankPreference('none')).toBe(true);
    expect(isBankPreference('not-a-bank')).toBe(false);
  });

  it('BANK_OPTIONS covers distinct values', () => {
    const values = new Set(BANK_OPTIONS.map((o) => o.value));
    expect(values.size).toBe(BANK_OPTIONS.length);
  });

  it('getBankLabel falls back for unset / none', () => {
    expect(getBankLabel(undefined)).toBe('Bank app');
    expect(getBankLabel('none')).toBe('Bank app');
    expect(getBankLabel('rbc')).toBe('RBC');
  });

  it('openBankFlow uses deep link when it succeeds', async () => {
    await openBankFlow('rbc');
    expect(Linking.openURL).toHaveBeenCalledWith('rbcmobile://');
  });

  it('openBankFlow falls back to web when deep link throws', async () => {
    const openURL = Linking.openURL as jest.Mock;
    openURL.mockReset();
    openURL.mockImplementation((url: string) => {
      if (url === 'rbcmobile://') {
        return Promise.reject(new Error('no app'));
      }
      if (url.startsWith('https://')) {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`unexpected openURL: ${url}`));
    });
    await openBankFlow('rbc');
    expect(openURL).toHaveBeenCalledTimes(2);
    expect(openURL.mock.calls[1][0]).toMatch(/^https:\/\//);
  });
});
