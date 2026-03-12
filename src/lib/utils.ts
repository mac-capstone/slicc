import { Linking } from 'react-native';
import { twMerge } from 'tailwind-merge';
import { z } from 'zod';
import type { StoreApi, UseBoundStore } from 'zustand';

import {
  type ExpenseIdT,
  type ExpenseWithId,
  type ItemIdT,
  type ItemWithId,
  type Person,
  type PersonWithId,
  type UserIdT,
} from '@/types';

import { type mockData } from './mock-data';

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

export const mapMockPersonToPerson = (
  person: (typeof mockData.expenses)[number]['people'][number]
): Person => {
  return {
    name: person.doc.name,
    color: person.doc.color,
    userRef: person.doc.userRef,
    subtotal: person.doc.subtotal,
  };
};

export const mapMockPersonToPersonWithId = (
  person: (typeof mockData.expenses)[number]['people'][number]
): PersonWithId => {
  return {
    id: person.id,
    name: person.doc.name,
    color: person.doc.color,
    userRef: person.doc.userRef,
    subtotal: person.doc.subtotal,
  };
};

export const mapMockExpenseToExpenseWithId = (
  expense: (typeof mockData.expenses)[number]
): ExpenseWithId => {
  return {
    id: expense.id as ExpenseIdT,
    name: expense.doc.name,
    totalAmount: expense.doc.totalAmount,
    date: expense.doc.date,
    remainingAmount: expense.doc.remainingAmount,
    createdBy: expense.doc.createdBy as UserIdT,
    participantCount: expense.doc.participantCount,
  };
};

export const mapMockItemToItemWithId = (
  item: (typeof mockData.expenses)[number]['items'][number]
): ItemWithId => {
  return {
    id: item.id as ItemIdT,
    name: item.doc.name,
    amount: item.doc.amount,
    split: {
      mode: item.doc.split.mode as string,
      shares: item.doc.split.shares as Record<string, number>,
    },
    assignedPersonIds: item.doc.assignedPersonIds as string[],
  };
};

export const calculatePersonShare = (
  item: ItemWithId,
  personId: string
): number => {
  const totalShares = Object.values(item.split.shares).reduce(
    (acc: number, share: number) => acc + share,
    0
  );
  return (item.split.shares[personId] * item.amount) / totalShares;
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
