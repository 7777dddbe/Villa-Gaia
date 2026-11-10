import site from '../config/sito.json';
import data from '../config/appartamenti.json';
import en from '../i18n/en.json';
import { isMissing } from './placeholder';

/**
 * schema.org description of Villa Gaia for search engines (JSON-LD).
 * Only facts from the config files; missing data is simply left out.
 * The Booking.com score is not included on purpose: Google does not allow
 * marking up ratings collected on another website.
 */
export function lodgingSchema({ url, description, image }: { url: string; description: string; image?: string }) {
  const { indirizzo, contatti, orari, animali } = site;
  const petsAllowed = animali.ammessi as Record<string, boolean>;
  const services = Array.from(new Set(data.appartamenti.flatMap((a) => a.servizi)));

  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${site.dominio}/#villa-gaia`,
    name: site.nome,
    url,
    description,
    ...(image && { image }),
    address: {
      '@type': 'PostalAddress',
      streetAddress: indirizzo.via,
      postalCode: indirizzo.cap,
      addressLocality: indirizzo.citta,
      addressRegion: indirizzo.provincia,
      addressCountry: 'IT',
    },
    ...(indirizzo.lat && indirizzo.lng
      ? { geo: { '@type': 'GeoCoordinates', latitude: indirizzo.lat, longitude: indirizzo.lng } }
      : {}),
    ...(!isMissing(contatti.whatsapp) && { telephone: `+${contatti.whatsapp.replace(/\D/g, '')}` }),
    ...(!isMissing(contatti.email) && { email: contatti.email }),
    checkinTime: orari.checkIn,
    checkoutTime: orari.checkOut,
    smokingAllowed: false,
    petsAllowed: Object.values(petsAllowed).some(Boolean),
    availableLanguage: ['English', 'German', 'Italian'],
    // Services are told to Google only once confirmed (no "_nota_servizi" left in appartamenti.json).
    ...(!('_nota_servizi' in data)
      ? {
          amenityFeature: services.map((s) => ({
            '@type': 'LocationFeatureSpecification',
            name: en.services[s as keyof typeof en.services],
            value: true,
          })),
        }
      : {}),
    containsPlace: data.appartamenti.map((a) => ({
      '@type': 'Apartment',
      name: a.nome,
      occupancy: { '@type': 'QuantitativeValue', maxValue: a.postiLetto },
      floorLevel: a.piano === 'terra' ? '0' : '1',
      petsAllowed: Boolean(petsAllowed[a.id]),
      ...(a.metraturaMq ? { floorSize: { '@type': 'QuantitativeValue', value: a.metraturaMq, unitCode: 'MTK' } } : {}),
    })),
  };
}
