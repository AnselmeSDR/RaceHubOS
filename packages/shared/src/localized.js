/**
 * Text that can be a plain string or one string per language: { en: '…', fr: '…' }.
 * Used by add-on manifests and the catalog.
 *
 * @param {string|Record<string,string>|undefined} value
 * @param {string} lang wanted language
 * @param {string} [fallback='en'] language used when `lang` is missing
 */
export function localized(value, lang, fallback = 'en') {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return value[lang] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}
