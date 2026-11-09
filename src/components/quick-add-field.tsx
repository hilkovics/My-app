import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FontFamily, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { hexA } from '@/lib/color';

import { Icon } from './icon';
import { ThemedText } from './themed-text';

/**
 * Quick-add field: 2 px border (`mark` once there is text), radius 20, add icon, input, 44 px send
 * button (accent with text, surface2 empty). Below it: the live "Rozpoznané:" chips while typing,
 * or the syntax hint when empty.
 */
export function QuickAddField({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  chips,
  hint,
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  chips: string[] | null;
  hint: string;
}) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasText = value.trim().length > 0;
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          { backgroundColor: theme.surface, borderColor: hasText || focused ? theme.mark : theme.border },
        ]}>
        <Icon name="addCircle" size={24} color={theme.text2} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={hexA(theme.text2, 0.8)}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={onSubmit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel="Nová úloha"
          style={[styles.input, { color: theme.text, fontFamily: FontFamily[600] }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pridať úlohu"
          accessibilityState={{ disabled: !hasText }}
          disabled={!hasText}
          onPress={onSubmit}
          style={[styles.send, { backgroundColor: hasText ? theme.accent : theme.surface2 }]}>
          <Icon name="send" size={20} color={hasText ? theme.onAccent : theme.text2} />
        </Pressable>
      </View>
      {chips ? (
        <View style={styles.chips} accessibilityLiveRegion="polite">
          <ThemedText type="meta" themeColor="text2" style={{ fontFamily: FontFamily[700] }}>
            Rozpoznané:
          </ThemedText>
          {chips.map((c) => (
            <View key={c} style={[styles.chip, { backgroundColor: theme.markSoft }]}>
              <ThemedText type="meta" style={{ fontFamily: FontFamily[800] }}>
                {c}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : (
        <ThemedText type="meta" themeColor="text2">
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderRadius: Radius.cardL - 4, paddingLeft: 14, paddingRight: 6, minHeight: 60 },
  input: { flex: 1, fontSize: 15, minHeight: 48, outlineStyle: 'none' as never },
  send: { width: 44, height: 44, borderRadius: Radius.buttonSquare, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: Radius.pill, justifyContent: 'center' },
});
