import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CarreraCatalog, articleNumber, productEntry, trustedImage } from '../lib/carreraCatalog.js';
import { tyreParts } from '../lib/carreraTyres.js';
const product = {
  title: 'Audi R8 LMS GT3',
  handle: '20031063-audi-r8',
  tags: ['Autos', 'DIGITAL 132'],
  variants: [{ sku: '20031063' }],
  images: [{ src: 'https://cdn.shopify.com/s/files/1/0944/1037/5507/files/test.jpg' }],
};
test('short/full article numbers match exactly; only actual cars and trusted image sources qualify', () => {
  assert.equal(articleNumber('31063'), '20031063');
  assert.equal(articleNumber('20031063'), '20031063');
  assert.equal(articleNumber('../31063'), null);
  const entry = productEntry(product, 'digital-132');
  assert.equal(entry.brand, 'Audi');
  assert.equal(entry.scale, '1:32');
  assert.equal(entry.year, undefined);
  assert.equal(productEntry({ ...product, tags: ['Sets', 'DIGITAL 132'] }, 'digital-132'), null);
  assert.equal(trustedImage('https://cdn.shopify.com.evil.test/s/files/1/0944/1037/5507/a.jpg'), null);
  assert.equal(trustedImage('http://127.0.0.1/a.jpg'), null);
});
test('catalogue update preserves archived models, caches images, works offline and never replaces old data after feed failure', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-test-'));
  let value = { version: 1, entries: [{ articleNumber: '20030000', model: 'Altmodell', img: null }] },
    calls = 0;
  const fetcher = async (url) => {
    calls++;
    return String(url).includes('products.json')
      ? new Response(JSON.stringify({ products: [product] }))
      : new Response(Buffer.from([255, 216, 255, 0, 1, 2]));
  };
  const c = new CarreraCatalog({
    uploads: folder,
    store: {
      get: async () => value,
      set: async (v) => {
        value = v;
      },
    },
    fetcher,
  });
  try {
    assert.equal(c.start(), true);
    assert.equal(c.start(), false);
    await c.completion;
    assert.equal(value.entries.length, 2);
    assert.equal((await c.status()).offlineImages, 1);
    assert.ok((await c.lookup('31063')).img);
    const downloaded = calls;
    c.fetcher = () => {
      throw new Error('offline');
    };
    assert.equal((await c.lookup('20031063')).model, 'Audi R8 LMS GT3');
    assert.equal(calls, downloaded);
    const old = JSON.stringify(value);
    c.start();
    await c.completion;
    assert.equal(c.job.phase, 'error');
    assert.equal(JSON.stringify(value), old);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});
test('tyre matching uses only explicit spare-parts block; no guesses from unrelated recommendations', () => {
  const card = (number, title) =>
    `<a href="/products/${number}-reifen"><div class="inside-products-inhaltose__title">${title}</div></a>`;
  const html =
    card('20088888', 'Hinterreifen') +
    `<collapsible-content id="product-ersatzteile-content">${card('20089800', 'tyres for Audi')}${card('20089801', 'Vorderreifen')}${card('20089802', 'Motor')}</collapsible-content>`;
  assert.deepEqual(
    tyreParts(html).map((p) => [p.articleNumber, p.axle]),
    [
      ['20089800', null],
      ['20089801', 'front'],
    ]
  );
  assert.throws(() => tyreParts(card('20088888', 'Reifen')));
  assert.deepEqual(tyreParts('<collapsible-content id="ersatzteile"></collapsible-content>'), []);
});
test('cache cleanup keeps product pictures used by saved cars and removes only unused generated cache', async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'catalog-protect-'));
  await fs.mkdir(path.join(folder, 'cars'));
  const filename = 'catalog-20031063-0000000000000000.jpg',
    old = '/api/img/cars/' + filename;
  await fs.writeFile(path.join(folder, 'cars', filename), 'old-generated-cache');
  let value = { version: 1, entries: [{ ...productEntry(product, 'digital-132'), img: old, imageVersion: 1 }] },
    protectedImages = [old];
  const c = new CarreraCatalog({
    uploads: folder,
    store: {
      get: async () => value,
      set: async (v) => {
        value = v;
      },
      usedImages: async () => protectedImages,
    },
    fetcher: async (url) =>
      String(url).includes('products.json')
        ? new Response(JSON.stringify({ products: [product] }))
        : new Response(Buffer.from([255, 216, 255, 0, 1, 2])),
  });
  try {
    c.start();
    await c.completion;
    assert.equal(c.job.phase, 'done');
    assert.notEqual(value.entries[0].img, old);
    await fs.stat(path.join(folder, 'cars', filename));
    protectedImages = [];
    c.start();
    await c.completion;
    await assert.rejects(fs.stat(path.join(folder, 'cars', filename)));
    assert.ok(await c.hasImage(value.entries[0].img));
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
});
