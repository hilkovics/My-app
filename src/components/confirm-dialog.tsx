import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { answerConfirm, getConfirm, subscribeConfirm } from '@/lib/confirm';

import { ThemedText } from './themed-text';
import { Button } from './ui';

/** Host for `confirm()`: centred dialog with Zrušiť and the confirming button (danger when destructive). */
export function ConfirmDialogHost() {
  const theme = useTheme();
  const req = useSyncExternalStore(subscribeConfirm, getConfirm, getConfirm);
  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => answerConfirm(false)} statusBarTranslucent>
      <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
        <Pressable accessibilityLabel="Zrušiť" style={StyleSheet.absoluteFill} onPress={() => answerConfirm(false)} />
        {req ? (
          <View accessibilityViewIsModal accessibilityRole="alert" style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText type="cardTitleL">{req.title}</ThemedText>
            {req.message ? <ThemedText type="bodySmall" themeColor="text2">{req.message}</ThemedText> : null}
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button label="Zrušiť" variant="secondary" onPress={() => answerConfirm(false)} />
              </View>
              <View style={styles.flex}>
                <Button label={req.okLabel} variant={req.destructive ? 'danger' : 'primary'} onPress={() => answerConfirm(true)} />
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: Radius.ringCard, borderWidth: 1, padding: 22, gap: Spacing.two },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.two },
});
