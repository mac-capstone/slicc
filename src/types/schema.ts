import {
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { z } from 'zod';

// ── Firestore helpers ──────────────────────────────────────────────────────

const firestoreTimestamp = z
  .custom<Timestamp>((val) => val instanceof Timestamp)
  .transform((val) => val.toDate());

function zodConverter<Out>(
  schema: z.ZodType<Out, z.ZodTypeDef, unknown>
): FirestoreDataConverter<Out> {
  return {
    toFirestore(data: Out): DocumentData {
      return data as DocumentData;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): Out {
      return schema.parse(snapshot.data());
    },
  };
}

// ── User ───────────────────────────────────────────────────────────────────

export const userSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  createdAt: firestoreTimestamp.optional(),
  updatedAt: firestoreTimestamp.optional(),
});

export const userConverter = zodConverter(userSchema);

// ── Group ──────────────────────────────────────────────────────────────────

export const groupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  owner: z.string(),
  admins: z.array(z.string()),
  members: z.array(z.string()),
  events: z.array(z.string()),
  createdAt: firestoreTimestamp.optional(),
  updatedAt: firestoreTimestamp.optional(),
});

export const groupConverter = zodConverter(groupSchema);

// ── Event ──────────────────────────────────────────────────────────────────

export const eventSchema = z.object({
  name: z.string(),
  createdBy: z.string(),
  description: z.string().optional(),
  details: z.string().optional(),
  startDate: firestoreTimestamp,
  endDate: firestoreTimestamp,
  isRecurring: z.boolean().optional(),
  recurringInterval: z.number().optional(),
  recurringUnit: z.enum(['day', 'week', 'month', 'year']).optional(),
  recurringEndDate: firestoreTimestamp.optional(),
  location: z.string().optional(),
  locationUrl: z.string().optional(),
  groupId: z.string().optional(),
  participants: z.array(z.string()).default([]),
  createdAt: firestoreTimestamp.optional(),
  updatedAt: firestoreTimestamp.optional(),
});

export const eventConverter = zodConverter(eventSchema);

// ── Expense ────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  name: z.string(),
  date: z.union([firestoreTimestamp, z.string()]),
  createdBy: z.string(),
  eventId: z.string().optional(),
  totalAmount: z.number(),
  remainingAmount: z.number().optional(),
  participantCount: z.number().optional(),
  createdAt: firestoreTimestamp.optional(),
  updatedAt: firestoreTimestamp.optional(),
});

export const expenseConverter = zodConverter(expenseSchema);

// ── Expense → people subcollection ─────────────────────────────────────────

export const expensePersonSchema = z.object({
  subtotal: z.number(),
  paid: z.number(),
});

export const expensePersonConverter = zodConverter(expensePersonSchema);

// ── Expense → items subcollection ──────────────────────────────────────────

export const expenseItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  taxRate: z.number().optional(),
  split: z.object({
    mode: z.string(),
    shares: z.record(z.string(), z.number()),
  }),
  assignedPersonIds: z.array(z.string()),
  isTip: z.boolean().optional(),
});

export const expenseItemConverter = zodConverter(expenseItemSchema);
