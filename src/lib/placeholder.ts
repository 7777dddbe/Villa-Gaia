export const PLACEHOLDER = '[DA COMPLETARE]';

/** True when a config value is still missing: null, empty, or marked [DA COMPLETARE]. */
export function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '' || (typeof value === 'string' && value.startsWith(PLACEHOLDER));
}
