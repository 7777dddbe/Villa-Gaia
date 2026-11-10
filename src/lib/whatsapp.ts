import site from '../config/sito.json';
import { fill } from './text';
import { isMissing } from './placeholder';
import type { ISODate } from './dates';

const number = site.contatti.whatsapp;
const templates = site.whatsapp;

export const hasWhatsApp = !isMissing(number);

/**
 * Link that opens WhatsApp with the message already written.
 * While the number is still [DA COMPLETARE] it opens WhatsApp's contact picker instead,
 * so the prepared message can still be checked.
 */
export function whatsappUrl(message: string = templates.messaggioGenerico): string {
  const text = encodeURIComponent(message);
  return hasWhatsApp ? `https://wa.me/${number.replace(/\D/g, '')}?text=${text}` : `https://wa.me/?text=${text}`;
}

export interface StayMessage {
  apartment?: string;
  arrival: ISODate;
  departure: ISODate;
  guests: number;
  pet: boolean;
  /** Direct price in euros; leave out when the price is on request. */
  price?: number;
}

/** "12/06/2027" — the messages are always in English, with day/month/year dates. */
const dayMonthYear = (date: ISODate) => date.split('-').reverse().join('/');

/** The English message for a stay: a booking request, a price request, or "is anything free?". */
export function stayMessage({ apartment, arrival, departure, guests, pet, price }: StayMessage): string {
  const template = !apartment
    ? templates.messaggioNessunaDisponibilita
    : price === undefined
      ? templates.messaggioPrezzoSuRichiesta
      : templates.messaggioPrenotazione;
  return fill(template, {
    appartamento: apartment ?? '',
    arrivo: dayMonthYear(arrival),
    partenza: dayMonthYear(departure),
    ospiti: guests === 1 ? templates.ospiteUno : fill(templates.ospitiPiu, { n: guests }),
    animali: pet ? templates.conAnimale : templates.senzaAnimale,
    prezzo: price === undefined ? '' : new Intl.NumberFormat('en-GB').format(price),
  });
}
