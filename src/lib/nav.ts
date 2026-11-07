import { router } from 'expo-router';

/** Back if there is history (deep links / web reloads may have none), otherwise home. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
