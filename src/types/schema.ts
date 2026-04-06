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

export const userProfileSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  friends: z.array(z.string()).default([]),
  createdAt: firestoreTimestamp.optional(),
  updatedAt: firestoreTimestamp.optional(),
});

export const userSettingsSchema = z.object({
  dietaryPreferences: z.array(z.string()).default([]),
  locationPreference: z.string().optional(),
  eTransferEmail: z.string().email().optional(),
  bankPreference: z
    .enum([
      'none',
      'all-banks',
      'interac',
      'rbc',
      'td',
      'scotia',
      'cibc',
      'bmo',
      'national-bank',
      'desjardins',
      'tangerine',
      'simplii',
      'laurentian',
      'meridian',
      'coast-capital',
      'vancity',
      'atb',
      'eq-bank',
      'wealthsimple',
      'koho',
      'neo',
      'other',
    ])
    .optional(),
  defaultTaxRate: z.number().optional(),
  defaultTipRate: z.number().optional(),
  updatedAt: firestoreTimestamp.optional(),
});

// Backward-compatible alias where user schema means the public profile document.
export const userSchema = userProfileSchema;

export type UserProfileFirestore = z.infer<typeof userProfileSchema>;
export type UserSettingsFirestore = z.infer<typeof userSettingsSchema>;

export const userConverter: FirestoreDataConverter<
  UserProfileFirestore,
  DocumentData
> = zodConverter(userProfileSchema);

export const userSettingsConverter: FirestoreDataConverter<
  UserSettingsFirestore,
  DocumentData
> = zodConverter(userSettingsSchema);

// ── Friend request (collection: friendRequests/{requestId}) ─────────────────
// Dedicated docs for pending / resolved requests (separate from user.friends).

export const friendRequestStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'cancelled',
]);

export const friendRequestSchema = z.object({
  fromUserId: z.string(),
  toUserId: z.string(),
  status: friendRequestStatusSchema,
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp.optional(),
});

export const friendRequestConverter = zodConverter(friendRequestSchema);

// ── Friendship (collection: friendships/{friendshipId}) ────────────────────
// Canonical “are friends” edge: one doc per pair (e.g. id = sorted user ids).
// user.friends on User remains as-is for optional denormalization.

export const friendshipSchema = z.object({
  userIds: z.tuple([z.string(), z.string()]),
  createdAt: firestoreTimestamp,
  acceptedFromRequestId: z.string().optional(),
});

export const friendshipConverter = zodConverter(friendshipSchema);

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
  payerUserId: z.string().optional(),
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
  guestName: z.string().optional(),
});

export const expensePersonConverter = zodConverter(expensePersonSchema);

// ── Expense → items subcollection ──────────────────────────────────────────

export const expenseItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  taxRate: z.number(),
  split: z.object({
    mode: z.string(),
    shares: z.record(z.string(), z.number()),
  }),
  assignedPersonIds: z.array(z.string()),
  isTip: z.boolean().optional(),
});

export const expenseItemConverter = zodConverter(expenseItemSchema);
