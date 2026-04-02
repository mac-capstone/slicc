import { Linking } from 'react-native';

import { type BankPreference } from '@/types';

export type BankOption = {
  label: string;
  value: BankPreference;
};

export const BANK_OPTIONS: BankOption[] = [
  { label: 'All banks (Interac)', value: 'all-banks' },
  { label: 'Interac e-Transfer', value: 'interac' },
  { label: 'RBC', value: 'rbc' },
  { label: 'TD', value: 'td' },
  { label: 'Scotiabank', value: 'scotia' },
  { label: 'CIBC', value: 'cibc' },
  { label: 'BMO', value: 'bmo' },
  { label: 'National Bank', value: 'national-bank' },
  { label: 'Desjardins', value: 'desjardins' },
  { label: 'Tangerine', value: 'tangerine' },
  { label: 'Simplii Financial', value: 'simplii' },
  { label: 'Laurentian Bank', value: 'laurentian' },
  { label: 'Meridian Credit Union', value: 'meridian' },
  { label: 'Coast Capital', value: 'coast-capital' },
  { label: 'Vancity', value: 'vancity' },
  { label: 'ATB Financial', value: 'atb' },
  { label: 'EQ Bank', value: 'eq-bank' },
  { label: 'Wealthsimple', value: 'wealthsimple' },
  { label: 'KOHO', value: 'koho' },
  { label: 'Neo Financial', value: 'neo' },
  { label: 'Other', value: 'other' },
];

export function isBankPreference(value: string): value is BankPreference {
  if (value === 'none') return true;
  return BANK_OPTIONS.some((option) => option.value === value);
}

type BankLaunchConfig = {
  appDeepLink?: string;
  webUrl: string;
};

const BANK_LAUNCH_CONFIG: Record<BankPreference, BankLaunchConfig> = {
  none: {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
  'all-banks': {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
  interac: {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
  rbc: {
    appDeepLink: 'rbcmobile://',
    webUrl: 'https://www.rbcroyalbank.com/',
  },
  td: {
    appDeepLink: 'tdct://',
    webUrl: 'https://www.td.com/ca/en/personal-banking',
  },
  scotia: {
    appDeepLink: 'scotiabank://',
    webUrl: 'https://www.scotiabank.com/ca/en/personal/bank-accounts.html',
  },
  cibc: {
    appDeepLink: 'cibcmobilebanking://',
    webUrl: 'https://www.cibc.com/en/personal-banking.html',
  },
  bmo: {
    appDeepLink: 'bmomobile://',
    webUrl: 'https://www.bmo.com/en-ca/main/personal/',
  },
  'national-bank': {
    appDeepLink: 'nbcmobile://',
    webUrl: 'https://www.nbc.ca/en/',
  },
  desjardins: {
    appDeepLink: 'desjardins://',
    webUrl: 'https://www.desjardins.com/ca/personal/index.jsp',
  },
  tangerine: {
    appDeepLink: 'tangerine://',
    webUrl: 'https://www.tangerine.ca/',
  },
  simplii: {
    appDeepLink: 'simplii://',
    webUrl: 'https://www.simplii.com/en/',
  },
  laurentian: {
    webUrl: 'https://www.banquelaurentienne.ca/en/',
  },
  meridian: {
    webUrl: 'https://www.meridiancu.ca/',
  },
  'coast-capital': {
    webUrl: 'https://www.coastcapitalsavings.com/',
  },
  vancity: {
    webUrl: 'https://www.vancity.com/',
  },
  atb: {
    webUrl: 'https://www.atb.com/',
  },
  'eq-bank': {
    webUrl: 'https://www.eqbank.ca/',
  },
  wealthsimple: {
    appDeepLink: 'wealthsimple://',
    webUrl: 'https://www.wealthsimple.com/en-ca',
  },
  koho: {
    appDeepLink: 'koho://',
    webUrl: 'https://www.koho.ca/',
  },
  neo: {
    webUrl: 'https://www.neofinancial.com/',
  },
  other: {
    webUrl: 'https://www.interac.ca/en/consumers/products/interac-e-transfer/',
  },
};

export async function openBankFlow(
  bankPreference?: BankPreference
): Promise<void> {
  const preference: BankPreference = bankPreference ?? 'none';
  const config = BANK_LAUNCH_CONFIG[preference];

  if (config.appDeepLink) {
    try {
      // Attempt to open the native app directly. On Android this throws if no
      // app handles the scheme; on iOS it throws if the scheme is not in
      // LSApplicationQueriesSchemes or the app is not installed.
      await Linking.openURL(config.appDeepLink);
      return;
    } catch {
      // App not installed — fall through to web fallback
    }
  }

  await Linking.openURL(config.webUrl);
}

export function getBankLabel(bankPreference?: BankPreference): string {
  if (!bankPreference || bankPreference === 'none') return 'Bank app';
  const option = BANK_OPTIONS.find((item) => item.value === bankPreference);
  return option?.label ?? 'Bank app';
}
