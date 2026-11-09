import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DAY_VIEW, WEEK_VIEW, blockGeometry, blockStyleOf, blockTitle } from '../src/features/calendar/blocks';

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const DAY = at(10, 0);
const view = (v: typeof DAY_VIEW | typeof WEEK_VIEW, firstHour = 7) => ({ ...v, firstHour });

describe('blockGeometry', () => {
  it('Deň: 56 px per hour from 7:00, 2 px gap', () => {
    const g = blockGeometry({ start: at(10, 9), end: at(10, 11) }, DAY, view(DAY_VIEW))!;
    assert.equal(g.top, 2 * 56);
    assert.equal(g.height, 2 * 56 - 2);
  });

  it('Týždeň: 36 px per hour', () => {
    const g = blockGeometry({ start: at(10, 8), end: at(10, 9, 30) }, DAY, view(WEEK_VIEW))!;
    assert.equal(g.top, 36);
    assert.equal(g.height, 1.5 * 36 - 2);
  });

  it('uses the configured first hour', () => {
    const g = blockGeometry({ start: at(10, 9), end: at(10, 10) }, DAY, view(DAY_VIEW, 8))!;
    assert.equal(g.top, 56);
  });

  it('drops blocks outside the window and clips partial ones', () => {
    assert.equal(blockGeometry({ start: at(10, 5), end: at(10, 6) }, DAY, view(DAY_VIEW)), null);
    assert.equal(blockGeometry({ start: at(10, 22), end: at(10, 23) }, DAY, view(DAY_VIEW)), null);
    assert.equal(blockGeometry({ start: at(10, 20), end: at(10, 21) }, DAY, view(WEEK_VIEW)), null, 'week ends at 20:00');
    const early = blockGeometry({ start: at(10, 6), end: at(10, 8) }, DAY, view(DAY_VIEW))!;
    assert.equal(early.top, 0);
    assert.equal(early.height, 56 - 2);
    const late = blockGeometry({ start: at(10, 21, 30), end: at(10, 23) }, DAY, view(DAY_VIEW))!;
    assert.equal(late.height, 30 * (56 / 60) - 2);
  });

  it('keeps very short blocks tappable', () => {
    const g = blockGeometry({ start: at(10, 9), end: at(10, 9, 5) }, DAY, view(DAY_VIEW))!;
    assert.equal(g.height, 20);
  });
});

describe('block encoding', () => {
  it('maps kind and energy to a style', () => {
    assert.equal(blockStyleOf({ kind: 'event', energy: null }), 'event');
    assert.equal(blockStyleOf({ kind: 'external', energy: null }), 'event');
    assert.equal(blockStyleOf({ kind: 'block', energy: 'deep' }), 'deep');
    assert.equal(blockStyleOf({ kind: 'block', energy: 'rest' }), 'pause');
    assert.equal(blockStyleOf({ kind: 'block', energy: 'routine' }), 'task');
    assert.equal(blockStyleOf({ kind: 'due', energy: undefined }), 'task');
  });

  it('prefixes the title like the design', () => {
    const base = { done: false, title: 'Report', hasNote: false };
    assert.equal(blockTitle({ ...base, kind: 'event', energy: null }), 'Report');
    assert.equal(blockTitle({ ...base, kind: 'block', energy: null }), '☐ Report');
    assert.equal(blockTitle({ ...base, kind: 'block', energy: 'deep' }), '☐ 🔥 Report');
    assert.equal(blockTitle({ ...base, kind: 'block', energy: 'rest' }), '☕ Report');
    assert.equal(blockTitle({ ...base, kind: 'block', energy: null, done: true }), '☑ Report');
    assert.equal(blockTitle({ ...base, kind: 'event', energy: null, hasNote: true }), 'Report 📝');
    assert.equal(blockTitle({ ...base, kind: 'block', energy: 'deep' }, '(bez názvu)', true), '⚠ ☐ 🔥 Report');
  });
});
