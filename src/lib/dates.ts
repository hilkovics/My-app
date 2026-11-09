// Small local-time date helpers. All timestamps in the app are epoch milliseconds.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const WEEKDAYS_SHORT = ['po', 'ut', 'st', 'št', 'pi', 'so', 'ne'];
export const WEEKDAYS_LONG = ['pondelok', 'utorok', 'streda', 'štvrtok', 'piatok', 'sobota', 'nedeľa'];
export const MONTHS = [
  'január',
  'február',
  'marec',
  'apríl',
  'máj',
  'jún',
  'júl',
  'august',
  'september',
  'október',
  'november',
  'december',
];

/** Monday = 0 … Sunday = 6 */
export function weekdayIndex(d: Date | number): number {
  return (new Date(d).getDay() + 6) % 7;
}

export function startOfDay(t: number | Date): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function endOfDay(t: number | Date): number {
  return addDays(startOfDay(t), 1) - 1;
}

/** Adds calendar days in local time (DST safe). */
export function addDays(t: number, days: number): number {
  const d = new Date(t);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + days,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  ).getTime();
}

export function addMonths(t: number, months: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes()).getTime();
}

export function startOfWeek(t: number): number {
  const s = startOfDay(t);
  return addDays(s, -weekdayIndex(s));
}

export function startOfMonth(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD in local time. */
export function ymd(t: number | Date): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmd(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function withTime(day: number, hours: number, minutes: number): number {
  const d = new Date(day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes).getTime();
}

export function minutesOfDay(t: number): number {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  return `${d.getHours()}:${pad2(d.getMinutes())}`;
}

/** "so 7. 11." */
export function fmtDateShort(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS_SHORT[weekdayIndex(d)]} ${d.getDate()}. ${d.getMonth() + 1}.`;
}

/** "sobota 7. novembra" style, kept simple: "sobota, 7. 11. 2026" */
export function fmtDateLong(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS_LONG[weekdayIndex(d)]}, ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

export function fmtMonthYear(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Relative label: Dnes / Zajtra / Včera / short date. */
export function fmtRelativeDay(t: number, now: number = Date.now()): string {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (diff === 0) return 'Dnes';
  if (diff === 1) return 'Zajtra';
  if (diff === -1) return 'Včera';
  return fmtDateShort(t);
}

/** Lowercase relative label used in meta lines: dnes / zajtra / včera / "so 7. 11.". */
export function fmtRelDay(t: number, now: number = Date.now()): string {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / DAY);
  if (diff === 0) return 'dnes';
  if (diff === 1) return 'zajtra';
  if (diff === -1) return 'včera';
  return fmtDateShort(t);
}

export function fmtDateTime(t: number, allDay = false, now = Date.now()): string {
  const day = fmtRelativeDay(t, now);
  return allDay ? day : `${day} ${fmtTime(t)}`;
}

/** 42 day starts (6 weeks) covering the month of `t`, weeks start on Monday. */
export function monthGrid(t: number): number[] {
  const first = startOfWeek(startOfMonth(t));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

/** Rounds up to the next multiple of `step` minutes. */
export function roundUpMinutes(t: number, step = 30): number {
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  const rounded = Math.ceil((m + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)) / step) * step;
  return withTime(startOfDay(t), 0, rounded);
}

/** Parses "H:MM" / "HH:MM" / "H" → minutes of day, or null. */
export function parseTime(s: string): number | null {
  const m = s.trim().match(/^(\d{1,2})(?::|\.)?(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Slovak plural: plural(1, 'deň', 'dni', 'dní') → "1 deň", 3 → "3 dni", 5 → "5 dní". */
export function plural(n: number, one: string, few: string, many: string): string {
  const word = n === 1 ? one : n >= 2 && n <= 4 ? few : many;
  return `${n} ${word}`;
}

/** First day on or after `from` that falls on `weekday` (Monday = 0), as a day start. */
export function snapToWeekday(from: number, weekday: number): number {
  const day = startOfDay(from);
  return addDays(day, (weekday - weekdayIndex(day) + 7) % 7);
}

/** Weekday names in the accusative ("na stredu", "v nedeľu"). */
export const WEEKDAYS_ACC = ['pondelok', 'utorok', 'stredu', 'štvrtok', 'piatok', 'sobotu', 'nedeľu'];

/** "stredu, 11. 11. 2026" — for phrases like "Presunúť na stredu, 11. 11. 2026". */
export function fmtDateLongAcc(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS_ACC[weekdayIndex(d)]}, ${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}
