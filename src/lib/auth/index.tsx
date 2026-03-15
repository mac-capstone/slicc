import { create } from 'zustand';

import { type UserIdT } from '@/types';

import { createSelectors } from '../utils';
import { googleSignOut, signInWithGoogle } from './google-auth';
import type { TokenType } from './utils';
import {
  getToken,
  getUserIdFromStorage,
  removeToken,
  removeUserIdFromStorage,
  setToken,
  setUserIdInStorage,
} from './utils';

type SignInData = {
  token: TokenType;
  userId: string;
};

interface AuthState {
  userId: UserIdT | null;
  token: TokenType | null;
  status: 'idle' | 'signOut' | 'signIn';
  signIn: (data: SignInData) => void;
  googleSignIn: () => Promise<void>;
  signOut: () => void;
  hydrate: () => void;
}

const _useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  userId: null,
  token: null,
  signIn: ({ token, userId }) => {
    setToken(token);
    setUserIdInStorage(userId);
    set({ status: 'signIn', token, userId: userId as UserIdT });
  },
  googleSignIn: async () => {
    const result = await signInWithGoogle();
    get().signIn({
      token: { access: result.idToken, refresh: '' },
      userId: result.uid,
    });
  },
  signOut: () => {
    const wasSignedIn = get().status === 'signIn';
    removeToken();
    removeUserIdFromStorage();
    set({ status: 'signOut', token: null, userId: null });
    if (wasSignedIn) {
      googleSignOut().catch(() => {});
    }
  },
  hydrate: () => {
    try {
      const userToken = getToken();
      const userId = getUserIdFromStorage();
      if (userToken !== null && userId !== null) {
        get().signIn({ token: userToken, userId });
      } else {
        set({ status: 'signOut', token: null, userId: null });
      }
    } catch (e) {
      console.error(e);
    }
  },
}));

export const useAuth = createSelectors(_useAuth);

export const getUserId = (): UserIdT => _useAuth.getState().userId as UserIdT;
export const signOut = (): void => _useAuth.getState().signOut();
export const signIn = (data: SignInData): void =>
  _useAuth.getState().signIn(data);
export const hydrateAuth = (): void => _useAuth.getState().hydrate();
