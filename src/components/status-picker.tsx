import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { TaskStatus } from '@/db/types';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n/sk';

import { ThemedText } from './themed-text';
import { Button, Chip, Input, Row } from './ui';

export const STATUSES: TaskStatus[] = ['todo', 'doing', 'waiting', 'done'];

/** Modal for choosing a task's state (and who/what a waiting task waits for). */
export function StatusPicker({
  visible,
  title,
  status,
  waitingFor,
  onSave,
  onCancel,
}: {
  visible: boolean;
  title: string;
  status: TaskStatus;
  waitingFor: string | null;
  onSave: (status: TaskStatus, waitingFor: string | null) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel={t.board.cancel}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={() => {}}>
          {/* Remounted per opening so the draft starts from the task's current values. */}
          {visible ? <PickerBody title={title} status={status} waitingFor={waitingFor} onSave={onSave} onCancel={onCancel} /> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerBody({
  title,
  status,
  waitingFor,
  onSave,
  onCancel,
}: {
  title: string;
  status: TaskStatus;
  waitingFor: string | null;
  onSave: (status: TaskStatus, waitingFor: string | null) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TaskStatus>(status);
  const [who, setWho] = useState(waitingFor ?? '');
  return (
    <>
      <ThemedText type="smallBold" numberOfLines={2}>
        {title || t.common.untitled}
      </ThemedText>
      <Row>
        {STATUSES.map((s) => (
          <Chip key={s} label={t.status[s]} selected={draft === s} onPress={() => setDraft(s)} />
        ))}
      </Row>
      {draft === 'waiting' ? (
        <Input value={who} onChangeText={setWho} placeholder={t.board.waitingPlaceholder} autoFocus accessibilityLabel={t.board.waitingFor} />
      ) : null}
      <Row style={styles.actions}>
        <Button small variant="secondary" label={t.board.cancel} onPress={onCancel} />
        <Button small label={t.board.save} onPress={() => onSave(draft, draft === 'waiting' ? who.trim() || null : null)} />
      </Row>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.three },
  sheet: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  actions: { justifyContent: 'flex-end' },
});
