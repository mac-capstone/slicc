import { Stack } from 'expo-router';

export default function GroupLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" />
      <Stack.Screen
        name="[id]/members"
        options={{
          headerShown: true,
          headerTitleStyle: { fontSize: 28, fontWeight: 'bold' },
          headerShadowVisible: false,
        }}
      />
      <Stack.Screen name="edit" options={{ headerShown: false }} />
      {/* <Stack.Screen name="create-group" options={{ headerShown: false }} /> */}
    </Stack>
  );
}
