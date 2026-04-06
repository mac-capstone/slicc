import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { checkUserExistsInFirestore } from '@/api/people/user-api';

export function useUserExistsInFirestore(userId: string | null): {
  exists: boolean | undefined;
  isChecking: boolean;
  hasError: boolean;
} {
  const {
    data: exists,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ['userExists', userId],
    queryFn: () => checkUserExistsInFirestore(userId!),
    enabled: Boolean(userId) && userId !== 'guest_user',
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  useEffect(() => {
    if (!userId || userId === 'guest_user') {
      return;
    }

    console.log('[useUserExistsInFirestore] state', {
      userId,
      exists,
      isLoading,
      isFetching,
      isError,
      error: error instanceof Error ? error.message : error,
    });
  }, [error, exists, isError, isFetching, isLoading, userId]);

  return {
    exists: userId === 'guest_user' ? true : exists,
    isChecking:
      Boolean(userId) && userId !== 'guest_user' && (isLoading || isFetching),
    hasError: Boolean(userId) && userId !== 'guest_user' && isError,
  };
}
