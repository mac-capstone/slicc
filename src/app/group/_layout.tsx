import { Stack } from 'expo-router';

export default function GroupLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
      <Stack.Screen name="[id]/members" options={{ headerShown: false }} />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
    </Stack>
  );
}
