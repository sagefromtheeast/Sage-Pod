// Sage Pod site: each demo replays a piece of the app while it is on screen.
// With reduced motion, demos show their finished state instead.
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Header hairline once the page scrolls.
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Waveform bars, as on Echo's "hours played" card.
  document.querySelectorAll('.bars i').forEach((bar, i) => {
    bar.style.animation = reduce ? 'none' : `bar ${1.4 + (i % 5) * 0.18}s ease-in-out ${-i * 0.21}s infinite alternate`;
    if (reduce) bar.style.transform = `scaleY(${0.35 + 0.6 * Math.abs(Math.sin(i * 0.9))})`;
  });
  const style = document.createElement('style');
  style.textContent = '@keyframes bar { from { transform: scaleY(.25); } to { transform: scaleY(1); } }';
  document.head.append(style);

  /** Runs `loop` while `el` is visible; `loop(alive)` checks alive() between steps. */
  function whileVisible(el, loop, finalState) {
    if (reduce) {
      finalState();
      return;
    }
    let running = false;
    let token = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        el.classList.toggle('is-live', entry.isIntersecting);
        if (entry.isIntersecting && !running) {
          running = true;
          const mine = ++token;
          const alive = () => mine === token && el.classList.contains('is-live');
          (async () => {
            while (alive()) await loop(alive);
            running = false;
          })();
        } else if (!entry.isIntersecting) {
          token++;
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
  }

  // Waveform panel only animates in view.
  const wave = document.querySelector('[data-demo="waveform"]');
  if (wave && !reduce) {
    new IntersectionObserver(([e]) => wave.classList.toggle('is-live', e.isIntersecting)).observe(wave);
  }

  // Add podcast by address: type a feed URL, then subscribe.
  const typing = document.querySelector('[data-demo="typing"]');
  if (typing) {
    const typed = typing.querySelector('.typed');
    const url = 'https://feeds.example.org/deep-time.xml';
    whileVisible(
      typing,
      async (alive) => {
        typing.classList.remove('is-done');
        typed.textContent = '';
        for (const ch of url) {
          if (!alive()) return;
          typed.textContent += ch;
          await wait(45 + Math.random() * 40);
        }
        await wait(500);
        typing.classList.add('is-done');
        await wait(2600);
      },
      () => {
        typed.textContent = url;
        typing.classList.add('is-done');
      }
    );
  }

  // Player: chapter segments fill, speed steps up, skip silence turns on.
  const player = document.querySelector('[data-demo="player"]');
  if (player) {
    const segs = [...player.querySelectorAll('.segments b')];
    const speed = player.querySelector('.speed');
    const chapter = player.querySelector('.chapter-text');
    const chapters = ['Cold open', 'A detour into deep time', 'Listener mail', 'What comes next'];
    whileVisible(
      player,
      async (alive) => {
        segs.forEach((s) => (s.style.width = '0%'));
        player.classList.remove('silence-on');
        speed.textContent = '1×';
        for (let i = 0; i < segs.length; i++) {
          chapter.textContent = chapters[i];
          if (i === 1) speed.textContent = '1.2×';
          if (i === 2) player.classList.add('silence-on');
          for (let p = 0; p <= 100; p += 4) {
            if (!alive()) return;
            segs[i].style.width = `${p}%`;
            await wait(36);
          }
        }
        await wait(1200);
      },
      () => {
        segs.slice(0, 2).forEach((s) => (s.style.width = '100%'));
        segs[2].style.width = '40%';
        speed.textContent = '1.2×';
        player.classList.add('silence-on');
        chapter.textContent = chapters[2];
      }
    );
  }

  // Inbox: swipe the top row into the queue, then drag-reorder the rest.
  const rows = document.querySelector('[data-demo="queue"]');
  if (rows) {
    whileVisible(
      rows,
      async (alive) => {
        rows.classList.remove('is-swiped', 'is-reordered');
        await wait(900);
        if (!alive()) return;
        rows.classList.add('is-swiped');
        await wait(1100);
        if (!alive()) return;
        rows.classList.add('is-reordered');
        await wait(2600);
      },
      () => rows.classList.add('is-swiped')
    );
  }

  // Download: fills, loses signal, resumes from where it stopped.
  const dl = document.querySelector('[data-demo="download"]');
  if (dl) {
    const status = dl.querySelector('.dl-status');
    const set = (p) => dl.style.setProperty('--p', String(p / 100));
    whileVisible(
      dl,
      async (alive) => {
        dl.classList.remove('is-done', 'is-paused');
        for (let p = 0; p <= 100; p += 2) {
          if (!alive()) return;
          if (p === 62) {
            dl.classList.add('is-paused');
            status.textContent = 'No connection · waiting at 62%';
            await wait(1600);
            dl.classList.remove('is-paused');
          }
          set(p);
          status.textContent = p === 100 ? 'Downloaded · 48 MB' : `Downloading · ${p}%`;
          await wait(70);
        }
        dl.classList.add('is-done');
        await wait(3200);
        set(0);
      },
      () => {
        set(100);
        status.textContent = 'Downloaded · 48 MB';
        dl.classList.add('is-done');
      }
    );
  }

  // Echo: story cards with the segmented progress bar.
  const echo = document.querySelector('[data-demo="echo"]');
  if (echo) {
    const cards = [...echo.querySelectorAll('.echo-card')];
    const bars = [...echo.querySelectorAll('.echo-progress span')];
    const CARD_MS = 3000;
    echo.style.setProperty('--card-ms', `${CARD_MS}ms`);
    const show = (n) => {
      cards.forEach((c, i) => c.classList.toggle('is-current', i === n));
      bars.forEach((b, i) => {
        b.classList.toggle('is-past', i < n);
        b.classList.remove('is-now');
      });
      void bars[n].offsetWidth; // restart the fill animation
      bars[n].classList.add('is-now');
    };
    whileVisible(
      echo,
      async (alive) => {
        for (let n = 0; n < cards.length; n++) {
          if (!alive()) return;
          show(n);
          await wait(CARD_MS);
        }
      },
      () => {
        cards.forEach((c, i) => c.classList.toggle('is-current', i === 1));
        bars.forEach((b, i) => b.classList.toggle('is-past', i <= 1));
      }
    );
  }
})();
