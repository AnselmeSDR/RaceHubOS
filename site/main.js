(function () {
  'use strict';

  const TEXTS = window.RACEHUBOS_TEXTS;
  const LANGS = Object.keys(TEXTS);
  const FALLBACK = 'en';
  const LANG_KEY = 'racehubos-site-lang';
  const SPEECH_LANGS = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Each language has its page, written in it at build: English at the root of the site, the others in a folder
  const lang = LANGS.includes(document.documentElement.lang) ? document.documentElement.lang : FALLBACK;
  const ROOT = document.documentElement.dataset.root || '';

  /** Keeps a choice of the visitor for the next visit; read back by the script in the head of the page. */
  function remember(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private mode: kept for this page only
    }
  }

  /** A text in the page's language, with its values filled in. */
  const t = (key, vars) => TEXTS[lang][key].replace(/\{(\w+)\}/g, (_, name) => (vars ? vars[name] : ''));

  /** A translated text, its key kept on the element as for the texts written at build. */
  function setText(el, key, vars) {
    el.dataset.i18n = key;
    if (vars) el.dataset.vars = JSON.stringify(vars);
    else delete el.dataset.vars;
    el.textContent = t(key, vars);
  }

  /** A text that is not translated: a time, a gap. */
  function setRaw(el, text) {
    delete el.dataset.i18n;
    delete el.dataset.vars;
    el.textContent = text;
  }

  // ---------- Language ----------

  /** A capture of the app in the language and the theme of the page. */
  const shotSrc = (shot) =>
    `${ROOT}img/${lang}/${document.documentElement.dataset.theme === 'dark' ? 'dark/' : ''}${shot}.webp`;
  const showShots = () =>
    document.querySelectorAll('[data-shot]').forEach((img) => {
      img.src = shotSrc(img.dataset.shot);
    });

  // The language picked is kept: the English page sends the next visit to it. The visitor stays where they were.
  document.querySelectorAll('[data-lang]').forEach((link) => {
    link.addEventListener('click', () => {
      remember(LANG_KEY, link.dataset.lang);
      link.hash = location.hash;
    });
  });

  // ---------- Day or night mode, as in the app; the page opens in day mode ----------

  const THEME_KEY = 'racehubos-site-theme';
  const themeButton = document.querySelector('[data-theme-toggle]');

  function setTheme(dark) {
    const root = document.documentElement;
    if (dark) root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    themeButton.setAttribute('aria-pressed', String(dark));
    document.querySelector('meta[name="theme-color"]').content = dark ? '#09090b' : '#fafaf9';
    document.querySelector('meta[name="color-scheme"]').content = dark ? 'dark' : 'light';
    showShots();
  }

  setTheme(document.documentElement.dataset.theme === 'dark');
  themeButton.addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    remember(THEME_KEY, dark ? 'dark' : 'light');
    setTheme(dark);
  });

  // ---------- Downloads: the visitor's system gets the filled button ----------

  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  const os = /mac/i.test(platform) ? 'mac' : 'windows';
  document.querySelectorAll(`[data-os="${os}"]`).forEach((link) => link.classList.add('primary'));

  // ---------- Audience: visits and downloads counted anonymously, without cookies (GoatCounter) ----------

  const COUNTER = 'https://racehubos.goatcounter.com/count';
  // Not on a copy of the site served from this computer, nor for a visitor who asks not to be tracked
  const counting =
    !['localhost', '127.0.0.1', ''].includes(location.hostname) &&
    navigator.doNotTrack !== '1' &&
    !navigator.globalPrivacyControl;

  /** Counts the visit of a page, or an event: its name in place of a page. */
  function count(path, event) {
    if (!counting) return;
    const params = new URLSearchParams({ p: path, rnd: Math.random().toString(36).slice(2) });
    if (event) params.set('e', 'true');
    else {
      params.set('t', document.title);
      if (document.referrer) params.set('r', document.referrer);
    }
    new Image().src = `${COUNTER}?${params}`;
  }

  count(location.pathname);
  document.querySelectorAll('a[download]').forEach((link) => {
    link.addEventListener('click', () => count(`download-${link.dataset.os}-${lang}`, true));
  });

  // ---------- Demo race: the start lights, then the leaderboard of the app, then its podium ----------

  const board = document.querySelector('.app-main');
  const rows = [...board.querySelectorAll('.row')];
  const statusEl = board.querySelector('[data-board-status]');
  const clockEl = board.querySelector('[data-board-clock]');
  const lapEl = board.querySelector('[data-board-lap]');
  const progressEl = board.querySelector('[data-board-progress]');
  const podiumEl = board.querySelector('[data-board-podium]');
  const lightsEl = board.querySelector('[data-lights]');
  const columns = [...lightsEl.querySelectorAll('.col')];
  const lightsCount = lightsEl.querySelector('[data-lights-count]');

  const TOTAL_LAPS = 8;
  const SPEED = 1.8; // seconds of race per second on screen
  const BEAT = 600; // between two start lights
  // Pace of each car, in the order of the rows: the grid
  const PACES = [7.8, 7.83, 7.9, 7.97, 8.05, 8.15];
  const STATUS = { ready: 'board.ready', race: 'board.running', podium: 'board.finished' };
  const CHIP = { ready: 'ready', race: 'running', podium: 'finished' };

  /** The next lap of a car: its pace give or take, and now and then a car off the slot to put back. */
  function planLap(car) {
    car.deslot = Math.random() < 0.06 ? 2.2 + Math.random() * 1.6 : 0;
    car.clean = (car.pace + (Math.random() - 0.5) * 0.3) * (car.laps === 0 ? 1.08 : 1);
    car.next = car.crosses.at(-1) + car.clean + car.deslot;
  }
  const seconds = (s) => s.toFixed(3);
  const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const gapTone = (s) => (s < 1 ? 'close' : s < 5 ? 'medium' : 'far');

  let cars = [];
  let raceTime = 0;
  let bestLap = Infinity;
  let phase = 'paused';
  let leaderDoneAt = null;
  let timers = [];
  let frame = null;
  let lastFrame = 0;
  let visible = true;

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function resetCars() {
    raceTime = 0;
    bestLap = Infinity;
    leaderDoneAt = null;
    cars = rows.map((row, index) => ({
      row,
      color: row.style.getPropertyValue('--c').trim(),
      code: row.querySelector('.code').textContent,
      pace: PACES[index],
      grid: index,
      index: undefined,
      laps: 0,
      crosses: [0],
      last: null,
      best: null,
      done: false,
    }));
    cars.forEach(planLap);
    for (const delta of board.querySelectorAll('[data-delta]')) delta.replaceChildren();
  }

  const standings = () => [...cars].sort((a, b) => b.laps - a.laps || a.crosses.at(-1) - b.crosses.at(-1));

  /** Places won or lost, next to the position, as in the app. */
  function showDelta(car, change) {
    const delta = car.row.querySelector('[data-delta]');
    delta.className = `delta ${change > 0 ? 'gained' : 'lost'}`;
    delta.innerHTML = `<svg class="i" aria-hidden="true"><use href="#i-arrow-${change > 0 ? 'up' : 'down'}" /></svg>`;
    delta.append(String(Math.abs(change)));
    clearTimeout(car.deltaTimer);
    car.deltaTimer = setTimeout(() => delta.replaceChildren(), 2500);
  }

  function setGap(car, leader) {
    const gap = car.row.querySelector('[data-gap]');
    if (car === leader) {
      setText(gap, 'board.leader');
      gap.className = 'leader';
    } else if (car.laps < leader.laps) {
      const laps = leader.laps - car.laps;
      setText(gap, laps === 1 ? 'board.lapBehind' : 'board.lapsBehind', { laps });
      gap.className = 'lapped';
    } else if (car.laps === 0) {
      setRaw(gap, '--');
      gap.className = '';
    } else {
      const behind = car.crosses[car.laps] - leader.crosses[car.laps];
      setRaw(gap, `+${seconds(behind)}s`);
      gap.className = gapTone(behind);
    }
  }

  function render() {
    const order = standings();
    const leader = order[0];
    order.forEach((car, index) => {
      const { row } = car;
      if (car.index !== index) {
        if (car.index !== undefined) {
          row.classList.toggle('up', index < car.index);
          if (phase === 'race') showDelta(car, car.index - index);
        }
        car.index = index;
      }
      row.style.setProperty('--pos', index);
      row.dataset.place = index + 1;
      row.querySelector('.pos').textContent = index + 1;
      row.querySelector('[data-laps]').textContent = car.laps;
      const best = row.querySelector('[data-best]');
      best.textContent = car.best ? seconds(car.best) : '--';
      best.classList.toggle('fastest', car.best !== null && car.best === bestLap);
      row.querySelector('[data-last]').textContent = car.last ? seconds(car.last) : '--';
      setGap(car, leader);
    });
    setRaw(clockEl, clock(raceTime));
    setText(lapEl, 'board.lap', { lap: Math.min(leader.laps + 1, TOTAL_LAPS), total: TOTAL_LAPS });
    progressEl.style.setProperty('--p', Math.min(leader.laps / TOTAL_LAPS, 1));
    drawCircuit();
  }

  function setPhase(next) {
    phase = next;
    setText(statusEl, STATUS[next]);
    statusEl.dataset.state = CHIP[next];
  }

  function step(dt) {
    raceTime += dt * SPEED;
    for (const car of cars) {
      while (!car.done && car.next <= raceTime) {
        const time = car.next - car.crosses.at(-1);
        car.laps += 1;
        car.crosses.push(car.next);
        car.last = time;
        car.best = car.best === null ? time : Math.min(car.best, time);
        bestLap = Math.min(bestLap, time);
        // Once the leader is home, each car finishes as it crosses the line
        if (car.laps >= TOTAL_LAPS || leaderDoneAt !== null) {
          car.done = true;
          if (leaderDoneAt === null) leaderDoneAt = car.next;
        } else {
          planLap(car);
        }
      }
    }
    render();
    if (leaderDoneAt !== null && (cars.every((car) => car.done) || raceTime > leaderDoneAt + 8)) showPodium();
  }

  function loop(now) {
    frame = null;
    if (phase !== 'race') return;
    const dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    step(dt);
    if (visible) frame = requestAnimationFrame(loop);
  }

  function resume() {
    if (phase !== 'race' || frame || !visible) return;
    lastFrame = performance.now();
    frame = requestAnimationFrame(loop);
  }

  function showPodium() {
    setPhase('podium');
    const order = standings();
    const winner = order[0];
    ['first', 'second', 'third'].forEach((name, index) => {
      const car = order[index];
      const place = podiumEl.querySelector(`.${name}`);
      place.style.setProperty('--c', car.color);
      const face = car.row.querySelector('.face');
      place.querySelector('.face').replaceChildren(...[...face.childNodes].map((node) => node.cloneNode(true)));
      place.querySelector('b').textContent = car.code;
      if (index > 0) {
        const behind = place.querySelector('.behind');
        const laps = winner.laps - car.laps;
        if (laps > 0) setText(behind, laps === 1 ? 'board.lapBehind' : 'board.lapsBehind', { laps });
        else setRaw(behind, `+${seconds(car.crosses.at(-1) - winner.crosses.at(-1))}s`);
      }
      place.querySelector('.fast').textContent = `${seconds(car.best)}s`;
      setText(place.querySelector('.count'), 'podium.laps', { laps: car.laps });
    });
    podiumEl.hidden = false;
    drawCircuit();
    later(startRace, 7000);
  }

  function showLights(lit) {
    columns.forEach((column, index) => column.classList.toggle('lit', index < lit));
    lightsCount.textContent = Math.max(lit, 1);
  }

  /** The five lights come on one by one, then all go out: green, the race is on. */
  function startRace() {
    timers.forEach(clearTimeout);
    timers = [];
    podiumEl.hidden = true;
    resetCars();
    setPhase('ready');
    render();
    showLights(0);
    lightsEl.classList.remove('go', 'out');
    lightsEl.hidden = false;
    for (let lit = 1; lit <= columns.length; lit++) later(() => showLights(lit), BEAT * lit);
    const go = BEAT * (columns.length + 1) + 300;
    later(() => {
      showLights(0);
      lightsEl.classList.add('go');
      setPhase('race');
      resume();
    }, go);
    later(() => lightsEl.classList.add('out'), go + 900);
    later(() => {
      lightsEl.hidden = true;
    }, go + 1400);
  }

  // ---------- The circuit behind the hero: the cars of the demo race run on it ----------

  const circuit = document.querySelector('.circuit');
  const lapPath = circuit.querySelector('[data-lap]');
  const canvas = circuit.querySelector('canvas');
  const pen = canvas.getContext('2d');
  const VIEW = { width: 1600, height: 900 }; // the viewBox of the circuit
  const LINE = 160; // the finish line, along the lap
  const LANE = 8.5; // each slot, from the middle of the road
  const STEP = 2; // between two points of the lap
  let points = [];
  let lap = 0;
  let view = null;

  /** Where a distance along the lap lies, in one slot or the other, or off the road. */
  function spot(distance, side) {
    const at = (((distance % lap) + lap) % lap) / STEP;
    const index = Math.floor(at);
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const x = a.x + dx * (at - index);
    const y = a.y + dy * (at - index);
    return [x + (dy / length) * side, y - (dx / length) * side];
  }

  /** How far round a car is, how long its trail is, and whether it is off the slot. */
  function placeOf(car, rank) {
    const gridSpot = LINE - 24 - car.grid * 26;
    const parkedSpot = LINE + 40 + (cars.length - 1 - rank) * 26;
    if (phase === 'podium') return { distance: parkedSpot, trail: 0 };
    if (phase !== 'race') return { distance: gridSpot, trail: 0 };
    const speed = lap / car.pace; // along the lap, per second of race
    if (car.done) {
      // Past the line, the car slows down and lines up in its finishing order
      const ahead = parkedSpot - LINE;
      const time = (3 * ahead) / speed;
      const left = 1 - Math.min((raceTime - car.crosses.at(-1)) / time, 1);
      return { distance: parkedSpot - ahead * left ** 3, trail: 40 * left ** 2 };
    }
    const from = car.laps ? LINE : gridSpot;
    const stop = car.clean * 0.55;
    const run = raceTime - car.crosses.at(-1);
    const off = car.deslot > 0 && run > stop && run < stop + car.deslot;
    const driven = run > stop ? Math.max(stop, run - car.deslot) : run;
    return {
      distance: from + (LINE + lap - from) * Math.min(driven / car.clean, 1),
      trail: off ? 0 : 66,
      off,
    };
  }

  function drawCircuit() {
    if (!view) return;
    const { scale, x, y, ratio } = view;
    pen.setTransform(1, 0, 0, 1, 0, 0);
    pen.clearRect(0, 0, canvas.width, canvas.height);
    pen.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * x, ratio * y);
    const ring = getComputedStyle(circuit).getPropertyValue('--app-bg').trim();
    const placed = standings().map((car, rank) => ({
      car,
      side: (phase === 'podium' ? rank : car.grid) % 2 ? LANE : -LANE,
      ...placeOf(car, rank),
    }));
    // A trail fading behind each car, then the cars on top of every trail
    pen.lineCap = 'butt';
    for (const { car, side, distance, trail } of placed) {
      pen.strokeStyle = car.color;
      for (let piece = 0; piece < trail; piece += 6) {
        const fade = 1 - piece / trail;
        pen.globalAlpha = 0.5 * fade;
        pen.lineWidth = 2 + 5 * fade;
        pen.beginPath();
        pen.moveTo(...spot(distance - piece, side));
        pen.lineTo(...spot(distance - piece - 6, side));
        pen.stroke();
      }
    }
    for (const { car, side, distance, off } of placed) {
      // Off the slot, the car lies beside the road, on the outside
      const [cx, cy] = spot(distance, off ? 34 : side);
      pen.globalAlpha = off ? 0.6 : 1;
      pen.beginPath();
      pen.arc(cx, cy, 8, 0, Math.PI * 2);
      pen.fillStyle = car.color;
      pen.fill();
      pen.lineWidth = 3;
      pen.strokeStyle = ring;
      pen.stroke();
    }
    pen.globalAlpha = 1;
  }

  /** The canvas covers the hero as the circuit does: scaled to fill it, centred. */
  function fitCircuit() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) {
      view = null;
      return;
    }
    if (!lap) {
      lap = lapPath.getTotalLength();
      points = Array.from({ length: Math.round(lap / STEP) }, (_, index) => lapPath.getPointAtLength(index * STEP));
    }
    const ratio = devicePixelRatio || 1;
    const scale = Math.max(width / VIEW.width, height / VIEW.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    view = { scale, ratio, x: (width - VIEW.width * scale) / 2, y: (height - VIEW.height * scale) / 2 };
    drawCircuit();
  }

  new ResizeObserver(fitCircuit).observe(circuit);
  themeButton.addEventListener('click', drawCircuit);

  board.querySelector('[data-replay]').addEventListener('click', startRace);

  // The race only runs while it can be seen
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && !document.hidden;
    resume();
  }).observe(board);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    resume();
  });

  // ---------- Voice announcement ----------

  const voiceButton = document.querySelector('[data-voice-button]');
  const voiceItem = voiceButton.closest('li');
  if (!('speechSynthesis' in window)) voiceButton.hidden = true;
  voiceButton.addEventListener('click', () => {
    const utterance = new SpeechSynthesisUtterance(t('voice.sample'));
    utterance.lang = SPEECH_LANGS[lang];
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voice) utterance.voice = voice;
    utterance.onend = utterance.onerror = () => voiceItem.classList.remove('speaking');
    speechSynthesis.cancel();
    voiceItem.classList.add('speaking');
    speechSynthesis.speak(utterance);
  });

  // ---------- Tour of the screens ----------

  const screen = document.querySelector('.tour .shot');
  const tabs = [...document.querySelectorAll('[data-screen]')];

  function select(tab) {
    tabs.forEach((other) => {
      other.setAttribute('aria-selected', String(other === tab));
      other.tabIndex = other === tab ? 0 : -1;
    });
    screen.dataset.shot = tab.dataset.screen;
    screen.setAttribute('data-i18n-alt', `shot.${tab.dataset.screen}`);
    screen.src = shotSrc(tab.dataset.screen);
    screen.alt = t(`shot.${tab.dataset.screen}`);
  }

  tabs.forEach((tab) => {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    tab.addEventListener('click', () => {
      if (document.startViewTransition && !reducedMotion) document.startViewTransition(() => select(tab));
      else select(tab);
    });
  });

  // Arrow keys move between the tabs, as in any tab list
  tabs[0].parentElement.addEventListener('keydown', (event) => {
    const move = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    const index = tabs.indexOf(document.activeElement);
    if (!move || index < 0) return;
    event.preventDefault();
    const next = tabs[(index + move + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });

  // With reduced motion the board keeps the race shown in the page, until the visitor restarts it
  resetCars();
  if (!reducedMotion) startRace();
})();
