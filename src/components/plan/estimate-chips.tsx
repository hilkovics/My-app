import type { Energy } from '@/db/types';
import { fmtMinutes } from '@/features/focus/stats';
import { t } from '@/i18n/sk';

import { Chip, Row } from '../ui';
import { ENERGY_ICON, ENERGY_LABEL } from './energy-style';

export const ESTIMATES = [5, 15, 30, 45, 60, 90, 120, 180];
const ENERGIES: Energy[] = ['deep', 'routine', 'rest'];

/** Estimated duration of a task; tapping the selected value clears it. */
export function EstimateChips({ value, onChange }: { value: number | null; onChange: (minutes: number | null) => void }) {
  return (
    <Row>
      <Chip label={t.plan.noEstimate} selected={value == null} onPress={() => onChange(null)} />
      {ESTIMATES.map((m) => (
        <Chip key={m} label={fmtMinutes(m)} selected={value === m} onPress={() => onChange(value === m ? null : m)} />
      ))}
      {value != null && !ESTIMATES.includes(value) ? <Chip label={fmtMinutes(value)} selected /> : null}
    </Row>
  );
}

/** How demanding it is (no value = routine). */
export function EnergyChips({ value, onChange }: { value: Energy | null; onChange: (energy: Energy) => void }) {
  const current = value ?? 'routine';
  return (
    <Row>
      {ENERGIES.map((e) => (
        <Chip key={e} label={`${ENERGY_ICON[e] ? `${ENERGY_ICON[e]} ` : ''}${ENERGY_LABEL[e]}`} selected={current === e} onPress={() => onChange(e)} />
      ))}
    </Row>
  );
}
