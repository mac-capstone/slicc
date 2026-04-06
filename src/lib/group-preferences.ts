import { create } from 'zustand';

import { getItem, setItem } from './storage';
import { createSelectors } from './utils';

const GROUP_PREFERENCES_KEY = 'group_preferences';

type GroupPreferencesData = {
  pinnedGroupIds: string[];
  unreadGroupIds: string[];
};

function loadPreferences(): GroupPreferencesData {
  const saved = getItem<GroupPreferencesData>(GROUP_PREFERENCES_KEY);
  return saved ?? { pinnedGroupIds: [], unreadGroupIds: [] };
}

function savePreferences(data: GroupPreferencesData): void {
  setItem(GROUP_PREFERENCES_KEY, data);
}

interface GroupPreferencesState extends GroupPreferencesData {
  togglePin: (groupId: string) => void;
  markAsRead: (groupId: string) => void;
  setUnread: (groupId: string) => void;
  isPinned: (groupId: string) => boolean;
  hasUnread: (groupId: string) => boolean;
  hydrate: () => void;
}

const _useGroupPreferences = create<GroupPreferencesState>((set, get) => ({
  pinnedGroupIds: [],
  unreadGroupIds: [],

  hydrate: () => {
    const loaded = loadPreferences();
    set({
      pinnedGroupIds: Array.isArray(loaded.pinnedGroupIds)
        ? loaded.pinnedGroupIds
        : [],
      unreadGroupIds: Array.isArray(loaded.unreadGroupIds)
        ? loaded.unreadGroupIds
        : [],
    });
  },

  togglePin: (groupId) => {
    const { pinnedGroupIds } = get();
    const next = pinnedGroupIds.includes(groupId)
      ? pinnedGroupIds.filter((id) => id !== groupId)
      : [...pinnedGroupIds, groupId];
    set({ pinnedGroupIds: next });
    savePreferences({ ...get(), pinnedGroupIds: next });
  },

  markAsRead: (groupId) => {
    const { unreadGroupIds } = get();
    const next = unreadGroupIds.filter((id) => id !== groupId);
    if (next.length === unreadGroupIds.length) return;
    set({ unreadGroupIds: next });
    savePreferences({ ...get(), unreadGroupIds: next });
  },

  setUnread: (groupId) => {
    const { unreadGroupIds } = get();
    if (unreadGroupIds.includes(groupId)) return;
    const next = [...unreadGroupIds, groupId];
    set({ unreadGroupIds: next });
    savePreferences({ ...get(), unreadGroupIds: next });
  },

  isPinned: (groupId) => get().pinnedGroupIds.includes(groupId),

  hasUnread: (groupId) => get().unreadGroupIds.includes(groupId),
}));

export const useGroupPreferences = createSelectors(_useGroupPreferences);

export const hydrateGroupPreferences = () =>
  _useGroupPreferences.getState().hydrate();
export const toggleGroupPin = (groupId: string) =>
  _useGroupPreferences.getState().togglePin(groupId);
export const markGroupAsRead = (groupId: string) =>
  _useGroupPreferences.getState().markAsRead(groupId);
export const setGroupUnread = (groupId: string) =>
  _useGroupPreferences.getState().setUnread(groupId);
