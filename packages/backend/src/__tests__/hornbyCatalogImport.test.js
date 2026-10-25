import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  importScalextric,
  importSuperslot,
  scalextricProduct,
  superslotProducts,
  trustedHornbyImage,
} from '../lib/hornbyCatalogImport.js';
import { CarreraCatalog } from '../lib/carreraCatalog.js';
const c = {
  pid: 'C4597',
  title: 'Volvo 850 Estate - BTCC 1994 - Rickard Rydell',
  url: 'https://uk.scalextric.com/products/volvo-c4597',
  product_item_scale: '1:32 Scale',
  thumb_image_markup: '<img src="https://d63oxfkn1m8sf.cloudfront.net/315x194/v2/1/car.jpg%3Ffit%3D1">',
};
const h = (title = 'Volvo 850 Estate - BTCC 1994 - Rickard Rydell', ref = 'H4597', category = 'coches-superslot') =>
  `<article><p class="pl_reference">Referencia: <b>SS${ref}</b></p><a href="https://www.hobbymodelismo.es/${category}/123-car.html" class="thumbnail product-thumbnail"><img src = "https://www.hobbymodelismo.es/123-home_default/car.jpg"></a><a href="/brand/109-superslot">SUPERSLOT</a><h3 class="h3 product-title"><a>${title} - Superslot ${ref}</a></h3></article>`;
const list = (content) => `<div id="js-product-list">${content}</div>`;
test('only 1:32 single cars, verified public sources and bounded thumbnails qualify', () => {
  assert.ok(scalextricProduct(c));
  for (const changed of [
    { pid: 'W1234' },
    { title: 'Volvo Twin Car Set' },
    { product_item_scale: '1:64 Scale' },
    { url: 'https://evil.test/products/car' },
  ])
    assert.equal(scalextricProduct({ ...c, ...changed }), null);
  assert.equal(trustedHornbyImage('http://127.0.0.1/image.jpg'), null);
  assert.equal(trustedHornbyImage('https://d63oxfkn1m8sf.cloudfront.net.evil.test/image.jpg'), null);
  assert.equal(trustedHornbyImage('https://www.hobbymodelismo.es/customer/export'), null);
  assert.ok(trustedHornbyImage(scalextricProduct(c).imageUrl));
});
test('H/C equivalence needs a unique full model/livery match; digits never establish identity', () => {
  const cars = [scalextricProduct(c)];
  const result = superslotProducts(h('Unrelated sidebar', 'H4000') + list(h()), cars, '2026-10-22');
  assert.equal(result.length, 1);
  assert.equal(result[0].equivalence.articleNumber, 'C4597');
  assert.equal(result[0].equivalence.sources.length, 2);
  assert.equal(
    superslotProducts(list(h('Volvo 850 Estate - BTCC 1995 - Another driver')), cars, 'now')[0].equivalence,
    undefined
  );
  assert.equal(
    superslotProducts(list(h()), [...cars, { ...cars[0], articleNumber: 'C4598' }], 'now')[0].equivalence,
    undefined
  );
  assert.throws(() => superslotProducts(list(h(c.title, 'H4597', 'spares')), cars, 'now'));
});
test('Scalextric pagination is complete, deduplicable and rejects truncated/changing feeds', async () => {
  const html =
    '<body data-br-account="6723" data-br-auth-key="public-browser-key"><div data-domain="hornby_en_scalextric"><input name="filters[mandatory_filter_by][product_headless_category]" value="Cars">';
  let pages = 0;
  const fetcher = async (url) => {
    if (String(url).includes('/catalogue/cars')) return new Response(html);
    const u = new URL(url);
    assert.equal(u.hostname, 'core.dxpapi.com');
    assert.equal(u.searchParams.get('q'), 'Cars');
    pages++;
    const start = Number(u.searchParams.get('start'));
    return new Response(
      JSON.stringify({
        response: {
          numFound: 101,
          start,
          docs: start === 0 ? Array.from({ length: 100 }, (_, i) => ({ ...c, pid: `C${4000 + i}` })) : [c],
        },
      })
    );
  };
  assert.equal((await importScalextric(fetcher)).length, 101);
  assert.equal(pages, 2);
  await assert.rejects(
    importScalextric(async (url) =>
      String(url).includes('/catalogue/cars')
        ? new Response(html)
        : new Response(JSON.stringify({ response: { numFound: 101, start: 0, docs: [c] } }))
    ),
    /unvollständig/
  );
});
test('Superslot follows only valid next pages and fails closed on foreign links', async () => {
  let calls = 0;
  const entries = await importSuperslot(
    async () =>
      new Response(
        list(h(c.title, ++calls === 1 ? 'H4597' : 'H4607')) +
          (calls === 1 ? '<a rel="next" href="https://www.hobbymodelismo.es/brand/109-superslot?page=2">Next</a>' : '')
      ),
    [scalextricProduct(c)]
  );
  assert.equal(calls, 2);
  assert.equal(entries.length, 2);
  await assert.rejects(
    importSuperslot(async () => new Response(list(h()) + '<a rel="next" href="https://evil.test">Next</a>'), [])
  );
});
test('single update includes additional brands, caches their images, preserves tyres and fails atomically', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hornby-update-'));
  let value = {
    version: 1,
    entries: [
      { articleNumber: 'C4597', tyres: { archived: true, parts: [{ articleNumber: 'W12345' }] }, model: 'previous' },
    ],
  };
  let broken = false;
  const catalog = new CarreraCatalog({
    uploads: dir,
    store: {
      get: async () => value,
      set: async (v) => {
        value = v;
      },
    },
    additionalImporter: async () => {
      if (broken) throw Error('Superslot unavailable');
      return [scalextricProduct(c), ...superslotProducts(list(h()), [scalextricProduct(c)], 'now')];
    },
    fetcher: async (url) =>
      String(url).includes('products.json')
        ? new Response(JSON.stringify({ products: [] }))
        : new Response(Buffer.from([255, 216, 255, 1, 2])),
  });
  try {
    catalog.start();
    await catalog.completion;
    assert.equal(catalog.job.phase, 'done');
    assert.equal((await catalog.status()).offlineImages, 2);
    assert.deepEqual((await catalog.status()).manufacturers, { Scalextric: 1, Superslot: 1 });
    assert.equal((await catalog.lookup('C4597')).tyres.parts[0].articleNumber, 'W12345');
    assert.equal((await catalog.lookup('H4597')).equivalence.articleNumber, 'C4597');
    const previous = JSON.stringify(value);
    broken = true;
    catalog.start();
    await catalog.completion;
    assert.equal(catalog.job.phase, 'error');
    assert.equal(JSON.stringify(value), previous);
    catalog.fetcher = () => {
      throw Error('offline');
    };
    assert.ok((await catalog.lookup('H4597')).img);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('lazy picture cards use the actual img thumbnail, not placeholders or srcset lists', () => {
  const url = 'https://d63oxfkn1m8sf.cloudfront.net/315x194/v2/1/car.jpg%3Ffit%3D1';
  const lazy = {
    ...c,
    thumb_image_markup: `<picture><source data-src="${url} 1x, ${url} 2x"><img loading="lazy" src="data:image/svg+xml,placeholder" data-src="${url}"></picture>`,
  };
  assert.equal(scalextricProduct(lazy).imageUrl, url);
  assert.equal(
    scalextricProduct({
      ...lazy,
      thumb_image_markup: '<img src="data:image/svg+xml,placeholder" data-src="https://evil.test/car.jpg">',
    }).imageUrl,
    null
  );
});
