export function normalizedCarScale(value) {
  const text = String(value ?? '')
    .toUpperCase()
    .replace(/\s/g, '');
  if (['1:32', '1/32', '132', 'DIGITAL132', 'D132', 'EVOLUTION'].includes(text)) return '1:32';
  if (['1:24', '1/24', '124', 'DIGITAL124', 'D124'].includes(text)) return '1:24';
  return null;
}
export function scaleVoltageHint(filter) {
  return filter === '132'
    ? 'DIGITAL 132: 14,8 V Gleichspannung am Trafo'
    : filter === '124'
      ? 'DIGITAL 124: 18 V Gleichspannung am Trafo'
      : 'DIGITAL 132: 14,8 V · DIGITAL 124: 18 V Gleichspannung';
}
