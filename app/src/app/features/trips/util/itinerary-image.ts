import type { Trip } from '../model/trip';
import { enumerateDays, formatKoreanDate } from '../../../shared/util/dates';

export interface ItinerarySection {
  key: string;
  title: string;
  rows: { name: string; detail: string; cost: number | null }[];
}

export function itinerarySections(trip: Trip, selectedDate = ''): ItinerarySection[] {
  const dates = trip.startDate && trip.endDate ? enumerateDays(trip.startDate, trip.endDate) : [];
  const active = trip.stops.filter((s) => !s.excluded);
  const keys = selectedDate
    ? [selectedDate]
    : [
        ...dates,
        ...(active.some((s) => !s.date || !dates.includes(s.date)) || !dates.length
          ? ['unassigned']
          : []),
      ];
  return keys.map((key) => ({
    key,
    title:
      key === 'unassigned'
        ? '날짜 미정'
        : `${dates.indexOf(key) + 1}일차 · ${formatKoreanDate(key)}`,
    rows: [
      ...active
        .filter((s) => (key === 'unassigned' ? !s.date || !dates.includes(s.date) : s.date === key))
        .sort((a, b) => a.order - b.order)
        .map((s) => ({
          name: s.name,
          detail: [s.fixedTime, s.stayMinutes == null ? '' : `${s.stayMinutes}분`, s.address]
            .filter(Boolean)
            .join(' · '),
          cost: s.estimatedCost ?? null,
        })),
      ...trip.stays
        .filter((s) =>
          key === 'unassigned' ? !dates.length : s.checkIn <= key && s.checkOut > key,
        )
        .map((s) => ({
          name: `숙소 · ${s.name}`,
          detail: `${s.checkIn} ~ ${s.checkOut} · ${s.address}`,
          cost: s.estimatedCost ?? null,
        })),
    ],
  }));
}

export function itineraryFilename(title: string, date: string): string {
  return `${
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .trim()
      .slice(0, 60) || '여행'
  }_${date || '전체일정'}.png`;
}
