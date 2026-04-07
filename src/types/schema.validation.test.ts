/**
 * V&V §6.7.1 — data validation / auth-shaped payloads (client-side contracts).
 * Exercises Zod converters used with Firestore without touching production modules.
 */
import { Timestamp } from 'firebase/firestore';

import {
  friendRequestSchema,
  friendshipSchema,
  groupSchema,
  userProfileSchema,
  userSettingsSchema,
} from '@/types/schema';

jest.mock('firebase/firestore', () => {
  class MockTimestamp {
    private readonly d: Date;
    constructor(d: Date) {
      this.d = d;
    }
    static fromDate(date: Date) {
      return new MockTimestamp(date);
    }
    toDate() {
      return this.d;
    }
  }
  return { Timestamp: MockTimestamp };
});

describe('schema validation (data / infra contracts)', () => {
  const now = Timestamp.fromDate(new Date('2026-04-04T12:00:00.000Z'));

  it('parses a minimal user profile', () => {
    const parsed = userProfileSchema.parse({
      username: 'alice',
      displayName: 'Alice',
      friends: ['u2'],
    });
    expect(parsed.username).toBe('alice');
  });

  it('parses user settings with bank preference', () => {
    const parsed = userSettingsSchema.parse({
      dietaryPreferences: ['v'],
      bankPreference: 'rbc',
      defaultTaxRate: 13,
    });
    expect(parsed.bankPreference).toBe('rbc');
  });

  it('parses friend request documents', () => {
    const parsed = friendRequestSchema.parse({
      fromUserId: 'a',
      toUserId: 'b',
      status: 'pending',
      createdAt: now,
    });
    expect(parsed.status).toBe('pending');
  });

  it('parses friendship edge documents', () => {
    const parsed = friendshipSchema.parse({
      userIds: ['a', 'b'] as [string, string],
      createdAt: now,
    });
    expect(parsed.userIds).toHaveLength(2);
  });

  it('parses group documents', () => {
    const parsed = groupSchema.parse({
      name: 'Roommates',
      owner: 'o1',
      admins: ['o1'],
      members: ['o1', 'm2'],
      events: [],
    });
    expect(parsed.members).toContain('m2');
  });
});
