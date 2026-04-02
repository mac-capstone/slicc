# Expense Edit Feature — Changes & Rationale

## Files Modified

- `src/lib/store.ts`
- `src/app/expense/[id].tsx`
- `src/app/expense/add-expense.tsx`

---

## `src/lib/store.ts`

### 1. Added edit-mode tracking fields to `TempExpense` type

- Added `originalExpenseId?`, `originalItemIds?`, `originalPersonIds?` to the `TempExpense` type.
- **Why:** The confirm handler needs to know whether it is creating a new expense or updating an existing one. `originalExpenseId` is the Firestore document ID to overwrite. `originalItemIds` and `originalPersonIds` are needed to delete the old subcollection documents before writing the new ones (prevents stale items/people from lingering).

### 2. Added `initializeFromExistingExpense` action

- Loads an existing expense from Firestore into the Zustand store.
- Recalculates each person's subtotal by summing `calculatePersonShare` across all items, then filters out anyone whose recalculated subtotal is 0.
- Sets `originalExpenseId`, `originalItemIds`, `originalPersonIds` so the confirm handler can detect edit mode.
- **Why:** The stored Firestore subtotals can be stale (e.g. a person was assigned to an item that was later deleted in a previous edit). Recalculating from scratch guarantees the in-memory state is consistent with the actual items. Filtering zero-subtotal people removes participants who have no items assigned to them — they should not appear in the split view or be written back to Firestore.

### 3. Fixed `removeItem` to recalculate person subtotals

- When an item is removed, each person's share of that item is subtracted from their subtotal using `calculatePersonShare`.
- People whose subtotal drops to 0 are filtered out of the `people` array.
- `participantCount`, `totalAmount`, and `remainingAmount` are updated accordingly.
- **Why:** Previously `removeItem` only removed the item from the list — it never touched `people`. This meant a deleted item's cost was still attributed to the assigned people, causing incorrect subtotals and phantom participants on confirm.

### 4. Fixed `updateItem` to keep totals and subtotals in sync

- When an item's amount changes, the difference (`newAmount - oldAmount`) is added to `totalAmount` and `remainingAmount`.
- Each person's subtotal is recalculated using the old and new item's `calculatePersonShare` diff.
- **Why:** Without this, editing an item's amount would silently leave the expense total and all person subtotals out of date, causing the wrong amounts to be written to Firestore on confirm.

### 5. Exported `initializeFromExistingExpense` as a non-hook helper

- **Why:** The `add-expense.tsx` screen calls it outside of a React component (inside a `useEffect`), so it needs the store's `getState()` form, not the hook.

---

## `src/app/expense/[id].tsx`

### 6. Added a "Settle Up" wallet icon button

- Added a wallet icon (`Ionicons wallet-outline`) that navigates to `/expense/settle?id=${id}`.
- Only shown when `viewMode !== 'confirm'` and `id !== 'temp-expense'`.
- **Why:** The original edit (pencil) button was reassigned to open the edit expense flow. The settle-up functionality needed its own dedicated button so both actions are accessible from the expense detail screen.

### 7. Reassigned the pencil icon to open the edit expense screen

- The pencil icon now navigates to `/expense/add-expense?expenseId=${id}`.
- **Why:** This is the entry point for the edit expense flow. Passing `expenseId` as a query param tells `add-expense.tsx` to load and pre-fill the existing expense rather than start a blank creation flow.

### 8. `handleConfirmExpense` reads from Zustand, not React Query

- All data written to Firestore (name, total, people, items) is read from `getTempExpenseState()` (Zustand) instead of `data` (React Query).
- **Why:** There is a race condition between the Zustand store (synchronously updated on every user action) and the React Query cache (updated asynchronously from Firestore). Using React Query `data` risks writing stale values — for example, item changes made in the edit screen would be lost because React Query had not yet re-fetched. Zustand is always the current source of truth during the edit flow.

### 9. Both confirm branches (create + update) filter zero-subtotal people

- Only people with `subtotal > 0` are written to the Firestore `people` subcollection.
- **Why:** Prevents ghost participants — people who were assigned to an item that was later deleted — from being saved to the database and appearing in the split view.

### 10. Replaced `refetchQueries` with `invalidateQueries({ refetchType: 'all' })`

- Applied to both the create branch and the update branch.
- **Why:** `refetchQueries` only refetches queries that have active mounted subscribers. After `router.push('/')`, the expense detail query and the edit screen's query become inactive (unmounted). `invalidateQueries` with `refetchType: 'all'` marks all matching queries stale and refetches them including inactive ones, so the next time the user opens the expense detail or the edit screen, the cache is already fresh — no stale data is shown.

---

## `src/app/expense/add-expense.tsx`

### 11. Added `expenseId` route param and `isEditMode` flag

- `expenseId` is read from `useLocalSearchParams`. If present, `isEditMode = true`.
- `useExpense` is called with `enabled: isEditMode` to fetch the existing expense from Firestore.
- **Why:** The same screen handles both create and edit. The param distinguishes the two modes without duplicating the screen.

### 12. Dynamic header title

- Shows `'Edit Expense'` when `isEditMode` is true, `'Create an expense'` otherwise.
- **Why:** Clear user-facing indication of which mode they are in.

### 13. Fixed initialization `useEffect` to handle MMKV hydration correctly

- Checks `tempExpense?.originalExpenseId === expenseId` (`alreadyLoaded`) to avoid re-initializing when the store was already populated from MMKV on a previous visit.
- If `!alreadyLoaded` and Firestore data is available: calls `initializeFromExistingExpense` and syncs the name input.
- If `alreadyLoaded` but name input is empty (MMKV hydrated, component just mounted): syncs name from `tempExpense.name`.
- In create mode, re-initializes if the store contains a leftover `originalExpenseId` from a previous edit session.
- **Why:** Without the `alreadyLoaded` check, navigating back to the edit screen would reload Firestore data and overwrite any unsaved changes the user made. Without the `else if` branch, the expense name input would stay blank when the store was hydrated from MMKV (the name was in the store but the React state was never set).

### 14. Added `updateItem` to store destructuring and passed `onUpdate` to `TempItemCard`

- **Why:** Required to wire up the inline edit functionality so item changes are written back to the Zustand store.

### 15. Added inline item editing to `TempItemCard`

- Added `isEditing` state, `editName`, `editAmount`, `editTax` local state.
- A pencil icon (`Ionicons pencil-outline`) is shown on all non-tip items in the normal (non-editing) view.
- Pressing the pencil icon switches the card to an edit form showing name, base amount, and tax rate inputs, plus a live tax breakdown preview.
- `handleEditPress` reverse-calculates the base amount from the stored total-with-tax (`base = amount / (1 + taxRate/100)`) so the input is pre-filled with the original pre-tax value.
- `handleSave` recalculates `total = base * (1 + tax/100)` and calls `onUpdate(item.id, { name, amount: total, taxRate })`.
- Pan gesture (swipe-to-delete) is disabled while in edit mode via `.enabled(!isEditing)`.
- Tips (`item.isTip`) do not show the pencil icon.
- **Why:** Users needed a way to fix typos or incorrect amounts without deleting and re-adding an item. Inline editing is less destructive — it preserves the item's existing person assignments and split shares.

### 16. Tax rate display on item cards

- In the normal (non-editing) view, shows `Tax (X%) included` below the item name when `item.taxRate > 0`.
- **Why:** Previously, items with tax looked identical to items without — users had no way to see if tax had been applied. This makes the data visible without requiring the user to open the edit form.
