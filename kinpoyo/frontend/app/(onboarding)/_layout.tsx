import { Stack } from 'expo-router';

export const unstable_settings = {
  anchor: 'gender',
};

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="gender" />
      <Stack.Screen name="height" />
      <Stack.Screen name="weight" />
      <Stack.Screen name="weight-goal" />
      <Stack.Screen name="year" />
      <Stack.Screen name="train-goal" />
    </Stack>
  );
}
