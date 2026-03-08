import type { Timestamp } from 'firebase/firestore';

export type UserIdT = string & { readonly __brand: unique symbol };
export type ExpenseIdT = string & { readonly __brand: unique symbol };
export type ItemIdT = string & { readonly __brand: unique symbol };
export type PersonIdT = string & { readonly __brand: unique symbol };
export type EventIdT = string & { readonly __brand: unique symbol };
export type GroupIdT = string & { readonly __brand: unique symbol };

export type Expense = {
  name: string;
  totalAmount: number;
  date: string;
  remainingAmount: number;
  createdBy: UserIdT;
  participantCount: number;
};

export type Item = {
  name: string;
  amount: number;
  split: {
    mode: 'equal' | 'custom';
    shares: Record<PersonIdT, number>;
  };
  assignedPersonIds: PersonIdT[];
};

export type Person = {
  name: string;
  color: string;
  userRef: string | null;
  subtotal: number;
};

export type Event = {
  name: string;
  startDate: Timestamp;
  endDate: Timestamp;
  isRecurring: boolean;
  recurringInterval?: number;
  recurringUnit?: 'day' | 'week' | 'month' | 'year';
  recurringEndDate?: Timestamp;
  groupId: GroupIdT;
  location?: string;
  locationUrl?: string;
  details?: string;
  createdBy: UserIdT;
  participants: UserIdT[];
};

export type ExpenseWithId = Expense & { id: ExpenseIdT };
export type ItemWithId = Item & { id: ItemIdT };
export type PersonWithId = Person & { id: PersonIdT };
export type EventWithId = Event & { id: EventIdT };
