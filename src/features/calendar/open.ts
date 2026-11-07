import { router } from 'expo-router';

import type { Occurrence } from './agenda';

/** Route params describing one occurrence (shared by the event-notes and phone-event screens). */
export function occurrenceParams(occ: Occurrence) {
  return {
    title: occ.title,
    start: String(occ.start),
    end: String(occ.end),
    allDay: occ.allDay ? '1' : '0',
    calendarId: occ.calendarId ?? '',
    calendarTitle: occ.calendarTitle ?? '',
    location: occ.location ?? '',
    notes: occ.notes ?? '',
  };
}

/** Tap: events (local and phone) open their notes; tasks open as tasks. */
export function openOccurrence(occ: Occurrence): void {
  if (occ.kind === 'event' || occ.kind === 'external') {
    router.push({
      pathname: '/event/notes',
      params: { source: occ.kind === 'event' ? 'local' : 'device', eventId: occ.id, ...occurrenceParams(occ) },
    });
  } else {
    router.push({ pathname: '/item/[id]', params: { id: occ.id } });
  }
}

/** Long press / "Upraviť udalosť": edit a local item, or show the phone event's details. */
export function editOccurrence(occ: Occurrence): void {
  if (occ.kind === 'external') {
    router.push({ pathname: '/external/[id]', params: { id: occ.id, ...occurrenceParams(occ) } });
  } else {
    router.push({ pathname: '/item/[id]', params: { id: occ.id } });
  }
}
