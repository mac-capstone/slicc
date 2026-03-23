import React from 'react';
import { Text } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

import { render, screen } from '@/lib/test-utils';

import { storage } from '../storage';
import {
  getDefaultTaxRate,
  getDefaultTipPercent,
  useUserSettings,
} from './use-user-settings';

jest.mock('../storage', () => ({
  storage: {
    getString: jest.fn(),
  },
}));

jest.mock('react-native-mmkv');

describe('useUserSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads legacy default tax from storage synchronously', () => {
    (storage.getString as jest.Mock).mockImplementation((key: string) => {
      if (key === 'DEFAULT_TAX_RATE') return '13';
      if (key === 'DEFAULT_TIP_PERCENT') return '18';
      return undefined;
    });

    expect(getDefaultTaxRate()).toBe(13);
    expect(getDefaultTipPercent()).toBe(18);
  });

  it('exposes all local settings through one hook contract', () => {
    const setValue = jest.fn();

    (useMMKVString as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'DEFAULT_TAX_RATE':
          return ['8.5', setValue];
        case 'DEFAULT_TIP_PERCENT':
          return ['15', setValue];
        case 'DIETARY_PREFERENCE_IDS':
          return ['["vegetarian","nut_free"]', setValue];
        case 'PAYOUT_EMAIL':
          return ['test@example.com', setValue];
        case 'BANK_PAYOUT_INSTRUCTIONS':
          return ['Interac e-Transfer', setValue];
        default:
          return [undefined, setValue];
      }
    });

    const Probe = () => {
      const settings = useUserSettings();

      return (
        <Text>
          {`${settings.defaultTaxRate}|${settings.defaultTipPercent}|${settings.dietaryPreferenceIds.join(',')}|${settings.payoutEmail}|${settings.bankPayoutInstructions}`}
        </Text>
      );
    };

    render(<Probe />);

    expect(
      screen.getByText(
        '8.5|15|vegetarian,nut_free|test@example.com|Interac e-Transfer'
      )
    ).toBeOnTheScreen();
  });
});
