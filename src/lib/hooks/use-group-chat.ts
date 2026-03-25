import { doc, onSnapshot } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import {
  ensureIdentityKeyPair,
  ensureKeyBundlesForMissingMembers,
  initGroupKey,
  resolveGroupKey,
} from '@/api/chat/key-api';
import type { UseMessagesResult } from '@/api/chat/messages';
import { sendTextMessage, useMessages } from '@/api/chat/messages';
import { db } from '@/api/common/firebase';
import { decryptMessage } from '@/lib/crypto/e2e-crypto';
import type { ChatMessageWithId, GroupIdT, UserIdT } from '@/types';

type UseChatResult = {
  messages: ChatMessageWithId[];
  isLoading: boolean;
  isLoadingMore: UseMessagesResult['isLoadingMore'];
  hasMore: UseMessagesResult['hasMore'];
  loadMore: UseMessagesResult['loadMore'];
  isSending: boolean;
  encryptionReady: boolean;
  send: (text: string) => Promise<void>;
};

/**
 * Orchestrates the full E2E encrypted group chat lifecycle:
 * key initialization -> real-time messages -> async decryption -> send.
 */
export function useGroupChat(
  groupId: GroupIdT | null,
  userId: UserIdT | null,
  memberIds: string[]
): UseChatResult {
  const {
    messages: rawMessages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useMessages(groupId);
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);
  const [_encryptionError, setEncryptionError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<ChatMessageWithId[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Drop key/messages when switching chat or user so we never decrypt with the wrong key.
  useEffect(() => {
    if (!groupId || !userId) {
      setGroupKey(null);
      setEncryptionReady(false);
      setMessages([]);
      return;
    }
    setGroupKey(null);
    setEncryptionReady(false);
    setMessages([]);
  }, [groupId, userId]);

  // Initialize identity key + resolve group key
  useEffect(() => {
    if (!userId || !groupId) return;
    let cancelled = false;
    setEncryptionError(null);

    async function init() {
      await ensureIdentityKeyPair(userId!);
      let key = await resolveGroupKey(groupId!, userId!);

      if (key && memberIds.length > 0) {
        try {
          await ensureKeyBundlesForMissingMembers({
            groupId: groupId!,
            memberIds,
            initiatorUserId: userId!,
            groupKeyPlaintext: key,
          });
        } catch (e) {
          console.error('ensureKeyBundlesForMissingMembers failed:', e);
        }
      } else if (!key && memberIds.length > 0) {
        key = await initGroupKey(groupId!, memberIds, userId!);
      }

      if (!cancelled) {
        setGroupKey(key);
        setEncryptionReady(true);
      }
    }

    init().catch((err) => {
      console.error('Encryption init failed:', err);
      if (!cancelled) setEncryptionError(err);
    });

    return () => {
      cancelled = true;
    };
  }, [groupId, userId, memberIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Pick up a key bundle written later (e.g. another member added your bundle). */
  useEffect(() => {
    if (!groupId || !userId) return;
    if (groupKey) return;

    let cancelled = false;
    const ref = doc(db, 'groups', groupId, 'keyBundles', userId);
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists() || cancelled) return;
      const next = await resolveGroupKey(groupId, userId);
      if (next && !cancelled) setGroupKey(next);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [groupId, userId, groupKey]);

  // Decrypt messages whenever raw messages or group key changes (synchronous)
  useEffect(() => {
    if (rawMessages.length === 0) {
      setMessages([]);
      return;
    }

    if (!groupKey) {
      setMessages((prev) => {
        const prevById = new Map(prev.map((m) => [m.id, m]));
        return rawMessages.map((msg) => {
          const prior = prevById.get(msg.id);
          if (
            prior?.decryptedContent != null &&
            msg.type === 'text' &&
            msg.encryptedContent
          ) {
            return { ...msg, decryptedContent: prior.decryptedContent };
          }
          return msg;
        });
      });
      return;
    }

    const decrypted = rawMessages.map((msg) => {
      if (msg.type !== 'text' || !msg.encryptedContent || !msg.nonce) {
        return { ...msg, decryptedContent: msg.systemText ?? null };
      }
      let content: string | null = null;
      try {
        content = decryptMessage(msg.encryptedContent, msg.nonce, groupKey);
      } catch {
        content = null;
      }
      return { ...msg, decryptedContent: content };
    });

    setMessages(decrypted);
  }, [rawMessages, groupKey]);

  const send = useCallback(
    async (text: string) => {
      if (!groupId || !userId || !groupKey) return;
      setIsSending(true);
      await sendTextMessage({
        groupId,
        senderId: userId,
        plaintext: text,
        groupKey,
      }).finally(() => setIsSending(false));
    },
    [groupId, userId, groupKey]
  );

  return {
    messages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    isSending,
    encryptionReady,
    send,
  };
}
