import '../../global.css';

import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: 'white' }} />;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'red',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: 'white', fontSize: 28, fontWeight: '700' }}>
        ROOT WORKS
      </Text>
    </View>
  );
}
