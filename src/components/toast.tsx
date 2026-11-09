import { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { BottomTabInset, FontFamily, Layout, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { dismissToast, getToast, subscribeToast } from '@/lib/toast-store';

import { ThemedText } from './themed-text';

/**
 * Global toast host, mounted once in the root layout. 12 px from the edges, 96 px above the bottom
 * (just above the tab bar), ink fill, optional "Späť" action, auto-dismiss after 3.8 s.
 */
export function ToastHost() {
  const theme = useTheme();
  const current = useSyncExternalStore(subscribeToast, getToast, getToast);
  const [opacity] = useState(() => new Animated.Value(0));
  const id = current?.id;
  const duration = current?.durationMs;

  useEffect(() => {
    if (id == null || duration == null) return;
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(() => dismissToast(id), duration);
    return () => {
      clearTimeout(timer);
      opacity.setValue(0);
    };
  }, [id, duration, opacity]);

  if (!current) return null;
  const { undo } = current;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: BottomTabInset + 12 }]}>
      <Animated.View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          Shadow.toast,
          { backgroundColor: theme.ink, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
        ]}>
        <ThemedText type="bodySmall" style={[styles.msg, { color: theme.onInk, fontFamily: FontFamily[700] }]}>
          {current.message}
        </ThemedText>
        {undo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Späť"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.undo}
            onPress={() => {
              dismissToast(current.id);
              void undo();
            }}>
            <ThemedText type="bodySmall" style={{ color: theme.toastAction, fontFamily: FontFamily[800] }}>
              Späť
            </ThemedText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    minHeight: 52,
    borderRadius: Radius.toast,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 8,
  },
  msg: { flex: 1 },
  undo: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
});
