import data from '../config/appartamenti.json';
import { rules } from './booking-rules';
import { missingPrices } from './pricing';

/** Runs once per build: warns when some season night has no price in prezzi.json. */
const ids = data.appartamenti.map((a) => a.id);
const thisYear = new Date().getFullYear();
for (let year = thisYear; year <= thisYear + rules.yearsAhead; year++) {
  const missing = missingPrices(ids, year, rules);
  if (missing.length) {
    console.warn(`[prezzi.json] ${missing.length} notti senza prezzo nel ${year}, ad esempio: ${missing.slice(0, 3).join(', ')}`);
  }
}
