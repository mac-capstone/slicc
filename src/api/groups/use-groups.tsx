import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import type { Group, GroupIdT, GroupWithId, UserIdT } from '@/types';
import { groupConverter, groupSchema } from '@/types/schema';

type CreateGroupData = Omit<Group, 'createdAt' | 'updatedAt'> & {
  createdAt?: ReturnType<typeof Timestamp.now>;
  updatedAt?: ReturnType<typeof Timestamp.now>;
};

const groupsRef = collection(db, 'groups').withConverter(groupConverter);

export async function fetchGroup(groupId: GroupIdT): Promise<GroupWithId> {
  // Use raw ref (no converter) so we get Firestore Timestamps for parsing
  const rawRef = doc(db, 'groups', groupId);
  const groupSnap = await getDoc(rawRef);

  if (!groupSnap.exists()) {
    throw new Error('Group not found');
  }

  const rawData = groupSnap.data();
  const parsedGroup = groupSchema.safeParse(rawData);
  if (!parsedGroup.success) {
    console.error('Invalid group structure:', parsedGroup.error.flatten());
    throw new Error('Unable to load group data.');
  }
  const validatedGroup = parsedGroup.data;

  return { id: groupSnap.id as GroupIdT, ...validatedGroup } as GroupWithId;
}

type GroupIdsResponse = GroupIdT[];
type GroupIdsVariables = UserIdT | null;

export const useGroupIds = createQuery<
  GroupIdsResponse,
  GroupIdsVariables,
  Error
>({
  queryKey: ['groups', 'userId'],
  fetcher: async (userId) => {
    if (userId) {
      const q = query(groupsRef, where('members', 'array-contains', userId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => d.id as GroupIdT);
    }
    const snapshot = await getDocs(groupsRef);
    return snapshot.docs.map((d) => d.id as GroupIdT);
  },
});

export const useGroup = createQuery<GroupWithId, GroupIdT, Error>({
  queryKey: ['groups', 'groupId'],
  fetcher: fetchGroup,
});

type CreateGroupVariables = {
  groupId: GroupIdT;
  data: CreateGroupData;
};

export const useCreateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, data }: CreateGroupVariables) => {
      const groupRef = doc(groupsRef, groupId);
      await setDoc(groupRef, data);
      return { id: groupId, ...data } as GroupWithId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};

type UpdateGroupVariables = {
  groupId: GroupIdT;
  data: Partial<Group>;
};

export const useUpdateGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, data }: UpdateGroupVariables) => {
      const groupRef = doc(groupsRef, groupId);
      await updateDoc(groupRef, data);
      const rawRef = doc(db, 'groups', groupId);
      const updatedSnap = await getDoc(rawRef);
      const parsedGroup = groupSchema.parse(updatedSnap.data());
      return { id: groupId, ...parsedGroup } as GroupWithId;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['groups', 'groupId', variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};

type LeaveGroupVariables = {
  groupId: GroupIdT;
  userId: UserIdT;
};

export const useLeaveGroup = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, userId }: LeaveGroupVariables) => {
      const rawRef = doc(db, 'groups', groupId);
      const groupSnap = await getDoc(rawRef);

      if (!groupSnap.exists()) {
        throw new Error('Group not found');
      }

      const groupData = groupSchema.parse(groupSnap.data());
      const newMembers = groupData.members.filter((id) => id !== userId);

      if (newMembers.length === groupData.members.length) {
        return; // User was not in the group
      }

      const updates: Partial<Group> = { members: newMembers };
      const now = Timestamp.now();

      if (groupData.owner === userId) {
        const newOwner = newMembers[0] ?? null;
        updates.owner = newOwner ?? '';
        updates.admins = groupData.admins.filter((id) => id !== userId);
        if (newOwner && !updates.admins?.includes(newOwner)) {
          updates.admins = [newOwner, ...(updates.admins ?? [])];
        }
      } else if (groupData.admins.includes(userId)) {
        updates.admins = groupData.admins.filter((id) => id !== userId);
      }

      const groupRef = doc(groupsRef, groupId);
      await updateDoc(groupRef, { ...updates, updatedAt: now });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['groups', 'groupId', variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
