/**
 * V&V §6.2.1 — group UI preferences (pinned groups, unread) backed by storage.
 */
import {
  hydrateGroupPreferences,
  markGroupAsRead,
  setGroupUnread,
  toggleGroupPin,
  useGroupPreferences,
} from '@/lib/group-preferences';
import * as storage from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('group-preferences (pinned groups / unread)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorage.getItem.mockReturnValue(undefined);
    useGroupPreferences.setState({
      pinnedGroupIds: [],
      unreadGroupIds: [],
    });
  });

  it('hydrate loads saved ids from storage', () => {
    mockedStorage.getItem.mockReturnValue({
      pinnedGroupIds: ['g1'],
      unreadGroupIds: ['g2'],
    });
    hydrateGroupPreferences();
    const s = useGroupPreferences.getState();
    expect(s.pinnedGroupIds).toEqual(['g1']);
    expect(s.unreadGroupIds).toEqual(['g2']);
  });

  it('hydrate tolerates missing or invalid saved shape', () => {
    mockedStorage.getItem.mockReturnValue(null);
    hydrateGroupPreferences();
    expect(useGroupPreferences.getState().pinnedGroupIds).toEqual([]);
  });

  it('toggleGroupPin adds, removes, and persists', () => {
    toggleGroupPin('a');
    expect(useGroupPreferences.getState().pinnedGroupIds).toEqual(['a']);
    toggleGroupPin('a');
    expect(useGroupPreferences.getState().pinnedGroupIds).toEqual([]);
    expect(mockedStorage.setItem).toHaveBeenCalled();
  });

  it('setUnread / markAsRead track per-group state', () => {
    setGroupUnread('x');
    expect(useGroupPreferences.getState().hasUnread('x')).toBe(true);
    markGroupAsRead('x');
    expect(useGroupPreferences.getState().hasUnread('x')).toBe(false);
  });

  it('markAsRead is a no-op when id was not unread', () => {
    setGroupUnread('y');
    const callsBefore = mockedStorage.setItem.mock.calls.length;
    markGroupAsRead('z');
    expect(mockedStorage.setItem.mock.calls.length).toBe(callsBefore);
  });
});
