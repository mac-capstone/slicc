import { getItem, removeItem, setItem } from '@/lib/storage';

const TOKEN = 'token';
const USER_ID = 'userId';

export type TokenType = {
  access: string;
  refresh: string;
};

export const getToken = (): TokenType | null => getItem<TokenType>(TOKEN);
export const removeToken = (): void => removeItem(TOKEN);
export const setToken = (value: TokenType): void =>
  setItem<TokenType>(TOKEN, value);

export const getUserIdFromStorage = (): string | null =>
  getItem<string>(USER_ID);
export const setUserIdInStorage = (value: string): void =>
  setItem<string>(USER_ID, value);
export const removeUserIdFromStorage = (): void => removeItem(USER_ID);
