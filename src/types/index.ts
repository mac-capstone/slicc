import { type z } from 'zod';

import {
  type eventSchema,
  type expenseItemSchema,
  type expensePersonSchema,
  type expenseSchema,
  type groupSchema,
  type userSchema,
} from './schema';

// ── Branded ID types ───────────────────────────────────────────────────────

export type UserIdT = string & { readonly __brand: unique symbol };
export type ExpenseIdT = string & { readonly __brand: unique symbol };
export type ItemIdT = string & { readonly __brand: unique symbol };
export type PersonIdT = string & { readonly __brand: unique symbol };
export type EventIdT = string & { readonly __brand: unique symbol };
export type GroupIdT = string & { readonly __brand: unique symbol };
export type NotificationIdT = string & { readonly __brand: unique symbol };

// ── Types derived from Zod schemas ─────────────────────────────────────────

export type User = z.infer<typeof userSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type ExpensePerson = z.infer<typeof expensePersonSchema>;
export type ExpenseItem = z.infer<typeof expenseItemSchema>;

// ── Derived UI types ────────────────────────────────────────────────────────

export type EventPerson = {
  name: string;
  color: string;
  userRef: string;
  subtotal: number;
  paid: number;
};

// ── Expense person with optional UI fields (name/color/userRef are not in Firestore) ──

export type Person = ExpensePerson & {
  name?: string;
  color?: string;
  userRef?: string | null;
};

export type Item = ExpenseItem;

// ── WithId variants ────────────────────────────────────────────────────────

export type UserWithId = User & { id: UserIdT };
export type GroupWithId = Group & { id: GroupIdT };
export type EventWithId = Event & { id: EventIdT };

export type ExpenseWithId = Expense & { id: ExpenseIdT };
export type ExpensePersonWithId = ExpensePerson & { id: UserIdT };
export type ExpenseItemWithId = ExpenseItem & { id: ItemIdT };
export type PersonWithId = Person & { id: string };
export type ItemWithId = Item & { id: ItemIdT };
