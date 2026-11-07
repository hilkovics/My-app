import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseQuickAdd, toItemInput } from '../src/features/quickadd/parse';

const at = (y: number, m: number, d: number, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
// Saturday 7 Nov 2026, 10:00
const NOW = at(2026, 11, 7, 10);

describe('parseQuickAdd', () => {
  it('parses relative day, time, priority, tag and alert', () => {
    const p = parseQuickAdd('zajtra 15:00 zubár !2 #zdravie pripomeň hodinu vopred', NOW);
    assert.equal(p.title, 'zubár');
    assert.equal(p.day, at(2026, 11, 8));
    assert.equal(p.minutes, 15 * 60);
    assert.equal(p.priority, 2);
    assert.deepEqual(p.tags, ['zdravie']);
    assert.deepEqual(p.alerts, [60]);
  });

  it('parses weekly rule with weekday, "o 8" and duration', () => {
    const p = parseQuickAdd('každý pondelok o 8 posilka na 90 min', NOW);
    assert.equal(p.title, 'posilka');
    assert.deepEqual(p.rule, { freq: 'WEEKLY', interval: 1, byDay: [0] });
    assert.equal(p.day, at(2026, 11, 9));
    assert.equal(p.minutes, 8 * 60);
    assert.equal(p.durationMin, 90);
  });

  it('parses numeric date with time range', () => {
    const p = parseQuickAdd('12.11. 18:30-20:00 kino', NOW);
    assert.equal(p.title, 'kino');
    assert.equal(p.day, at(2026, 11, 12));
    assert.equal(p.minutes, 18 * 60 + 30);
    assert.equal(p.durationMin, 90);
  });

  it('rolls a past date without year to next year', () => {
    const p = parseQuickAdd('1.3. narodeniny mamy každý rok', NOW);
    assert.equal(p.day, at(2027, 3, 1));
    assert.equal(p.rule?.freq, 'YEARLY');
    assert.equal(p.title, 'narodeniny mamy');
  });

  it('weekday names in different forms', () => {
    assert.equal(parseQuickAdd('v stredu porada', NOW).day, at(2026, 11, 11));
    assert.equal(parseQuickAdd('vo štvrtok porada', NOW).day, at(2026, 11, 12));
    assert.equal(parseQuickAdd('v sobotu výlet', NOW).day, at(2026, 11, 7));
    assert.equal(parseQuickAdd('v nedeľu obed', NOW).day, at(2026, 11, 8));
  });

  it('a bare past time means tomorrow', () => {
    const p = parseQuickAdd('9:00 beh', NOW);
    assert.equal(p.day, at(2026, 11, 8));
    const q = parseQuickAdd('o 18 večera', NOW);
    assert.equal(q.day, at(2026, 11, 7));
  });

  it('leaves plain text untouched', () => {
    const p = parseQuickAdd('kúpiť mlieko a chlieb', NOW);
    assert.equal(p.title, 'kúpiť mlieko a chlieb');
    assert.equal(p.day, null);
    assert.equal(p.rule, null);
  });

  it('handles working days and "pripomeň" without offset', () => {
    const p = parseQuickAdd('každý pracovný deň 7:30 lieky pripomeň', NOW);
    assert.deepEqual(p.rule, { freq: 'WEEKLY', interval: 1, byDay: [0, 1, 2, 3, 4] });
    assert.deepEqual(p.alerts, [0]);
    assert.equal(p.title, 'lieky');
  });
});

describe('toItemInput', () => {
  it('builds a timed event', () => {
    const input = toItemInput(parseQuickAdd('zajtra 15:00 zubár na 30 min', NOW), 'event', NOW);
    assert.equal(input.startAt, at(2026, 11, 8, 15));
    assert.equal(input.endAt, at(2026, 11, 8, 15, 30));
    assert.equal(input.allDay, false);
  });

  it('builds an all-day event for a date without time', () => {
    const input = toItemInput(parseQuickAdd('zajtra výlet', NOW), 'event', NOW);
    assert.equal(input.allDay, true);
    assert.equal(input.startAt, at(2026, 11, 8));
  });

  it('builds a task with due date and optional time block', () => {
    const plain = toItemInput(parseQuickAdd('zajtra zaplatiť faktúru', NOW), 'task', NOW);
    assert.equal(plain.dueAt, at(2026, 11, 8));
    assert.equal(plain.startAt, undefined);
    const block = toItemInput(parseQuickAdd('zajtra 9:00 písať report na 2 h', NOW), 'task', NOW);
    assert.equal(block.startAt, at(2026, 11, 8, 9));
    assert.equal(block.endAt, at(2026, 11, 8, 11));
  });
});
