// Carrera numeric references and Hornby Scalextric / Superslot catalogue codes.
export function catalogReference(value) {
  const text = String(value ?? '')
    .trim()
    .toUpperCase();
  if (/^\d{5}$/.test(text)) return '200' + text;
  return /^(200\d{5}|[CH]\d{4}[A-Z]?)$/.test(text) ? text : null;
}
