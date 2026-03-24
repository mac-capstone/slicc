import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  updateDoc,
} from 'firebase/firestore';
import { useCallback, useEffect, useRef, useState } from 'react';

import { db } from '@/api/common/firebase';
import { encryptMessage } from '@/lib/crypto/e2e-crypto';
import type { ChatMessageIdT, ChatMessageWithId, LocationShare } from '@/types';
import { chatMessageConverter } from '@/types/schema';

const PAGE_SIZE = 30;

/**
 * Messages are stored in DESCENDING order (newest -> oldest).
 * This matches the `inverted` FlatList which renders data[0] at the visual bottom.
 *
 * oldestSnap is the cursor for the next loadMore call (startAfter in desc order
 * = fetch messages even older than our current oldest).
 */
type GroupChatCache = {
  messages: ChatMessageWithId[];
  oldestSnap: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

const messageCache = new Map<string, GroupChatCache>();

export type UseMessagesResult = {
  messages: ChatMessageWithId[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
};

/** Real-time subscription to the latest messages in a group chat. */
export function useMessages(groupId: string | null): UseMessagesResult {
  const cached = groupId ? messageCache.get(groupId) : undefined;

  const [messages, setMessages] = useState<ChatMessageWithId[]>(
    () => cached?.messages ?? []
  );
  const [isLoading, setIsLoading] = useState(() => !cached);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(() => cached?.hasMore ?? true);

  const groupIdRef = useRef(groupId);
  groupIdRef.current = groupId;
  const isLoadingMoreRef = useRef(false);

  useEffect(() => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }

    const ref = collection(db, 'groups', groupId, 'messages').withConverter(
      chatMessageConverter
    );
    // Descending order + limit: gives the most recent PAGE_SIZE messages.
    // docChanges() so subsequent snaps only process the delta.
    const q = query(ref, orderBy('sentAt', 'desc'), limit(PAGE_SIZE));

    const unsub = onSnapshot(q, (snap) => {
      const prev = messageCache.get(groupId);

      // IDs in the live window — replace with fresh data from this snapshot.
      const snapIds = new Set(snap.docs.map((d) => d.id));

      // Keep any older messages that fell out of the live window due to pagination
      // (e.g. after 31+ messages exist, msg #1 leaves the window but user loaded it)
      const olderMessages = (prev?.messages ?? []).filter(
        (m) => !snapIds.has(m.id)
      );

      const recentMessages: ChatMessageWithId[] = snap.docs.map((d) => ({
        id: d.id as ChatMessageIdT,
        ...d.data(),
        decryptedContent: undefined,
      }));

      // DESC: recent first (data[0] = newest = visual bottom of inverted list),
      // then older messages already fetched via pagination appended at the end
      // (data[last] = oldest = visual top of inverted list).
      const combined = [...recentMessages, ...olderMessages];

      // Oldest cursor: initialise from live window; don't overwrite once pagination
      // has pushed it further back.
      const oldestSnap = prev?.oldestSnap ?? snap.docs.at(-1) ?? null;
      const hasMoreVal = prev?.hasMore ?? snap.docs.length >= PAGE_SIZE;

      messageCache.set(groupId, {
        messages: combined,
        oldestSnap,
        hasMore: hasMoreVal,
      });
      setMessages(combined);
      setHasMore(hasMoreVal);
      setIsLoading(false);
    });

    return () => unsub();
  }, [groupId]);

  const loadMore = useCallback(async () => {
    const gid = groupIdRef.current;
    if (!gid || isLoadingMoreRef.current) return;
    const prev = messageCache.get(gid);
    if (!prev?.oldestSnap || !prev.hasMore) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const ref = collection(db, 'groups', gid, 'messages').withConverter(
        chatMessageConverter
      );
      // startAfter in DESC order = fetch messages older than our current oldest
      const q = query(
        ref,
        orderBy('sentAt', 'desc'),
        startAfter(prev.oldestSnap),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);

      const olderMessages: ChatMessageWithId[] = snap.docs.map((d) => ({
        id: d.id as ChatMessageIdT,
        ...d.data(),
        decryptedContent: undefined,
      }));

      const newOldestSnap = snap.docs.at(-1) ?? prev.oldestSnap;
      const hasMoreVal = snap.docs.length >= PAGE_SIZE;

      // Append at end (these are older, so they go toward the visual top)
      const combined = [...prev.messages, ...olderMessages];
      messageCache.set(gid, {
        messages: combined,
        oldestSnap: newOldestSnap,
        hasMore: hasMoreVal,
      });
      setMessages(combined);
      setHasMore(hasMoreVal);
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, []);

  return { messages, isLoading, isLoadingMore, hasMore, loadMore };
}

/** Send an encrypted text message to a group chat. */
export async function sendTextMessage({
  groupId,
  senderId,
  plaintext,
  groupKey,
}: {
  groupId: string;
  senderId: string;
  plaintext: string;
  groupKey: string;
}): Promise<void> {
  const { ciphertext, nonce } = encryptMessage(plaintext, groupKey);
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    senderId,
    type: 'text',
    encryptedContent: ciphertext,
    nonce,
    keyVersion: 0,
    sentAt: serverTimestamp(),
    readBy: [],
  });
}

/** Send a location share (plaintext -- public place data) to a group chat. */
export async function sendLocationMessage(
  groupId: string,
  senderId: string,
  location: LocationShare
): Promise<void> {
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    senderId,
    type: 'location',
    locationPayload: location,
    keyVersion: 0,
    sentAt: serverTimestamp(),
    readBy: [],
  });
}

/**
 * Toggle an emoji reaction on a message.
 * Adds the emoji if the user hasn't reacted yet; removes it if they have.
 * Uses arrayUnion / arrayRemove so each field is a per-emoji user list.
 */
export async function toggleReaction({
  groupId,
  messageId,
  emoji,
  userId,
  currentReactions,
}: {
  groupId: string;
  messageId: string;
  emoji: string;
  userId: string;
  currentReactions: Record<string, string[]>;
}): Promise<void> {
  const hasReacted = (currentReactions[emoji] ?? []).includes(userId);
  const msgRef = doc(db, 'groups', groupId, 'messages', messageId);
  await updateDoc(msgRef, {
    [`reactions.${emoji}`]: hasReacted
      ? arrayRemove(userId)
      : arrayUnion(userId),
  });
}

/** Send a system message (membership events, etc.) */
export async function sendSystemMessage(
  groupId: string,
  text: string
): Promise<void> {
  await addDoc(collection(db, 'groups', groupId, 'messages'), {
    senderId: 'system',
    type: 'system',
    systemText: text,
    keyVersion: 0,
    sentAt: serverTimestamp(),
    readBy: [],
  });
}
