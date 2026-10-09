(() => {
  // ============== Sorting (existing) ==============
  const grid = document.getElementById('grid');
  const sort = document.getElementById('sort');
  if (grid && sort) {
    const getSortValue = (el, mode) => {
      const pub = el.querySelector('.meta-item:nth-of-type(2)')?.textContent || '';
      const cap = el.querySelector('.meta-item')?.textContent || '';
      const title = el.querySelector('.title')?.textContent || '';
      if (mode === 'title') return title.toLowerCase();
      if (mode === 'published-desc') return pub;
      return cap;
    };
    sort.addEventListener('change', () => {
      const mode = sort.value;
      const cards = Array.from(grid.querySelectorAll('.card'));
      cards.sort((a, b) => {
        const av = getSortValue(a, mode);
        const bv = getSortValue(b, mode);
        if (mode === 'title') return av.localeCompare(bv);
        if (mode === 'date-asc') return av.localeCompare(bv);
        return bv.localeCompare(av);
      });
      cards.forEach((c) => grid.appendChild(c));
    });
  }

  // ============== Copy buttons ==============
  let toastTimer = null;
  function showToast(text) {
    let el = document.getElementById('copy-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'copy-toast';
      el.className = 'copy-toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through */ }
    // Fallback: temp textarea
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    e.preventDefault();
    const text = btn.dataset.copy || '';
    if (!text) return;
    const ok = await copyText(text);
    showToast(ok ? `已複製：${text.length > 60 ? text.slice(0, 60) + '…' : text}` : '複製失敗');
    btn.classList.add('flash');
    setTimeout(() => btn.classList.remove('flash'), 600);
  });

  // ============== Favorites + Watched (localStorage) ==============
  const STORAGE_KEY = 'ds.userState.v1';

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        favorites: new Set(raw.favorites || []),
        watched: new Set(raw.watched || [])
      };
    } catch {
      return { favorites: new Set(), watched: new Set() };
    }
  }

  function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      favorites: [...s.favorites],
      watched: [...s.watched]
    }));
  }

  function urlOf(card) {
    return card?.dataset?.url || '';
  }

  const state = loadState();

  // Wire all buttons
  const allCards = document.querySelectorAll('.card');
  allCards.forEach((card) => {
    const url = urlOf(card);
    if (!url) return;
    const favBtn = card.querySelector('[data-act="favorite"]');
    const watchBtn = card.querySelector('[data-act="watched"]');
    applyBtnState(favBtn, state.favorites.has(url), '★', '☆');
    applyBtnState(watchBtn, state.watched.has(url), '✓', '○');

    favBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSet(state.favorites, url);
      saveState(state);
      applyBtnState(favBtn, state.favorites.has(url), '★', '☆');
      card.classList.toggle('is-favorite', state.favorites.has(url));
      updateCounters();
    });
    watchBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSet(state.watched, url);
      saveState(state);
      applyBtnState(watchBtn, state.watched.has(url), '✓', '○');
      card.classList.toggle('is-watched', state.watched.has(url));
      updateCounters();
    });

    // initial visual state
    if (state.favorites.has(url)) card.classList.add('is-favorite');
    if (state.watched.has(url)) card.classList.add('is-watched');
  });

  function toggleSet(set, key) {
    if (set.has(key)) set.delete(key);
    else set.add(key);
  }
  function applyBtnState(btn, active, on, off) {
    if (!btn) return;
    btn.textContent = active ? on : off;
    btn.classList.toggle('on', active);
    btn.title = active ? btn.dataset.titleOn || '' : btn.dataset.titleOff || '';
  }

  // ============== Filter toggles (favorites / watched) ==============
  const filterBar = document.querySelector('.filters');
  if (filterBar) {
    const onlyFav = new URLSearchParams(location.search).get('only') || '';
    const wrap = document.createElement('div');
    wrap.className = 'filter';
    wrap.innerHTML = `
      <span>只顯示</span>
      <select id="onlyFilter">
        <option value="">全部</option>
        <option value="favorite" ${onlyFav === 'favorite' ? 'selected' : ''}>已收藏</option>
        <option value="watched" ${onlyFav === 'watched' ? 'selected' : ''}>已看過</option>
        <option value="unwatched" ${onlyFav === 'unwatched' ? 'selected' : ''}>未看過</option>
      </select>`;
    filterBar.querySelector('.filter-row').appendChild(wrap);

    document.getElementById('onlyFilter').addEventListener('change', (e) => {
      const v = e.target.value;
      const url = new URL(location.href);
      if (v) url.searchParams.set('only', v); else url.searchParams.delete('only');
      location.href = url.toString();
    });

    applyOnlyFilter();
  }

  function applyOnlyFilter() {
    const only = new URLSearchParams(location.search).get('only');
    if (!only) return;
    document.querySelectorAll('.card').forEach((card) => {
      const url = urlOf(card);
      const isFav = state.favorites.has(url);
      const isWatched = state.watched.has(url);
      let show = true;
      if (only === 'favorite') show = isFav;
      else if (only === 'watched') show = isWatched;
      else if (only === 'unwatched') show = !isWatched;
      card.style.display = show ? '' : 'none';
    });
  }

  function updateCounters() {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const key = el.dataset.count;
      const set = key === 'favorite' ? state.favorites : state.watched;
      el.textContent = set.size;
    });
  }
  updateCounters();

  // ============== Detail page: single-card state ==============
  const detailRoot = document.querySelector('[data-detail-url]');
  if (detailRoot) {
    const url = detailRoot.dataset.detailUrl;
    const favBtn = detailRoot.querySelector('[data-act="favorite"]');
    const watchBtn = detailRoot.querySelector('[data-act="watched"]');
    applyBtnState(favBtn, state.favorites.has(url), '★ 已收藏', '☆ 收藏');
    applyBtnState(watchBtn, state.watched.has(url), '✓ 已看過', '○ 標記為已看');

    favBtn?.addEventListener('click', () => {
      toggleSet(state.favorites, url);
      saveState(state);
      applyBtnState(favBtn, state.favorites.has(url), '★ 已收藏', '☆ 收藏');
    });
    watchBtn?.addEventListener('click', () => {
      toggleSet(state.watched, url);
      saveState(state);
      applyBtnState(watchBtn, state.watched.has(url), '✓ 已看過', '○ 標記為已看');
    });
  }
})();
