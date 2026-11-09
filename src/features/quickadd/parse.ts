// Slovak quick-add parser, e.g.
//   "zajtra 15:00 zubár !2 #zdravie pripomeň hodinu vopred"
//   "každý pondelok o 8 posilka na 90 min"
//   "12.11. 18:30-20:00 kino"

import type { ItemInput, ItemType } from '../../db/types';
import { MINUTE, addDays, roundUpMinutes, startOfDay, weekdayIndex, withTime } from '../../lib/dates';
import { formatRule, type Rule } from '../../lib/recurrence';

export interface Parsed {
  title: string;
  /** Start of the day, if a date was given (or implied by a time / weekly rule). */
  day: number | null;
  /** Minutes after midnight, if a time was given. */
  minutes: number | null;
  durationMin: number | null;
  priority: number;
  tags: string[];
  rule: Rule | null;
  /** Minutes before the item's time. */
  alerts: number[];
}

const S = '(?<=^|\\s)';
const E = '(?=$|\\s|[,;])';

const WEEKDAY_PATTERNS: [RegExp, number][] = [
  [/^pondel(?:ok|ka)$/, 0],
  [/^utor(?:ok|ka)$/, 1],
  [/^stred[auy]$/, 2],
  [/^[šs]tvrt(?:ok|ka)$/, 3],
  [/^piat(?:ok|ka)$/, 4],
  [/^sobot[auy]$/, 5],
  [/^nede[lľ][auy]$/, 6],
];
const WEEKDAY_WORD = '(pondelok|pondelka|utorok|utorka|stred[auy]|[šs]tvrtok|[šs]tvrtka|piatok|piatka|sobot[auy]|nede[lľ][auy])';

function weekdayFromWord(w: string): number | null {
  const lw = w.toLowerCase();
  for (const [re, i] of WEEKDAY_PATTERNS) if (re.test(lw)) return i;
  return null;
}

function unitToMinutes(n: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return n * 60;
  if (u.startsWith('d')) return n * 1440;
  if (u.startsWith('t')) return n * 10080;
  return n;
}

/** Next date (today included) that falls on the weekday. */
function upcomingWeekday(today: number, weekday: number): number {
  const diff = (weekday - weekdayIndex(today) + 7) % 7;
  return addDays(startOfDay(today), diff);
}

export function parseQuickAdd(input: string, now = Date.now()): Parsed {
  let text = ` ${input} `;
  const today = startOfDay(now);
  const out: Parsed = {
    title: '',
    day: null,
    minutes: null,
    durationMin: null,
    priority: 0,
    tags: [],
    rule: null,
    alerts: [],
  };

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) {
      fn(m);
      text = text.replace(m[0], ' ');
    }
    return !!m;
  };

  // Alerts: "pripomeň 15 min vopred", "pripomeň hodinu vopred", "pripomeň deň vopred", "pripomeň"
  take(
    new RegExp(
      `${S}pripome[nň](?:\\s+mi)?(?:\\s+(?:(\\d+)\\s*(min(?:út|úty|uty|ut|úta)?|m|h|hod(?:ín|in|iny|inu|ina)?|d|dn[ií]|de[nň]|t[ýy][žz]d(?:ne|ňov|nov|eň|en)?)|(hodinu|de[nň]|t[ýy][žz]de[nň]))\\s+(?:vopred|predt[ýy]m|pred))?${E}`,
      'iu',
    ),
    (m) => {
      if (m[1]) out.alerts.push(unitToMinutes(Number(m[1]), m[2]));
      else if (m[3]) out.alerts.push(unitToMinutes(1, m[3]));
      else out.alerts.push(0);
    },
  );

  // Duration: "na 30 min", "na 2 h", "na hodinu"
  take(new RegExp(`${S}na\\s+(?:(\\d+)\\s*(min(?:út|úty|ut|uty)?|m|h|hod(?:ín|in|iny|inu)?)|(hodinu|pol hodiny))${E}`, 'iu'), (m) => {
    if (m[1]) out.durationMin = unitToMinutes(Number(m[1]), m[2]);
    else out.durationMin = m[3].toLowerCase().startsWith('pol') ? 30 : 60;
  });

  // Recurrence
  take(
    new RegExp(
      `${S}(?:každ[ýyúuée]\\s+(?:(\\d+)\\.?\\s+)?(pracovn[ýy]\\s+de[nň]|de[nň]|dni|t[ýy][žz]de[nň]|t[ýy][žz]dne|mesiac|mesiace|rok|roky|${WEEKDAY_WORD.slice(1, -1)})|(denne|t[ýy][žz]denne|mesa[čc]ne|ro[čc]ne))${E}`,
      'iu',
    ),
    (m) => {
      const interval = m[1] ? Math.max(1, Number(m[1])) : 1;
      const word = (m[2] ?? m[3]).toLowerCase();
      const wd = weekdayFromWord(word);
      if (wd != null) {
        out.rule = { freq: 'WEEKLY', interval, byDay: [wd] };
        out.day = upcomingWeekday(today, wd);
      } else if (/^pracovn/.test(word)) out.rule = { freq: 'WEEKLY', interval: 1, byDay: [0, 1, 2, 3, 4] };
      else if (/^(de[nň]|dni|denne)$/.test(word)) out.rule = { freq: 'DAILY', interval };
      else if (/^t[ýy][žz]d/.test(word)) out.rule = { freq: 'WEEKLY', interval };
      else if (/^mes/.test(word)) out.rule = { freq: 'MONTHLY', interval };
      else if (/^ro/.test(word)) out.rule = { freq: 'YEARLY', interval };
    },
  );

  // Dates
  const gotRelative = take(new RegExp(`${S}(dnes|zajtra|pozajtra)${E}`, 'iu'), (m) => {
    const w = m[1].toLowerCase();
    out.day = addDays(today, w === 'dnes' ? 0 : w === 'zajtra' ? 1 : 2);
  });
  if (!gotRelative) {
    const gotNumeric = take(new RegExp(`${S}(\\d{1,2})\\.\\s?(\\d{1,2})\\.(\\s?(\\d{4}))?${E}`, 'u'), (m) => {
      const d = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const y = m[4] ? Number(m[4]) : new Date(today).getFullYear();
      let t = new Date(y, mo, d).getTime();
      if (!m[4] && t < today) t = new Date(y + 1, mo, d).getTime();
      if (new Date(t).getDate() === d) out.day = t;
    });
    if (!gotNumeric) {
      take(new RegExp(`${S}(?:(?:v|vo|na|budúci|budúcu|buduci|buducu)\\s+)?${WEEKDAY_WORD}${E}`, 'iu'), (m) => {
        const wd = weekdayFromWord(m[1]);
        if (wd != null) out.day = upcomingWeekday(today, wd);
      });
    }
  }

  // Time range "15:00-16:30" / "15-16"
  const gotRange = take(new RegExp(`${S}(?:od\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(?:-|–|do)\\s*(\\d{1,2})(?::(\\d{2}))?${E}`, 'u'), (m) => {
    const a = Number(m[1]) * 60 + Number(m[2] ?? 0);
    const b = Number(m[3]) * 60 + Number(m[4] ?? 0);
    if (Number(m[1]) < 24 && Number(m[3]) < 24 && b > a) {
      out.minutes = a;
      out.durationMin = b - a;
    }
  });
  if (!gotRange) {
    // "15:00", "o 15:00", "o 9", "o 9.30", "15h"
    take(
      new RegExp(`${S}(?:o\\s+(\\d{1,2})(?:[:.](\\d{2}))?(?:\\s*h(?:od)?\\.?)?|(\\d{1,2}):(\\d{2})|(\\d{1,2})h)${E}`, 'iu'),
      (m) => {
        const h = Number(m[1] ?? m[3] ?? m[5]);
        const min = Number(m[2] ?? m[4] ?? 0);
        if (h < 24 && min < 60) out.minutes = h * 60 + min;
      },
    );
  }

  // Priority: "!1".."!3" or "!!!" style
  take(new RegExp(`${S}(?:!([1-3])|(!{1,3}))${E}`, 'u'), (m) => {
    out.priority = m[1] ? Number(m[1]) : m[2].length;
  });

  // Tags
  let tm: RegExpMatchArray | null;
  const tagRe = /(?<=^|\s)#([\p{L}\p{N}_-]+)/u;
  while ((tm = text.match(tagRe))) {
    out.tags.push(tm[1]);
    text = text.replace(tm[0], ' ');
  }

  if (out.minutes != null && out.day == null) {
    // A bare time means today, or tomorrow if that time has already passed.
    out.day = withTime(today, 0, out.minutes) <= now ? addDays(today, 1) : today;
  }

  out.title = text.replace(/\s+/g, ' ').trim();
  return out;
}

/** Builds the fields of a new item of the given type from a parse result. */
export function toItemInput(p: Parsed, type: ItemType, now = Date.now()): ItemInput {
  const base: ItemInput = {
    type,
    title: p.title,
    priority: p.priority,
    tags: p.tags,
    rrule: p.rule ? formatRule(p.rule) : null,
  };
  if (type === 'note') return { ...base, rrule: null };
  const when = p.day == null ? null : p.minutes != null ? withTime(p.day, 0, p.minutes) : p.day;
  if (type === 'event') {
    const allDay = p.minutes == null;
    const start = when ?? roundUpMinutes(now, 30);
    const startAt = allDay && when != null ? startOfDay(start) : start;
    const duration = allDay && when != null ? 24 * 60 : (p.durationMin ?? 60);
    return { ...base, startAt, endAt: startAt + duration * MINUTE - (allDay && when != null ? MINUTE : 0), allDay: allDay && when != null };
  }
  // task: "na 30 min" is the estimate; with a time it also blocks that time in the calendar
  const input: ItemInput = { ...base, dueAt: when, estimateMinutes: p.durationMin };
  if (p.durationMin != null && when != null && p.minutes != null) {
    // A duration on a task means "block this time in the calendar".
    input.startAt = when;
    input.endAt = when + p.durationMin * MINUTE;
  }
  return input;
}
