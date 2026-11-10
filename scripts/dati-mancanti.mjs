// Elenca i dati ancora da completare nei file di configurazione.
// Uso: npm run dati-mancanti
import { readFileSync, readdirSync } from 'node:fs';

const folder = new URL('../src/config/', import.meta.url);
const missing = [];

function walk(value, path) {
  const key = path.split('.').at(-1) ?? '';
  // Explanations for the reader are not data, unless they start with the marker themselves.
  if (key.startsWith('_') && !(typeof value === 'string' && value.startsWith('[DA COMPLETARE]'))) return;
  if (value === null) missing.push(`${path}: vuoto`);
  else if (typeof value === 'string' && value.includes('[DA COMPLETARE]')) missing.push(`${path}: ${value.replace('[DA COMPLETARE]', '').trim() || 'da completare'}`);
  else if (Array.isArray(value)) value.forEach((item, i) => walk(item, `${path}[${i}]`));
  else if (typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
}

for (const file of readdirSync(folder).filter((f) => f.endsWith('.json'))) {
  walk(JSON.parse(readFileSync(new URL(file, folder), 'utf8')), file);
}

console.log(missing.length ? `Dati da completare (${missing.length}):\n- ${missing.join('\n- ')}` : 'Tutto completo.');
