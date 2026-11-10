import site from '../config/sito.json';
import data from '../config/appartamenti.json';
import type { BookingRules } from './dates';

export const rules: BookingRules = {
  opening: site.prenotazione.stagione.apertura,
  closing: site.prenotazione.stagione.chiusura,
  minNights: site.prenotazione.soggiornoMinimoNotti,
  yearsAhead: site.prenotazione.anniPrenotabiliInAvanti,
};

/** Beds in the largest apartment: the most guests one search can ask for. */
export const maxGuests = Math.max(...data.appartamenti.map((a) => a.postiLetto));

const petsAllowed = site.animali.ammessi as Record<string, boolean>;

/** Names of the apartments that accept pets, e.g. ["Gaia 3"]. */
export const petFriendlyNames = data.appartamenti.filter((a) => petsAllowed[a.id]).map((a) => a.nome);
