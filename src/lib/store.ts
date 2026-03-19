import { create } from 'zustand';

import {
  type ExpenseIdT,
  type ExpenseWithId,
  type ItemIdT,
  type ItemWithId,
  type PersonWithId,
  type UserIdT,
} from '@/types';

import { getItem, removeItem, setItem } from './storage';
import { calculatePersonShare, createSelectors } from './utils';

const TEMP_EXPENSE_KEY = 'temp-expense';
type TempExpense = ExpenseWithId & {
  items: ItemWithId[];
  people: PersonWithId[];
};
export const getTempExpense = () => getItem<TempExpense>(TEMP_EXPENSE_KEY);
export const removeTempExpense = () => removeItem(TEMP_EXPENSE_KEY);
export const setTempExpense = (value: TempExpense) => {
  setItem<TempExpense>(TEMP_EXPENSE_KEY, value);
};

interface ExpenseCreationState {
  tempExpense: TempExpense | null;
  setExpenseName: (name: string) => void;
  addItem: (item: ItemWithId) => void;
  removeItem: (itemId: ItemIdT) => void;
  updateItem: (itemId: string, updates: Partial<ItemWithId>) => void;
  updateItemShare: (
    itemId: ItemIdT,
    personId: string,
    newShare: number
  ) => void;
  assignPersonToItem: (itemId: ItemIdT, personId: string) => void;
  removePersonFromItem: (itemId: ItemIdT, personId: string) => void;
  addPerson: (person: PersonWithId) => void;
  removePerson: (personId: string) => void;
  updatePerson: (personId: string, updates: Partial<PersonWithId>) => void;
  clearTempExpense: () => void;
  clearTempExpenseItems: () => void;
  initializeTempExpense: (createdBy: UserIdT) => void;
  hydrate: () => void;
  getTotalAmount: () => number;
}

const _useExpenseCreation = create<ExpenseCreationState>((set, get) => ({
  tempExpense: null,

  hydrate: () => {
    const current = get().tempExpense;
    if (current !== null) {
      return;
    }
    try {
      const saved = getTempExpense();
      if (saved !== null) {
        set({ tempExpense: saved });
      }
    } catch (e) {
      console.error(e);
      removeTempExpense();
    }
  },

  initializeTempExpense: (createdBy) => {
    const newTempExpense: TempExpense = {
      id: 'temp-expense' as ExpenseIdT,
      name: '',
      date: new Date().toISOString(),
      createdBy: createdBy as string,
      remainingAmount: 0,
      participantCount: 0,
      items: [],
      people: [],
      totalAmount: 0,
    };
    set({ tempExpense: newTempExpense });
    setTempExpense(newTempExpense);
  },

  setExpenseName: (name) => {
    const current = get().tempExpense;
    if (current) {
      const updated = { ...current, name };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  setItemName: (name: string) => {
    const current = get().tempExpense;
    if (current) {
      const updated = { ...current, name };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },
  setItemAmount: (amount: number) => {
    const current = get().tempExpense;
    if (current) {
      const updated = { ...current, amount };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  addItem: (item) => {
    const current = get().tempExpense;
    if (current) {
      const updated = {
        ...current,
        items: [...current.items, item],
        totalAmount: current.totalAmount + item.amount,
        remainingAmount: current.totalAmount + item.amount,
      };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  removeItem: (itemId) => {
    const current = get().tempExpense;
    if (current) {
      const itemToRemove = current.items.find((item) => item.id === itemId);
      const updated = {
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
        totalAmount: itemToRemove
          ? current.totalAmount - itemToRemove.amount
          : current.totalAmount,
        remainingAmount: itemToRemove
          ? current.totalAmount - itemToRemove.amount
          : current.remainingAmount,
      };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  updateItem: (itemId, updates) => {
    const current = get().tempExpense;
    if (current) {
      const updated = {
        ...current,
        items: current.items.map((item) =>
          item.id === itemId ? { ...item, ...updates } : item
        ),
      };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  updateItemShare: (itemId, personId, newShare) => {
    const current = get().tempExpense;
    if (!current) return;

    // Update items
    const oldItem = current.items.find((i) => i.id === itemId);
    const updatedItems = current.items.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        split: {
          ...item.split,
          shares: { ...item.split.shares, [personId]: newShare },
        },
      };
    });

    // Recalculate people subtotals using updated items
    const updatedItem = updatedItems.find((i) => i.id === itemId);
    const updatedPeople = current.people.map((person) => {
      const oldShare = oldItem ? calculatePersonShare(oldItem, person.id) : 0;
      const updatedShare = updatedItem
        ? calculatePersonShare(updatedItem, person.id)
        : 0;
      const difference = updatedShare - oldShare;
      if (!difference) return person;
      return { ...person, subtotal: person.subtotal + difference };
    });

    const updated = { ...current, items: updatedItems, people: updatedPeople };
    set({ tempExpense: updated });
    setTempExpense(updated);
  },

  assignPersonToItem: (itemId, personId) => {
    const current = get().tempExpense;
    if (!current) return;

    // Update items
    const updatedItems = current.items.map((item) => {
      if (item.id !== itemId) return item;
      if (item.assignedPersonIds?.includes(personId)) return item;
      return {
        ...item,
        assignedPersonIds: [...(item.assignedPersonIds || []), personId],
        split: {
          ...item.split,
          shares: { ...item.split.shares, [personId]: 1 },
        },
      };
    });

    // Recalculate people subtotals using updated items
    const oldItem = current.items.find((i) => i.id === itemId);
    const updatedItem = updatedItems.find((i) => i.id === itemId);
    const updatedPeople = current.people.map((person) => {
      const oldShare = oldItem ? calculatePersonShare(oldItem, person.id) : 0;
      const newShare = updatedItem
        ? calculatePersonShare(updatedItem, person.id)
        : 0;
      const difference = newShare - oldShare;
      if (!difference) return person;
      return { ...person, subtotal: person.subtotal + difference };
    });

    const updated = { ...current, items: updatedItems, people: updatedPeople };
    set({ tempExpense: updated });
    setTempExpense(updated);
  },

  removePersonFromItem: (itemId, personId) => {
    const current = get().tempExpense;
    if (!current) return;

    // Update items
    const oldItem = current.items.find((i) => i.id === itemId);
    const updatedItems = current.items.map((item) => {
      if (item.id !== itemId) return item;
      const newShares = { ...item.split.shares };
      delete newShares[personId];
      return {
        ...item,
        assignedPersonIds: (item.assignedPersonIds || []).filter(
          (id) => id !== personId
        ),
        split: { ...item.split, shares: newShares },
      };
    });

    // Recalculate people subtotals using updated items
    const updatedItem = updatedItems.find((i) => i.id === itemId);
    const updatedPeople = current.people.map((person) => {
      const oldShare = oldItem ? calculatePersonShare(oldItem, person.id) : 0;
      const newShare = updatedItem
        ? calculatePersonShare(updatedItem, person.id)
        : 0;
      const difference = newShare - oldShare;
      if (!difference) return person;
      return { ...person, subtotal: person.subtotal + difference };
    });

    const updated = { ...current, items: updatedItems, people: updatedPeople };
    set({ tempExpense: updated });
    setTempExpense(updated);
  },

  addPerson: (person) => {
    const current = get().tempExpense;
    if (current) {
      // Avoid adding duplicates
      if (current.people.find((p) => p.id === person.id)) {
        return;
      }
      const updated = {
        ...current,
        people: [...current.people, person],
        participantCount: current.people.length + 1,
      };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  removePerson: (personId) => {
    const current = get().tempExpense;
    if (current) {
      const updated = {
        ...current,
        people: current.people.filter((p) => p.id !== personId),
        participantCount: current.people.length - 1,
      };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  updatePerson: (personId, updates) => {
    const current = get().tempExpense;
    if (current) {
      const updated = {
        ...current,
        people: current.people.map((person) =>
          person.id === personId ? { ...person, ...updates } : person
        ),
      };
      set({ tempExpense: updated });
      setTempExpense(updated);
    }
  },

  clearTempExpense: () => {
    set({ tempExpense: null });
    removeTempExpense();
  },

  clearTempExpenseItems: () => {
    const current = get().tempExpense;
    if (current) {
      const updated = {
        ...current,
        items: [],
        totalAmount: 0,
        remainingAmount: 0,
      };
      set({ tempExpense: updated });

      setTempExpense(updated);
    }
  },

  getTotalAmount: () => {
    const current = get().tempExpense;
    if (!current) return 0;
    return current.totalAmount;
  },
}));

export const useExpenseCreation = createSelectors(_useExpenseCreation);

// Helper functions for non-hook usage
export const initializeTempExpense = (createdBy: UserIdT) =>
  _useExpenseCreation.getState().initializeTempExpense(createdBy);

export const clearTempExpense = () =>
  _useExpenseCreation.getState().clearTempExpense();

export const hydrateTempExpense = () =>
  _useExpenseCreation.getState().hydrate();

export const getTempExpenseState = () =>
  _useExpenseCreation.getState().tempExpense;
