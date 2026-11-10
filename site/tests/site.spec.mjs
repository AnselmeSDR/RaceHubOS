// The site in a real browser: language, start lights, downloads, phones, pages without JavaScript.
// Run: npx playwright test -c site/playwright.config.mjs
import { expect, test } from '@playwright/test';
import { LANGS, loadTexts } from './texts.mjs';

const texts = loadTexts();
const normalize = (text) => text.replaceAll('&nbsp;', ' ').replace(/\s+/g, ' ').trim();

/** Each translated element: its key, the values filled in its text, and what it shows. */
const shownTexts = (page) =>
  page.$$eval('[data-i18n]', (elements) =>
    elements.map((el) => [
      el.dataset.i18n,
      el.dataset.vars ? JSON.parse(el.dataset.vars) : {},
      el.dataset.i18n.endsWith('Html') ? el.innerHTML : el.textContent,
    ])
  );

/** A text with its values filled in. */
const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, name) => vars[name]);

async function expectLanguage(page, lang) {
  await expect(page.locator('html')).toHaveAttribute('lang', lang);
  for (const [key, vars, text] of await shownTexts(page)) {
    expect(normalize(text), key).toBe(normalize(fill(texts[lang][key], vars)));
  }
  await expect(page.locator('[data-shot="race"]')).toHaveAttribute('src', `img/${lang}/race.webp`);
  await expect(page.locator(`[data-lang="${lang}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveTitle(texts[lang]['meta.title']);
}

test.describe('in German', () => {
  test.use({ locale: 'de-DE' });

  test("the page opens in the browser's language", async ({ page }) => {
    await page.goto('/');
    await expectLanguage(page, 'de');
  });

  test('the English text the page is written in never shows first: the page appears translated', async ({ page }) => {
    let release;
    const held = new Promise((resolve) => (release = resolve));
    await page.route('**/main.js', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'commit' });
    await page.locator('h1').waitFor({ state: 'attached' });
    await expect(page.locator('h1')).toBeHidden();
    release();
    await expectLanguage(page, 'de');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should a script fail, the page still shows, in English', async ({ page }) => {
    await page.route('**/main.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('h1')).toHaveText(texts.en['hero.title']);
  });

  test('?lang= wins over the browser language', async ({ page }) => {
    await page.goto('/?lang=fr');
    await expectLanguage(page, 'fr');
  });

  test('the language picked is applied everywhere and kept for the next visit', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-lang="fr"]').click();
    await expectLanguage(page, 'fr');
    await page.reload();
    await expectLanguage(page, 'fr');
  });
});

test.describe('in a language the site does not have', () => {
  test.use({ locale: 'es-ES' });

  test('the page falls back to English', async ({ page }) => {
    await page.goto('/');
    await expectLanguage(page, 'en');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the page reads in English, with the texts of the English dictionary', async ({ page }) => {
    await page.goto('/');
    for (const [key, vars, text] of await shownTexts(page)) {
      expect(normalize(text), key).toBe(normalize(fill(texts.en[key], vars)));
    }
  });
});

// Records how many start lights are lit each time that number changes
function recordLights(page) {
  return page.addInitScript(() => {
    window.litCounts = [];
    document.addEventListener('DOMContentLoaded', () => {
      const lights = document.querySelector('[data-lights]');
      new MutationObserver(() => {
        const lit = lights.querySelectorAll('.col.lit').length;
        if (lit !== (window.litCounts.at(-1) ?? 0)) window.litCounts.push(lit);
      }).observe(lights, { subtree: true, attributes: true });
    });
  });
}

const litCounts = (page) => page.evaluate(() => window.litCounts);
const ONE_START = [1, 2, 3, 4, 5, 0];

/** The codes of the cars drawn on the circuit behind the hero, the one furthest right first. */
const carsOnCircuit = (page) =>
  page.evaluate(() => {
    const canvas = document.querySelector('.circuit canvas');
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const found = [];
    for (const row of document.querySelectorAll('.row')) {
      // A car is a dot of the colour of its row: the middle of the dot has that exact colour
      const [r, g, b] = [1, 3, 5].map((at) =>
        parseInt(
          row.style
            .getPropertyValue('--c')
            .trim()
            .slice(at, at + 2),
          16
        )
      );
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] === 255) {
          sum += (i / 4) % canvas.width;
          count++;
        }
      }
      if (count) found.push({ code: row.querySelector('.who b').textContent, x: sum / count });
    }
    return found.sort((a, b) => b.x - a.x).map((car) => car.code);
  });
const circuitPicture = (page) => page.evaluate(() => document.querySelector('.circuit canvas').toDataURL());
const GRID = ['DAN', 'SDR', 'PEL', 'BOU', 'MIL', 'HAU'];

test('the start lights come on one by one, then all go out, and restarting the demo starts them again', async ({
  page,
}) => {
  await recordLights(page);
  await page.goto('/');
  await expect.poll(() => litCounts(page)).toEqual(ONE_START);
  await expect(page.locator('[data-lights]')).toBeHidden();
  await page.locator('[data-replay]').click();
  await expect.poll(() => litCounts(page)).toEqual([...ONE_START, ...ONE_START]);
});

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the board stays on the race written in the page until the visitor restarts it', async ({ page }) => {
    await recordLights(page);
    await page.goto('/');
    await expect.poll(() => carsOnCircuit(page)).toEqual(GRID);
    const still = await circuitPicture(page);
    await page.waitForTimeout(2600);
    expect(await litCounts(page)).toEqual([]);
    await expect(page.locator('[data-board-status]')).toHaveText(texts.en['board.paused']);
    await expect(page.locator('[data-lights]')).toBeHidden();
    // The cars behind the hero wait on the grid too
    expect(await circuitPicture(page)).toBe(still);
    await page.locator('[data-replay]').click();
    await expect.poll(() => litCounts(page)).toEqual(ONE_START);
  });
});

for (const [os, platform] of [
  ['mac', 'MacIntel'],
  ['windows', 'Win32'],
]) {
  test(`on ${os}, the ${os} download stands out and every download gives its installer`, async ({ page }) => {
    await page.addInitScript((value) => {
      Object.defineProperty(Navigator.prototype, 'platform', { get: () => value });
      Object.defineProperty(Navigator.prototype, 'userAgentData', { get: () => undefined });
    }, platform);
    await page.goto('/');
    for (const link of await page.locator('a[download]').all()) {
      const isPrimary = await link.evaluate((el) => el.classList.contains('primary'));
      expect(isPrimary).toBe((await link.getAttribute('data-os')) === os);
      const response = await page.request.get(await link.getAttribute('href'));
      expect(response.status()).toBe(200);
      expect((await response.body()).length).toBeGreaterThan(1000);
    }
  });
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  for (const lang of LANGS) {
    test(`the page never scrolls sideways (${lang})`, async ({ page }) => {
      await page.goto(`/?lang=${lang}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBe(0);
    });
  }
});

test('the page loads every file it asks for, with no error, and each menu link has its section', async ({ page }) => {
  const failures = [];
  page.on(
    'response',
    (response) => response.status() >= 400 && failures.push(`${response.status()} ${response.url()}`)
  );
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('console', (message) => message.type() === 'error' && failures.push(message.text()));
  await page.goto('/');
  for (const lang of LANGS) {
    await page.locator(`[data-lang="${lang}"]`).click();
    // Lazy screenshots load once scrolled into view
    for (const shot of await page.locator('[data-shot]').all()) {
      await shot.scrollIntoViewIfNeeded();
      await expect(shot).toHaveJSProperty('complete', true);
      expect(await shot.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    }
  }
  for (const href of await page.locator('.links a').evaluateAll((links) => links.map((a) => a.getAttribute('href')))) {
    await expect(page.locator(href)).toHaveCount(1);
  }
  expect(failures).toEqual([]);
});

test('the page opens in day mode, and night mode, once picked, is kept for the next visit, captures included', async ({
  page,
}) => {
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const toggle = page.locator('[data-theme-toggle]');
  const shots = page.locator('[data-shot]');
  // The captures of the app are in the theme of the page
  const expectShots = async (folder) => {
    for (const shot of await shots.all()) {
      await expect(shot).toHaveAttribute('src', `img/en/${folder}${await shot.getAttribute('data-shot')}.webp`);
    }
  };
  await page.goto('/');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(await background()).toBe('rgb(250, 250, 249)');
  await expectShots('');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await background()).toBe('rgb(9, 9, 11)');
  await expectShots('dark/');
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(await background()).toBe('rgb(9, 9, 11)');
  await expectShots('dark/');
  // A screen picked in the tour comes in the theme of the page too
  await page.locator('[data-screen="podium"]').click();
  await expect(page.locator('.tour .shot')).toHaveAttribute('src', 'img/en/dark/podium.webp');
  await toggle.click();
  await page.reload();
  expect(await background()).toBe('rgb(250, 250, 249)');
  await expectShots('');
});

test('the drivers and cars of the demo are cut out: the colour of their row shows around them', async ({ page }) => {
  await page.goto('/');
  // The top left pixel of each picture, as the browser draws it
  const corners = await page.$$eval('.row .face img, .row .livery', (pictures) =>
    Promise.all(
      pictures.map(async (picture) => {
        await picture.decode();
        const canvas = document.createElement('canvas');
        canvas.width = picture.naturalWidth;
        canvas.height = picture.naturalHeight;
        const pen = canvas.getContext('2d');
        pen.drawImage(picture, 0, 0);
        return { src: picture.getAttribute('src'), alpha: pen.getImageData(0, 0, 1, 1).data[3] };
      })
    )
  );
  expect(corners).toHaveLength(12);
  for (const { src, alpha } of corners) expect(alpha, src).toBe(0);
});

test.describe('the demo race', () => {
  test.use({ locale: 'fr-FR' });

  /** Rows of the leaderboard from first to last, as shown. */
  const shownOrder = (page) =>
    page.$$eval('.row', (rows) =>
      rows
        .map((row) => ({
          pos: Number(getComputedStyle(row).getPropertyValue('--pos')),
          place: row.dataset.place,
          shownPos: Number(row.querySelector('.pos').textContent),
          laps: Number(row.querySelector('[data-laps]').textContent),
          best: row.querySelector('[data-best]').textContent,
          fastest: row.querySelector('[data-best]').classList.contains('fastest'),
          gap: row.querySelector('[data-gap]').textContent,
          code: row.querySelector('.who b').textContent,
          face: row.querySelector('.face').innerHTML,
        }))
        .sort((a, b) => a.pos - b.pos)
    );

  /** What the gap column says for a car, as the app says it. */
  const expectedGap = (row, leader) => {
    if (row === leader) return texts.fr['board.leader'];
    const laps = leader.laps - row.laps;
    if (laps > 0) return fill(texts.fr[laps === 1 ? 'board.lapBehind' : 'board.lapsBehind'], { laps });
    return /^\+\d+\.\d{3}s$/;
  };

  test('the leaderboard counts laps, keeps its order, and ends on the podium before starting again', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(20000);

    const running = await shownOrder(page);
    expect(running.map((row) => row.shownPos)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(running.map((row) => row.place)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(running[0].laps).toBeGreaterThan(0);
    for (let i = 1; i < running.length; i++) expect(running[i].laps).toBeLessThanOrEqual(running[i - 1].laps);
    for (const row of running) {
      const gap = expectedGap(row, running[0]);
      if (gap instanceof RegExp) expect(row.gap, row.code).toMatch(gap);
      else expect(row.gap, row.code).toBe(gap);
    }
    // One best lap stands out: the fastest of all
    const bests = running.filter((row) => row.laps > 0).map((row) => Number(row.best));
    expect(running.filter((row) => row.fastest).map((row) => Number(row.best))).toEqual([Math.min(...bests)]);
    await expect(page.locator('[data-board-status]')).toHaveText(texts.fr['board.running']);

    // Half a second at a time up to the flag: the race is long enough to be watched, never longer than two minutes
    const podium = page.locator('[data-board-podium]');
    for (let waited = 0; (await podium.isHidden()) && waited < 120000; waited += 500) await page.clock.runFor(500);
    await expect(podium).toBeVisible();
    await expect(page.locator('[data-board-status]')).toHaveText(texts.fr['board.finished']);
    // As in the app, the leaderboard stays under the podium: its winner first, inside the window
    const below = await podium.boundingBox();
    const appWindow = await page.locator('.app-main').boundingBox();
    const winnerRow = page.locator('.row[data-place="1"]');
    await expect(winnerRow).toBeVisible();
    await expect.poll(async () => (await winnerRow.boundingBox()).y).toBeGreaterThanOrEqual(below.y + below.height);
    expect((await winnerRow.boundingBox()).y).toBeLessThan(appWindow.y + appWindow.height);
    const finish = await shownOrder(page);
    for (const [index, place] of ['first', 'second', 'third'].entries()) {
      await expect(podium.locator(`.${place} > b`)).toHaveText(finish[index].code);
      // The podium shows the same photo or initial as the leaderboard
      expect(await podium.locator(`.${place} .face`).innerHTML()).toBe(finish[index].face);
      await expect(podium.locator(`.${place} .count`)).toHaveText(
        fill(texts.fr['podium.laps'], { laps: finish[index].laps })
      );
    }

    await page.clock.runFor(7500);
    await expect(podium).toBeHidden();
    await expect(page.locator('[data-board-status]')).toHaveText(texts.fr['board.ready']);
  });

  test('behind the hero, the cars of the board wait on the grid, race round the circuit and park in their finishing order', async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(1000);
    // On the grid in the order of the rows, the first one nearest the line, and still while the lights come on
    expect(await carsOnCircuit(page)).toEqual(GRID);
    const grid = await circuitPicture(page);
    await page.clock.runFor(2000);
    expect(await circuitPicture(page)).toBe(grid);

    await page.clock.runFor(3000);
    await expect(page.locator('[data-board-status]')).toHaveText(texts.fr['board.running']);
    const racing = await circuitPicture(page);
    expect(racing).not.toBe(grid);
    await page.clock.runFor(500);
    expect(await circuitPicture(page)).not.toBe(racing);

    const podium = page.locator('[data-board-podium]');
    for (let waited = 0; (await podium.isHidden()) && waited < 120000; waited += 500) await page.clock.runFor(500);
    await expect(podium).toBeVisible();
    // Past the line, the winner furthest on, then the others in the order of the board
    const finish = (await shownOrder(page)).map((row) => row.code);
    expect(await carsOnCircuit(page)).toEqual(finish);
    const parked = await circuitPicture(page);
    await page.clock.runFor(2000);
    expect(await circuitPicture(page)).toBe(parked);
  });
});

test.describe('in French', () => {
  test.use({ locale: 'fr-FR' });

  test('a tab of the screens shows that screen, in the language of the page', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-screen="podium"]').click();
    const screen = page.locator('.tour .shot');
    await expect(screen).toHaveAttribute('src', 'img/fr/podium.webp');
    await expect(screen).toHaveAttribute('alt', texts.fr['shot.podium']);
    await expect(page.locator('[data-screen="podium"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-screen="race"]')).toHaveAttribute('aria-selected', 'false');
    await page.locator('[data-lang="de"]').click();
    await expect(screen).toHaveAttribute('src', 'img/de/podium.webp');
    await expect(screen).toHaveAttribute('alt', texts.de['shot.podium']);
  });

  test('the arrow keys move from one screen to the next, and wrap around', async ({ page }) => {
    await page.goto('/');
    const screen = page.locator('.tour .shot');
    await page.locator('[data-screen="race"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-screen="podium"]')).toBeFocused();
    await expect(page.locator('[data-screen="podium"]')).toHaveAttribute('aria-selected', 'true');
    await expect(screen).toHaveAttribute('src', 'img/fr/podium.webp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('[data-screen="addons"]')).toBeFocused();
    await expect(screen).toHaveAttribute('src', 'img/fr/addons.webp');
    // Only the selected tab is reached with Tab
    expect(await page.locator('[role="tab"][tabindex="0"]').count()).toBe(1);
  });

  test('the voice reads its announcement in the language of the page', async ({ page }) => {
    await page.addInitScript(() => {
      window.spoken = [];
      speechSynthesis.speak = (utterance) => window.spoken.push({ text: utterance.text, lang: utterance.lang });
    });
    await page.goto('/');
    await page.locator('[data-voice-button]').click();
    expect(await page.evaluate(() => window.spoken)).toEqual([{ text: texts.fr['voice.sample'], lang: 'fr-FR' }]);
  });
});
