import { useQuery } from '@tanstack/react-query';

import { checkUserExistsInFirestore } from '@/api/people/user-api';

export function useUserExistsInFirestore(userId: string | null): {
  exists: boolean | undefined;
  isLoading: boolean;
} {
  const { data: exists, isLoading } = useQuery({
    queryKey: ['userExists', userId],
    queryFn: () => checkUserExistsInFirestore(userId!),
    enabled: Boolean(userId) && userId !== 'guest_user',
    staleTime: 5 * 60 * 1000,
  });

  return {
    exists: userId === 'guest_user' ? true : exists,
    isLoading: Boolean(userId) && userId !== 'guest_user' && isLoading,
  };
}
