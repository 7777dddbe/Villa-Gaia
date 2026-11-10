import prices from '../config/prezzi.json';
import site from '../config/sito.json';
import { addDays, nightsBetween, seasonOf, type BookingRules, type ISODate } from './dates';

type Ranges = { dal: string; al: string }[];
interface SpecialDates {
  nome: string;
  dal: ISODate;
  al: ISODate;
  prezziANotte: Record<string, number>;
}

const periods = prices.periodi as Record<string, Ranges>;
const nightly = prices.prezziANotte as Record<string, Record<string, number | null>>;
const specials = prices.dateSpeciali as SpecialDates[];

export const discountPercent = site.prenotazione.scontoDirettoPercentuale;
export const touristTaxPerPersonNight = site.tassaSoggiorno.euroPerPersonaANotte;

export interface Quote {
  nights: number;
  /** What the stay costs on Booking.com (pet supplement included). */
  bookingTotal: number;
  /** What it costs booking direct: Booking.com minus the discount, plus the pet supplement. */
  directTotal: number;
  saving: number;
  averagePerNight: number;
  petFee: number;
}

/** The price period ("bassa", "media", "alta"...) a night falls in, or null. */
export function periodOf(date: ISODate): string | null {
  const monthDay = date.slice(5);
  for (const [name, ranges] of Object.entries(periods)) {
    if (ranges.some((r) => monthDay >= r.dal && monthDay <= r.al)) return name;
  }
  return null;
}

/** Booking.com price for one night (special dates win over periods), or null if not set. */
export function bookingPriceForNight(apartment: string, date: ISODate): number | null {
  const special = specials.find((s) => date >= s.dal && date <= s.al && typeof s.prezziANotte?.[apartment] === 'number');
  if (special) return special.prezziANotte[apartment];
  const period = periodOf(date);
  const price = period ? nightly[apartment]?.[period] : undefined;
  return typeof price === 'number' && price > 0 ? price : null;
}

/** Full price of a stay, or null when a night has no price in prezzi.json. */
export function quote(apartment: string, arrival: ISODate, departure: ISODate, pet: boolean): Quote | null {
  const nights = nightsBetween(arrival, departure);
  let rooms = 0;
  for (let i = 0; i < nights; i++) {
    const price = bookingPriceForNight(apartment, addDays(arrival, i));
    if (price === null) return null;
    rooms += price;
  }
  const { supplementoEuro, supplementoTipo } = site.animali;
  const petFee = pet ? (supplementoTipo === 'per_notte' ? supplementoEuro * nights : supplementoEuro) : 0;
  // Whole euros, computed on integers so 960 × 90 / 100 gives exactly 864.
  const directRooms = Math.round((rooms * (100 - discountPercent)) / 100);
  const directTotal = directRooms + petFee;
  return {
    nights,
    bookingTotal: rooms + petFee,
    directTotal,
    saving: rooms - directRooms,
    averagePerNight: Math.round(directTotal / nights),
    petFee,
  };
}

/** Nights of a season with no price for some apartment, to warn the owner at build time. */
export function missingPrices(apartments: string[], year: number, rules: BookingRules): string[] {
  const { open, close } = seasonOf(year, rules);
  const missing: string[] = [];
  for (let date = open; date < close; date = addDays(date, 1)) {
    for (const id of apartments) if (bookingPriceForNight(id, date) === null) missing.push(`${id} ${date}`);
  }
  return missing;
}
