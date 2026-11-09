import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ThemedText } from './themed-text';

/**
 * Modal bottom sheet: scrim, 28 px top radius, 40 × 5 grabber, optional title. Tapping the scrim or
 * the hardware back button closes it. Content scrolls when taller than 85 % of the screen.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  closeLabel = 'Zavrieť',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  closeLabel?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} style={[styles.fill, { backgroundColor: theme.scrim }]} onPress={onClose} />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: Math.max(insets.bottom, 16) + Spacing.two }]}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          {title ? (
            <ThemedText type="cardTitleL" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    maxHeight: '85%',
    alignSelf: 'center',
    borderTopLeftRadius: Radius.sheetTop,
    borderTopRightRadius: Radius.sheetTop,
    paddingHorizontal: Layout.screenPaddingX + 4,
    paddingTop: 10,
  },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 14 },
  title: { marginBottom: Spacing.two },
  body: { gap: Spacing.three, paddingBottom: Spacing.two },
});
