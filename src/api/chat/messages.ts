import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import {
  type DataSnapshot,
  endBefore,
  get,
  limitToLast,
  onValue,
  orderByKey,
  push,
  query,
  ref as dbRef,
  runTransaction,
  serverTimestamp,
  set,
} from 'firebase/database';
import { getBytes, ref as storageRef } from 'firebase/storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { auth, rtdb, storage } from '@/api/common/firebase';
import {
  b64ToBytes,
  encryptBytes,
  encryptMessage,
} from '@/lib/crypto/e2e-crypto';
import type { ChatMessageIdT, ChatMessageWithId, LocationShare } from '@/types';

const PAGE_SIZE = 30;

function messagesPath(groupId: string): string {
  return `groups/${groupId}/messages`;
}

async function uploadEncryptedBytesToFirebaseStorage({
  objectPath,
  ciphertextB64,
}: {
  objectPath: string;
  ciphertextB64: string;
}): Promise<void> {
  const rawBucket = storage.app.options.storageBucket;
  if (!rawBucket) throw new Error('Missing Firebase storageBucket config');
  // Accept both "bucket-name" and "gs://bucket-name" formats.
  const bucket = rawBucket.startsWith('gs://')
    ? rawBucket.slice('gs://'.length)
    : rawBucket;
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');

  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  // Use Expo's fetch so RN can send Uint8Array bodies reliably.
  const res = await expoFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: b64ToBytes(ciphertextB64) as unknown as BodyInit,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Storage upload failed (${res.status}): ${text}`);
  }
}

/** Normalize RTDB JSON into the same `ChatMessage` shape the UI already expects. */
function parseChatMessageRtdb(
  id: string,
  raw: unknown
): ChatMessageWithId | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const senderId = r.senderId;
  const type = r.type;
  if (typeof senderId !== 'string') return null;
  if (
    type !== 'text' &&
    type !== 'image' &&
    type !== 'location' &&
    type !== 'system'
  )
    return null;

  let sentAt: Date;
  const st = r.sentAt;
  if (typeof st === 'number' && Number.isFinite(st)) sentAt = new Date(st);
  else sentAt = new Date();

  const readBy = Array.isArray(r.readBy)
    ? r.readBy.filter((x): x is string => typeof x === 'string')
    : [];

  const reactions: Record<string, string[]> = {};
  if (
    r.reactions &&
    typeof r.reactions === 'object' &&
    !Array.isArray(r.reactions)
  ) {
    for (const [emoji, users] of Object.entries(
      r.reactions as Record<string, unknown>
    )) {
      if (Array.isArray(users))
        reactions[emoji] = users.filter(
          (u): u is string => typeof u === 'string'
        );
    }
  }

  return {
    id: id as ChatMessageIdT,
    senderId,
    type,
    encryptedContent:
      typeof r.encryptedContent === 'string' ? r.encryptedContent : undefined,
    nonce: typeof r.nonce === 'string' ? r.nonce : undefined,
    keyVersion: typeof r.keyVersion === 'number' ? r.keyVersion : 0,
    imagePath: typeof r.imagePath === 'string' ? r.imagePath : undefined,
    mimeType: typeof r.mimeType === 'string' ? r.mimeType : undefined,
    fileName: typeof r.fileName === 'string' ? r.fileName : undefined,
    captionEncrypted:
      typeof r.captionEncrypted === 'string' ? r.captionEncrypted : undefined,
    captionNonce:
      typeof r.captionNonce === 'string' ? r.captionNonce : undefined,
    locationPayload:
      r.locationPayload && typeof r.locationPayload === 'object'
        ? (r.locationPayload as LocationShare)
        : undefined,
    systemText: typeof r.systemText === 'string' ? r.systemText : undefined,
    sentAt,
    readBy,
    reactions,
    decryptedContent: undefined,
  };
}

function snapshotToMessageList(snapshot: DataSnapshot): ChatMessageWithId[] {
  const rows: ChatMessageWithId[] = [];
  snapshot.forEach((child) => {
    const id = child.key;
    if (!id) return false;
    const m = parseChatMessageRtdb(id, child.val());
    if (m) rows.push(m);
    return false;
  });
  rows.reverse();
  return rows;
}

/**
 * Messages are stored with Firebase `push()` ids (chronological when sorted as strings).
 * The live window uses `orderByKey` + `limitToLast` (newest keys). `data[0]` = newest
 * for the inverted FlatList.
 */
type GroupChatCache = {
  messages: ChatMessageWithId[];
  oldestKey: string | null;
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

/** Real-time subscription to the latest messages in a group chat (Realtime DB). */
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
      setMessages([]);
      return;
    }

    const boot = messageCache.get(groupId);
    setMessages(boot?.messages ?? []);
    setHasMore(boot?.hasMore ?? true);
    setIsLoading(!boot);

    const baseRef = dbRef(rtdb, messagesPath(groupId));
    const q = query(baseRef, orderByKey(), limitToLast(PAGE_SIZE));

    const unsub = onValue(q, (snap) => {
      const prev = messageCache.get(groupId);
      if (!snap.exists()) {
        messageCache.set(groupId, {
          messages: [],
          oldestKey: null,
          hasMore: false,
        });
        setMessages([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      const recentMessages = snapshotToMessageList(snap);
      const snapIds = new Set(recentMessages.map((m) => m.id));
      const olderMessages = (prev?.messages ?? []).filter(
        (m) => !snapIds.has(m.id)
      );
      const combined = [...recentMessages, ...olderMessages];

      const oldestKey =
        combined.length > 0 ? combined[combined.length - 1]!.id : null;
      const keyCount = snap.size;
      const hasMoreVal = prev?.hasMore ?? keyCount >= PAGE_SIZE;

      messageCache.set(groupId, {
        messages: combined,
        oldestKey,
        hasMore: hasMoreVal,
      });
      setMessages(combined);
      setHasMore(hasMoreVal);
      setIsLoading(false);
    });

    return unsub;
  }, [groupId]);

  const loadMore = useCallback(async () => {
    const gid = groupIdRef.current;
    if (!gid || isLoadingMoreRef.current) return;
    const prev = messageCache.get(gid);
    if (!prev?.oldestKey || !prev.hasMore) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const baseRef = dbRef(rtdb, messagesPath(gid));
      const q = query(
        baseRef,
        orderByKey(),
        endBefore(prev.oldestKey),
        limitToLast(PAGE_SIZE)
      );
      const snap = await get(q);
      if (!snap.exists()) {
        messageCache.set(gid, { ...prev, hasMore: false });
        setHasMore(false);
        return;
      }

      const olderBatch = snapshotToMessageList(snap);
      const newOldestKey =
        olderBatch.length > 0
          ? olderBatch[olderBatch.length - 1]!.id
          : prev.oldestKey;
      const hasMoreVal = olderBatch.length >= PAGE_SIZE;

      const combined = [...prev.messages, ...olderBatch];
      messageCache.set(gid, {
        messages: combined,
        oldestKey: newOldestKey,
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
  const msgRef = push(dbRef(rtdb, messagesPath(groupId)));
  await set(msgRef, {
    senderId,
    type: 'text',
    encryptedContent: ciphertext,
    nonce,
    keyVersion: 0,
    sentAt: serverTimestamp(),
    readBy: [],
  });
}

export async function sendImageMessage({
  groupId,
  senderId,
  localUri,
  mimeType,
  fileName,
  groupKey,
  captionPlaintext,
}: {
  groupId: string;
  senderId: string;
  localUri: string;
  mimeType: string;
  fileName: string;
  groupKey: string;
  /** Optional text shown under the image in the thread. */
  captionPlaintext?: string;
}): Promise<void> {
  // Read local image bytes using the non-deprecated Expo File API.
  const file = new File(localUri);
  const bytes = await file.bytes();

  // Encrypt bytes with group key
  const { ciphertext, nonce } = encryptBytes(bytes, groupKey);

  const safeName = fileName.replace(/[^\w.\-]/g, '_');
  const storagePath = `groups/${groupId}/${Date.now()}_${safeName}.enc`;
  // Firebase Storage web SDK upload path uses Blobs internally and breaks on RN.
  // Use the Storage REST endpoint instead (authorized with the Firebase ID token).
  await uploadEncryptedBytesToFirebaseStorage({
    objectPath: storagePath,
    ciphertextB64: ciphertext,
  });

  const captionTrimmed = captionPlaintext?.trim() ?? '';
  const captionPayload =
    captionTrimmed.length > 0 ? encryptMessage(captionTrimmed, groupKey) : null;

  const msgRef = push(dbRef(rtdb, messagesPath(groupId)));
  await set(msgRef, {
    senderId,
    type: 'image',
    imagePath: storagePath,
    mimeType,
    fileName,
    nonce,
    keyVersion: 0,
    sentAt: serverTimestamp(),
    readBy: [],
    ...(captionPayload
      ? {
          captionEncrypted: captionPayload.ciphertext,
          captionNonce: captionPayload.nonce,
        }
      : {}),
  });
}

export async function fetchEncryptedImageBytes(
  storagePath: string
): Promise<Uint8Array> {
  const buf = await getBytes(storageRef(storage, storagePath));
  return new Uint8Array(buf);
}

/** Send a location share (plaintext -- public place data) to a group chat. */
export async function sendLocationMessage(
  groupId: string,
  senderId: string,
  location: LocationShare
): Promise<void> {
  const msgRef = push(dbRef(rtdb, messagesPath(groupId)));
  await set(msgRef, {
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
 * Uses a transaction so concurrent toggles stay consistent.
 */
export async function toggleReaction({
  groupId,
  messageId,
  emoji,
  userId,
  currentReactions: _currentReactions,
}: {
  groupId: string;
  messageId: string;
  emoji: string;
  userId: string;
  currentReactions: Record<string, string[]>;
}): Promise<void> {
  const path = `${messagesPath(groupId)}/${messageId}`;
  await runTransaction(dbRef(rtdb, path), (current) => {
    if (current === null || current === undefined) return;
    const row = current as Record<string, unknown>;
    const reactionsRaw = row.reactions;
    const reactions: Record<string, string[]> = {};
    if (
      reactionsRaw &&
      typeof reactionsRaw === 'object' &&
      !Array.isArray(reactionsRaw)
    ) {
      for (const [k, v] of Object.entries(
        reactionsRaw as Record<string, unknown>
      )) {
        if (Array.isArray(v))
          reactions[k] = v.filter((u): u is string => typeof u === 'string');
      }
    }
    const list = [...(reactions[emoji] ?? [])];
    const idx = list.indexOf(userId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(userId);
    if (list.length === 0) delete reactions[emoji];
    else reactions[emoji] = list;
    return { ...row, reactions };
  });
}

/** Send a system message (membership events, etc.) */
export async function sendSystemMessage(
  groupId: string,
  text: string
): Promise<void> {
  const msgRef = push(dbRef(rtdb, messagesPath(groupId)));
  await set(msgRef, {
    senderId: 'system',
    type: 'system',
    systemText: text,
    keyVersion: 0,
    sentAt: serverTimestamp(),
    readBy: [],
  });
}
