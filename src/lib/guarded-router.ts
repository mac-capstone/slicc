import {
  type Href,
  type Router,
  router as expoRouter,
  usePathname,
  useRouter as useExpoRouter,
} from 'expo-router';
import { useEffect, useMemo } from 'react';

const ROUTER_GUARD_WINDOW_MS = 700;

type GuardedAction = 'push' | 'replace' | 'navigate' | 'back' | 'dismissTo';

type LastNavigationAttempt = {
  key: string;
  timestamp: number;
};

type GuardedRouterState = {
  lastNavigationAttempt: LastNavigationAttempt | null;
  clearAttemptTimeout: ReturnType<typeof setTimeout> | null;
};

type GuardedRouter = Router & {
  resetNavigationAttempt: () => void;
};

const normalizePath = (path: string): string => {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }

  return path;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hrefToKey = (href: Href): string => {
  if (typeof href === 'string') {
    return normalizePath(href);
  }

  if (!isRecord(href)) {
    return '';
  }

  const pathname =
    typeof href.pathname === 'string' ? normalizePath(href.pathname) : '';
  const params = isRecord(href.params) ? href.params : null;

  if (!params) {
    return pathname;
  }

  const query = Object.keys(params)
    .sort()
    .flatMap((key) => {
      const value = params[key];

      if (value === undefined || value === null) {
        return [];
      }

      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    })
    .join('&');

  if (!query) {
    return pathname;
  }

  return `${pathname}?${query}`;
};

const clearNavigationAttempt = (state: GuardedRouterState): void => {
  state.lastNavigationAttempt = null;

  if (state.clearAttemptTimeout) {
    clearTimeout(state.clearAttemptTimeout);
    state.clearAttemptTimeout = null;
  }
};

const shouldSkipAction = (state: GuardedRouterState, key: string): boolean => {
  const now = Date.now();

  if (
    state.lastNavigationAttempt?.key === key &&
    now - state.lastNavigationAttempt.timestamp < ROUTER_GUARD_WINDOW_MS
  ) {
    return true;
  }

  state.lastNavigationAttempt = {
    key,
    timestamp: now,
  };

  if (state.clearAttemptTimeout) {
    clearTimeout(state.clearAttemptTimeout);
  }

  state.clearAttemptTimeout = setTimeout(() => {
    state.lastNavigationAttempt = null;
    state.clearAttemptTimeout = null;
  }, ROUTER_GUARD_WINDOW_MS);

  return false;
};

const shouldSkipRouteChange = (
  state: GuardedRouterState,
  action: GuardedAction,
  href: Href
): boolean => {
  return shouldSkipAction(state, `${action}:${hrefToKey(href)}`);
};

const createGuardedRouter = (baseRouter: Router): GuardedRouter => {
  const state: GuardedRouterState = {
    lastNavigationAttempt: null,
    clearAttemptTimeout: null,
  };

  return {
    ...baseRouter,
    resetNavigationAttempt() {
      clearNavigationAttempt(state);
    },
    push(...args: Parameters<Router['push']>) {
      if (shouldSkipRouteChange(state, 'push', args[0])) {
        return;
      }

      try {
        baseRouter.push(...args);
      } catch (error) {
        clearNavigationAttempt(state);
        throw error;
      }
    },
    replace(...args: Parameters<Router['replace']>) {
      if (shouldSkipRouteChange(state, 'replace', args[0])) {
        return;
      }

      try {
        baseRouter.replace(...args);
      } catch (error) {
        clearNavigationAttempt(state);
        throw error;
      }
    },
    navigate(...args: Parameters<Router['navigate']>) {
      if (shouldSkipRouteChange(state, 'navigate', args[0])) {
        return;
      }

      try {
        baseRouter.navigate(...args);
      } catch (error) {
        clearNavigationAttempt(state);
        throw error;
      }
    },
    back(...args: Parameters<Router['back']>) {
      if (shouldSkipAction(state, 'back')) {
        return;
      }

      try {
        baseRouter.back(...args);
      } catch (error) {
        clearNavigationAttempt(state);
        throw error;
      }
    },
    dismissTo(...args: Parameters<Router['dismissTo']>) {
      if (shouldSkipRouteChange(state, 'dismissTo', args[0])) {
        return;
      }

      try {
        baseRouter.dismissTo(...args);
      } catch (error) {
        clearNavigationAttempt(state);
        throw error;
      }
    },
  };
};

export * from 'expo-router';

export const router = createGuardedRouter(expoRouter);

export const useRouter = (): Router => {
  const baseRouter = useExpoRouter();
  const pathname = usePathname();

  const guardedRouter = useMemo(
    () => createGuardedRouter(baseRouter),
    [baseRouter]
  );

  useEffect(() => {
    guardedRouter.resetNavigationAttempt();
  }, [guardedRouter, pathname]);

  useEffect(() => {
    return () => {
      guardedRouter.resetNavigationAttempt();
    };
  }, [guardedRouter]);

  return guardedRouter;
};
