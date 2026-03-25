/**
 * SendToChat -- explore page uses this to share a discovered spot to a group chat.
 *
 * EXPLORE PAGE CONTRACT:
 *   import { SendToChat } from '@/components/chat/send-to-chat';
 *   import type { LocationShare } from '@/types';
 *
 *   // When user taps "Send to chat" on a place:
 *   <SendToChat location={locationShare} onDismiss={() => setTarget(null)} />
 *
 *   LocationShare shape (what explore page should populate):
 *   {
 *     name: string;          // "The Keg Steakhouse"
 *     address: string;       // "123 Front St W, Toronto, ON"
 *     coordinates: { lat: number; lng: number };
 *     mapsUrl: string;       // "https://maps.google.com/?q=..."
 *     category?: string;     // "Restaurant" | "Bar" | etc.
 *     imageUrl?: string;
 *     rating?: number;       // 0–5
 *     priceLevel?: string;   // "$" | "$$" | "$$$"
 *   }
 */
import Octicons from '@expo/vector-icons/Octicons';
import * as React from 'react';
import { useState } from 'react';
import { ActivityIndicator, Modal, TouchableOpacity, View } from 'react-native';

import { sendLocationMessage } from '@/api/chat/messages';
import { fetchGroup, useGroupIds } from '@/api/groups/use-groups';
import { colors, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { GroupIdT, LocationShare, UserIdT } from '@/types';

import { LocationCard } from './location-card';

type Props = {
  location: LocationShare;
  onDismiss: () => void;
};

export function SendToChat({ location, onDismiss }: Props) {
  const userId = useAuth.use.userId() as UserIdT;
  const { data: groupIds = [] } = useGroupIds({ variables: userId as UserIdT });
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const handleSend = async (groupId: GroupIdT) => {
    if (sending) return;
    setSending(groupId);
    try {
      await sendLocationMessage(groupId, userId, location);
      setSent(groupId);
      setTimeout(onDismiss, 900);
    } catch {
      // Reset state so user can retry
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-3xl bg-background-925 px-4 pb-10 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-base font-bold text-text-50">
              Send to Group
            </Text>
            <TouchableOpacity onPress={onDismiss} accessibilityRole="button">
              <Octicons name="x" size={20} color={colors.text[800]} />
            </TouchableOpacity>
          </View>

          <View className="mb-4">
            <LocationCard location={location} />
          </View>

          {groupIds.length === 0 ? (
            <Text className="text-center text-sm text-text-800">
              No groups yet. Create one first.
            </Text>
          ) : (
            groupIds.map((id) => (
              <GroupRow
                key={id}
                groupId={id as GroupIdT}
                isSending={sending === id}
                wasSent={sent === id}
                onSend={handleSend}
              />
            ))
          )}
        </View>
      </View>
    </Modal>
  );
}

type GroupRowProps = {
  groupId: GroupIdT;
  isSending: boolean;
  wasSent: boolean;
  onSend: (id: GroupIdT) => void;
};

function GroupRow({ groupId, isSending, wasSent, onSend }: GroupRowProps) {
  const [name, setName] = React.useState<string>('...');

  React.useEffect(() => {
    fetchGroup(groupId).then((g) => setName(g.name));
  }, [groupId]);

  return (
    <TouchableOpacity
      onPress={() => onSend(groupId)}
      disabled={isSending || wasSent}
      className="mb-2 flex-row items-center justify-between rounded-xl bg-background-900 px-4 py-3"
    >
      <View className="flex-row items-center gap-3">
        <Octicons name="people" size={18} color={colors.text[800]} />
        <Text className="text-sm font-medium text-text-50">{name}</Text>
      </View>
      {isSending ? (
        <ActivityIndicator size="small" color={colors.accent[100]} />
      ) : wasSent ? (
        <Octicons name="check-circle" size={18} color={colors.accent[100]} />
      ) : (
        <Octicons name="paper-airplane" size={16} color={colors.accent[100]} />
      )}
    </TouchableOpacity>
  );
}
