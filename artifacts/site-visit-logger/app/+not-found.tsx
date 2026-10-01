import { Stack, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useColors } from '@/hooks/useColors';

export default function NotFoundScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: 'Not found', headerShown: false }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="compass"
          title="This page does not exist"
          text="The link may be old or mistyped. Head back home to carry on."
        />
        <Button label="Go to home" onPress={() => router.replace('/')} testID="not-found-home-button" style={styles.action} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  action: { marginTop: 16 },
});
