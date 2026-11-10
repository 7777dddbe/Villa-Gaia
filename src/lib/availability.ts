import type { ISODate } from './dates';

/** One booked stay of one apartment. `end` is the departure day: a new guest can arrive that day. */
export interface Booking {
  apartment: string;
  start: ISODate;
  end: ISODate;
}

export function overlaps(booking: Booking, checkin: ISODate, checkout: ISODate): boolean {
  return booking.start < checkout && booking.end > checkin;
}

/** Ids of the apartments with no booking overlapping the requested stay. */
export function freeApartments(ids: string[], bookings: Booking[], checkin: ISODate, checkout: ISODate): string[] {
  return ids.filter((id) => !bookings.some((b) => b.apartment === id && overlaps(b, checkin, checkout)));
}

/**
 * Apartments named in a calendar event title, e.g. "Gaia 1 - Müller (4)" → ["gaia1"].
 * Whole words only and any letter case, so "GAIA 1" counts but "Gaia 10" does not.
 */
export function apartmentsInTitle(title: string, apartments: { id: string; nome: string }[]): string[] {
  return apartments
    .filter(({ nome }) => new RegExp(`(^|[^\\p{L}\\p{N}])${nome}($|[^\\p{L}\\p{N}])`, 'iu').test(title))
    .map(({ id }) => id);
}
