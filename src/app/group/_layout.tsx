import { Stack } from 'expo-router';

export default function GroupLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
      {/* <Stack.Screen name="create-group" options={{ headerShown: false }} /> */}
    </Stack>
  );
}
