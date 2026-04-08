import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createQuery } from 'react-query-kit';

import { db } from '@/api/common/firebase';
import type { Group, GroupIdT, GroupWithId, UserIdT } from '@/types';
import { groupConverter } from '@/types/schema';

type CreateGroupData = Omit<Group, 'createdAt' | 'updatedAt'> & {
  createdAt?: ReturnType<typeof Timestamp.now>;
  updatedAt?: ReturnType<typeof Timestamp.now>;
};

const groupsRef = collection(db, 'groups').withConverter(groupConverter);

export async function fetchGroup(groupId: GroupIdT): Promise<GroupWithId> {
  const groupRef = doc(groupsRef, groupId);
  const groupSnap = await getDoc(groupRef);

  if (!groupSnap.exists()) {
    throw new Error('Group not found');
  }

  try {
    const group = groupSnap.data();
    return { id: groupSnap.id as GroupIdT, ...group };
  } catch (err) {
    console.error('Invalid group structure:', err);
    throw new Error('Unable to load group data.');
  }
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
    if (!userId) return [];
    const q = query(groupsRef, where('members', 'array-contains', userId));
    const snapshot = await getDocs(q);
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

  return useMutation<GroupWithId, Error, CreateGroupVariables>({
    mutationFn: async ({ groupId, data }: CreateGroupVariables) => {
      const now = Timestamp.now();
      const dataToWrite = {
        ...data,
        createdAt: data.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      };
      const groupRef = doc(groupsRef, groupId);
      await setDoc(groupRef, dataToWrite);
      return {
        id: groupId,
        ...dataToWrite,
        createdAt: dataToWrite.createdAt.toDate(),
        updatedAt: dataToWrite.updatedAt.toDate(),
      } as GroupWithId;
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

  return useMutation<GroupWithId, Error, UpdateGroupVariables>({
    mutationFn: async ({ groupId, data }: UpdateGroupVariables) => {
      const groupRef = doc(groupsRef, groupId);
      await updateDoc(groupRef, { ...data, updatedAt: Timestamp.now() });
      return fetchGroup(groupId);
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

  return useMutation<void, Error, LeaveGroupVariables>({
    mutationFn: async ({ groupId, userId }: LeaveGroupVariables) => {
      const groupRef = doc(groupsRef, groupId);

      await runTransaction(db, async (transaction) => {
        const groupSnap = await transaction.get(groupRef);

        if (!groupSnap.exists()) {
          throw new Error('Group not found');
        }

        let groupData: Group;
        try {
          groupData = groupSnap.data();
        } catch (err) {
          console.error('Invalid group structure:', err);
          throw new Error('Unable to load group data.');
        }

        const newMembers = groupData.members.filter((id) => id !== userId);

        if (newMembers.length === groupData.members.length) {
          return; // User was not in the group
        }

        if (newMembers.length === 0) {
          transaction.delete(groupRef);
          return;
        }

        const updates: Partial<Group> = { members: newMembers };

        if (groupData.owner === userId) {
          const newOwner = newMembers[0];
          updates.owner = newOwner;
          updates.admins = groupData.admins.filter((id) => id !== userId);
          if (!updates.admins.includes(newOwner)) {
            updates.admins = [newOwner, ...updates.admins];
          }
        } else if (groupData.admins.includes(userId)) {
          updates.admins = groupData.admins.filter((id) => id !== userId);
        }

        transaction.update(groupRef, {
          ...updates,
          updatedAt: Timestamp.now(),
        });
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['groups', 'groupId', variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};

type DeleteGroupVariables = {
  groupId: GroupIdT;
};

export const useDeleteGroup = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteGroupVariables>({
    mutationFn: async ({ groupId }: DeleteGroupVariables) => {
      const groupRef = doc(groupsRef, groupId);
      await deleteDoc(groupRef);
    },
    onSuccess: (_, variables) => {
      queryClient.removeQueries({
        queryKey: ['groups', 'groupId', variables.groupId],
      });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({
        queryKey: ['events', 'groupId', variables.groupId],
      });
    },
  });
};
