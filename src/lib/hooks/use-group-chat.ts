import { useCallback, useEffect, useState } from 'react';

import {
  ensureIdentityKeyPair,
  initGroupKey,
  resolveGroupKey,
} from '@/api/chat/key-api';
import type { UseMessagesResult } from '@/api/chat/messages';
import { sendTextMessage, useMessages } from '@/api/chat/messages';
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

  // Initialize identity key + resolve group key
  useEffect(() => {
    if (!userId || !groupId) return;
    let cancelled = false;
    setEncryptionError(null);

    async function init() {
      await ensureIdentityKeyPair(userId!);
      let key = await resolveGroupKey(groupId!, userId!);

      if (!key && memberIds.length > 0) {
        // initGroupKey returns the plaintext key directly — no second read needed
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
  }, [groupId, userId, memberIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Decrypt messages whenever raw messages or group key changes (synchronous)
  useEffect(() => {
    if (!groupKey || rawMessages.length === 0) {
      setMessages(rawMessages);
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
