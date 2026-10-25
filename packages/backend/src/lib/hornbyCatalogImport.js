// Public product lists only: no account, checkout, scraping of customer data or C/H prefix guessing.
export const SCALEXTRIC_SOURCE = 'https://uk.scalextric.com/catalogue/cars';
export const SUPERSLOT_SOURCE = 'https://www.hobbymodelismo.es/brand/109-superslot';
const CLOUD = 'd63oxfkn1m8sf.cloudfront.net';
export function text(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[0-9a-f]+|[0-9]+);/gi, (entity) => {
      const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };
      if (named[entity]) return named[entity];
      const n =
        entity[2]?.toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}
export async function body(response, limit = 6 * 1024 * 1024) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Produktdatei zu groß.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
async function page(url, fetcher) {
  return (await body(await fetcher(url, { signal: AbortSignal.timeout(30000), redirect: 'error' }))).toString();
}
export function trustedHornbyImage(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      !u.port &&
      ((u.hostname === CLOUD && /^\/[a-zA-Z0-9_/.%?=-]+$/.test(u.pathname)) ||
        (u.hostname === 'www.hobbymodelismo.es' && /^\/\d+-home_default\/[a-zA-Z0-9_-]+\.jpg$/.test(u.pathname)))
      ? u
      : null;
  } catch {
    return null;
  }
}
function productUrl(value, host, prefix) {
  try {
    const u = new URL(value);
    return u.origin === `https://${host}` &&
      u.pathname.startsWith(prefix) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function scalextricProduct(p) {
  if (
    !/^C\d{4}[A-Z]?$/.test(p.pid || '') ||
    p.product_item_scale !== '1:32 Scale' ||
    !p.title ||
    /(?:twin|triple|car set|pack|bundle)/i.test(p.title)
  )
    return null;
  const sourceUrl = productUrl(p.url, 'uk.scalextric.com', '/products/');
  if (!sourceUrl) return null;
  // Use the same small, complete-image rendition offered on the manufacturer's cards.
  const imageTag = String(p.thumb_image_markup || '').match(/<img\b[^>]*>/i)?.[0] || '';
  // Lazy cards use a data: placeholder; picture sources may contain srcset lists.
  const thumb = [...imageTag.matchAll(/(?:^|\s)(?:data-)?src\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => text(match[1]))
    .find((value) => trustedHornbyImage(value));
  return {
    articleNumber: p.pid,
    manufacturer: 'Scalextric',
    brand: 'Scalextric',
    model: text(p.title).slice(0, 240),
    scale: '1:32',
    series: 'SCALEXTRIC',
    sourceUrl,
    imageUrl: trustedHornbyImage(thumb) ? thumb : null,
    img: null,
    importSource: 'scalextric',
  };
}
export async function importScalextric(fetcher) {
  const html = await page(SCALEXTRIC_SOURCE, fetcher);
  const attrs = Object.fromEntries(
    [...html.matchAll(/data-(br-account|br-auth-key|domain)="([^"]+)"/g)].map((m) => [m[1], m[2]])
  );
  if (
    !attrs['br-account'] ||
    !attrs['br-auth-key'] ||
    attrs.domain !== 'hornby_en_scalextric' ||
    !/product_headless_category[^>]*value="Cars"/.test(html)
  )
    throw new Error('Scalextric-Fahrzeugliste hat ein unbekanntes Format.');
  const entries = [];
  let total = null;
  for (let start = 0; start < 2000; start += 100) {
    const url = new URL('https://core.dxpapi.com/api/v1/core/');
    url.search = new URLSearchParams({
      account_id: attrs['br-account'],
      auth_key: attrs['br-auth-key'],
      domain_key: attrs.domain,
      request_type: 'search',
      search_type: 'category',
      q: 'Cars',
      rows: '100',
      start: String(start),
      sort: 'pid asc',
      fl: 'pid,title,url,product_item_scale,thumb_image_markup',
      url: SCALEXTRIC_SOURCE,
    }).toString();
    const data = JSON.parse(await page(url, fetcher));
    const r = data.response;
    if (
      !r ||
      !Number.isInteger(r.numFound) ||
      r.numFound < 1 ||
      r.numFound > 2000 ||
      r.start !== start ||
      !Array.isArray(r.docs) ||
      (total !== null && total !== r.numFound)
    )
      throw new Error('Scalextric-Produktseiten sind unvollständig.');
    total = r.numFound;
    entries.push(...r.docs.map(scalextricProduct).filter(Boolean));
    if (start + r.docs.length >= total) {
      if (!entries.length) break;
      return entries;
    }
    if (r.docs.length !== 100) break;
  }
  throw new Error('Scalextric-Produktseiten sind unvollständig.');
}
export function modelIdentity(title) {
  return text(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(?:super\s*slot|scalextric|escala\s*1[/:]32|\b[CH]\d{4}[A-Z]?\b)/gi, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
export function superslotProducts(html, scalextric, checkedAt) {
  // Restrict parsing to the actual list, excluding unrelated recommendation widgets.
  const list = html.split(/id="js-product-list"/)[1];
  if (!list) throw new Error('Superslot-Fahrzeugliste hat ein unbekanntes Format.');
  const entries = [];
  for (const match of list.matchAll(/<article\b[\s\S]*?<\/article>/g)) {
    const block = match[0];
    const ref = text(block.match(/class="pl_reference"[^>]*>([\s\S]*?)<\/p>/)?.[1]);
    const articleNumber = ref.match(/\bSS(H\d{4}[A-Z]?)\b/)?.[1];
    const sourceUrl = productUrl(
      [...block.matchAll(/<a\b[^>]*>/g)]
        .map((m) => m[0])
        .find((t) => /class="thumbnail product-thumbnail"/.test(t))
        ?.match(/href="([^"]+)"/)?.[1],
      'www.hobbymodelismo.es',
      '/coches-superslot/'
    );
    const model = text(block.match(/class="h3 product-title"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1]);
    if (
      !articleNumber ||
      !sourceUrl ||
      !model ||
      !/brand\/109-superslot/.test(block) ||
      !new RegExp(`\\b${articleNumber}\\b`).test(model)
    )
      continue;
    const imageUrl = block.match(/<img[^>]*\ssrc\s*=\s*"([^"]+)"/)?.[1];
    // A full, unique model/livery title must agree. Matching digits alone never establish equivalence.
    const matches = scalextric.filter((c) => modelIdentity(c.model) === modelIdentity(model));
    const equivalent = matches.length === 1 ? matches[0] : null;
    const entry = {
      articleNumber,
      manufacturer: 'Superslot',
      brand: 'Superslot',
      model: model.slice(0, 240),
      scale: '1:32',
      series: 'SUPERSLOT',
      sourceUrl,
      imageUrl: trustedHornbyImage(imageUrl) ? imageUrl : null,
      img: null,
      importSource: 'superslot',
    };
    if (equivalent)
      entry.equivalence = {
        articleNumber: equivalent.articleNumber,
        method: 'exact-model-title',
        sources: [sourceUrl, equivalent.sourceUrl],
        checkedAt,
      };
    entries.push(entry);
  }
  if (!entries.length) throw new Error('Keine geprüften Superslot-Fahrzeuge gefunden.');
  return entries;
}
export async function importSuperslot(fetcher, scalextric) {
  let url = SUPERSLOT_SOURCE;
  const entries = [],
    seen = new Set();
  for (let n = 0; n < 30; n++) {
    if (seen.has(url)) break;
    seen.add(url);
    const html = await page(url, fetcher);
    entries.push(...superslotProducts(html, scalextric, new Date().toISOString()));
    const next = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).find((tag) => /rel="next"/.test(tag));
    if (!next) return [...new Map(entries.map((e) => [e.articleNumber, e])).values()];
    const href = text(next.match(/href="([^"]+)"/)?.[1]);
    const target = new URL(href, url);
    if (
      target.origin !== 'https://www.hobbymodelismo.es' ||
      target.pathname !== '/brand/109-superslot' ||
      !/^\?page=\d+$/.test(target.search)
    )
      throw new Error('Unbekannte Superslot-Folgeseite.');
    url = target.href;
  }
  throw new Error('Superslot-Produktseiten sind unvollständig.');
}
export async function importHornbyCatalog(fetcher) {
  const scalextric = await importScalextric(fetcher);
  const superslot = await importSuperslot(fetcher, scalextric);
  return [...scalextric, ...superslot];
}
export async function hornbyImage(url, fetcher) {
  const source = trustedHornbyImage(url);
  if (!source) throw new Error('Unzulässige Bildquelle.');
  return body(
    await fetcher(source, {
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
      headers: { Accept: 'image/webp,image/jpeg,image/png' },
    }),
    256 * 1024
  );
}
