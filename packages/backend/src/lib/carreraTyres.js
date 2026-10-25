// Read only the manufacturer's explicit spare-parts section, never recommendations.
export function tyreParts(html) {
  const section = html.match(
    /<collapsible-content\b[^>]*\bid="[^"]*ersatzteile[^"]*"[^>]*>([\s\S]*?)<\/collapsible-content>/i
  )?.[1];
  if (section === undefined)
    throw new Error(
      'Der offizielle Ersatzteilbereich konnte nicht eindeutig gelesen werden. Bisherige Reifendaten bleiben erhalten.'
    );
  const parts = [];
  for (const anchor of section.matchAll(/<a\b[^>]*href="(\/products\/(200\d{5})-[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = anchor[3]
      .match(/<div\b[^>]*class="inside-products-inhaltose__title"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      ?.replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .trim();
    if (!title || !/reifen|\b(tyres?|tires?)\b/i.test(title)) continue;
    if (parts.some((p) => p.articleNumber === anchor[2])) continue;
    parts.push({
      articleNumber: anchor[2],
      title: title.slice(0, 400),
      sourceUrl: `https://carrera-toys.com${anchor[1]}`,
      axle: /front|vorder/i.test(title) ? 'front' : /rear|hinter/i.test(title) ? 'rear' : null,
    });
  }
  return parts;
}
