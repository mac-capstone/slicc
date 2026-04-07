import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Best-effort online check. `isInternetReachable` may be null until the OS probes.
 */
export async function fetchIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isOnlineFromState(state);
}

export function isOnlineFromState(state: NetInfoState): boolean {
  if (state.isConnected !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function subscribeReachability(
  onChange: (online: boolean) => void
): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(isOnlineFromState(state));
  });
}
