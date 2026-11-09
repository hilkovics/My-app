import { useState } from 'react';

import type { TaskStatus } from '@/db/types';
import { t } from '@/i18n/sk';

import { BottomSheet } from './bottom-sheet';
import { Button, Chip, Input, Row } from './ui';

export const STATUSES: TaskStatus[] = ['todo', 'doing', 'waiting', 'done'];

/** Bottom sheet for choosing a task's state (and who/what a waiting task waits for). */
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
  return (
    <BottomSheet visible={visible} onClose={onCancel} title={title || t.common.untitled} closeLabel={t.board.cancel}>
      {/* Remounted per opening so the draft starts from the task's current values. */}
      {visible ? <PickerBody status={status} waitingFor={waitingFor} onSave={onSave} onCancel={onCancel} /> : null}
    </BottomSheet>
  );
}

function PickerBody({
  status,
  waitingFor,
  onSave,
  onCancel,
}: {
  status: TaskStatus;
  waitingFor: string | null;
  onSave: (status: TaskStatus, waitingFor: string | null) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TaskStatus>(status);
  const [who, setWho] = useState(waitingFor ?? '');
  return (
    <>
      <Row>
        {STATUSES.map((s) => (
          <Chip key={s} label={t.status[s]} selected={draft === s} onPress={() => setDraft(s)} />
        ))}
      </Row>
      {draft === 'waiting' ? (
        <Input value={who} onChangeText={setWho} placeholder={t.board.waitingPlaceholder} autoFocus accessibilityLabel={t.board.waitingFor} />
      ) : null}
      <Row style={{ justifyContent: 'flex-end' }}>
        <Button small variant="secondary" label={t.board.cancel} onPress={onCancel} />
        <Button small label={t.board.save} onPress={() => onSave(draft, draft === 'waiting' ? who.trim() || null : null)} />
      </Row>
    </>
  );
}
