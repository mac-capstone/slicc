import { Stack } from 'expo-router';

import { SettingsScreenContent } from '@/components/settings/settings-screen-content';
import { FocusAwareStatusBar, SafeAreaView, ScrollView } from '@/components/ui';
import { useAuth } from '@/lib';
import { useSettingsScreen } from '@/lib/hooks/use-settings-screen';

export default function Settings() {
  const signOut = useAuth.use.signOut();
  const screen = useSettingsScreen();

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <SafeAreaView className="flex-1 bg-background-950" edges={['top']}>
        <ScrollView
          className="flex-1 bg-background-950"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <SettingsScreenContent signOut={signOut} {...screen} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
