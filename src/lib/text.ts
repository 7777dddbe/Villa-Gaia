/** Replaces {name} placeholders in a text with the given values. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => (key in values ? String(values[key]) : match));
}
