import { useQuery } from '@tanstack/react-query';

import { checkUserExistsInFirestore } from '@/api/people/user-api';

export function useUserExistsInFirestore(userId: string | null): {
  exists: boolean | undefined;
  isChecking: boolean;
  hasError: boolean;
} {
  const isEnabled = Boolean(userId) && userId !== 'guest_user';

  const { data, isLoading, isError } = useQuery({
    queryKey: ['userExists', userId],
    queryFn: async () => {
      if (!userId) return false;
      return await checkUserExistsInFirestore(userId);
    },
    enabled: isEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  return {
    exists: userId === 'guest_user' ? true : data,
    isChecking: isEnabled ? isLoading : false,
    hasError: isEnabled ? isError : false,
  };
}
