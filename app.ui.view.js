
/* app.ui.view.js — TZ build: no double-add, endless for mistakes/fav, dedup variants */
(function () {
  const App = window.App || (window.App = {});
  const D = App.DOM || (App.DOM = {});

  // ─ helpers ─
  function keyLang(key){
    const m = String(key||'').match(/^([a-z]{2})_/i);
    return m ? m[1].toLowerCase() : 'xx';
  }
  function langOfKey(k){ try{ const m = String(k||'').match(/^([a-z]{2})_/i); return m?m[1].toLowerCase():null; }catch(e){ return null; } }
  function isEndlessDict(key){ return key === 'mistakes' || key === 'fav' || key === 'favorites'; }

  // ─ title + set stats ─
  function renderDictTitle(){
    try{
      const el = document.getElementById('dictActiveTitle');
      if (!el) return;
      const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      const name = (App.Decks && App.Decks.resolveNameByKey) ? App.Decks.resolveNameByKey(key) : (key||'');
      el.textContent = name || '';
    }catch(_){}
  }

  function renderSetStats(){
    try{
      const host = document.getElementById('setStats');
      if (!host || !App.Sets) return;
      const b = App.Sets.activeBounds ? App.Sets.activeBounds() : {start:0,end:0};
      const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
      const deck = (App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(key)||[]) : [];
      const sMax = (App.Trainer && App.Trainer.starsMax) ? App.Trainer.starsMax() : 6;
      const total = Math.max(0, (b.end - b.start));
      let learned = 0;

      if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
        for (let i=b.start;i<b.end;i++){
          const w = deck[i]; if(!w) continue;
          const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
          const sc = App.Mistakes.getStars(sk, w.id);
          if (sc >= sMax) learned++;
        }
      } else {
        const stars = (App.state && App.state.stars) || {};
        for (let i=b.start;i<b.end;i++){
          const w = deck[i]; if(!w) continue;
          if ((stars[w.id]||0) >= sMax) learned++;
        }
      }

      const t = (typeof App.i18n === 'function') ? App.i18n() : { badgeSetWords:'Слов в наборе', badgeLearned:'Выучено' };
      host.textContent = (t.badgeSetWords||'Слов в наборе') + ': ' + String(total) + ' / ' + (t.badgeLearned||'Выучено') + ': ' + String(learned);
    }catch(_){}
  }

  function _categoryRank(key){
    try{
      const k = String(key||'').toLowerCase().replace(/\s+/g,'');
      const suf = k.replace(/^[a-z]{2}_/,'');
      const order = { verbs:0, nouns:1, adjectives:2, adverbs:3, pronouns:4, prepositions:5, numbers:6, conjunctions:7, particles:8 };
      return (suf in order) ? order[suf] : 999;
    } catch(e){ return 999; }
  }
  function _sortKeysByCategory(keys){
    return (keys||[]).slice().sort((a,b)=>{
      const ra=_categoryRank(a), rb=_categoryRank(b);
      if (ra!==rb) return ra-rb;
      return String(a).localeCompare(String(b));
    });
  }

  function getActiveDeck() {
    if (App.Trainer && typeof App.Trainer.safeGetDeckSlice === 'function') {
      return App.Trainer.safeGetDeckSlice(App.dictRegistry.activeKey) || [];
    }
    if (App.Trainer && typeof App.Trainer.getDeckSlice === 'function') {
      const slice = App.Trainer.getDeckSlice(App.dictRegistry.activeKey) || [];
      if (slice && slice.length) return slice;
    }
    return App.Decks.resolveDeckByKey(App.dictRegistry.activeKey) || [];
  }

  function current() {
    const deck = getActiveDeck();
    if (!deck.length) return { id: -1, word: '', uk: '', ru: '' };
    if (App.state.index < 0 || App.state.index >= deck.length) App.state.index = 0;
    return deck[App.state.index];
  }

  function decideModeForWord(w) {
    const succ = App.state.successes[w.id] || 0;
    let reverse = (succ >= App.Trainer.unlockThreshold()) ? (Math.random() < 0.5) : false;
    try {
      if (App.Penalties) {
        const p = App.Penalties.reverseProbFor(w.id);
        if (Math.random() < p) reverse = true;
      }
    } catch (e) {}
    return reverse;
  }

  // ─ variants (with dedup) ─
  function drawOptions(correct, pool) {
    // Build a unique set of distractors by final button text
    const uniq = [];
    const seen = new Set();
    for (let i=0;i<pool.length;i++){
      const v = pool[i];
      const s = String(v||'').trim();
      if (!s || s === correct) continue;
      if (!seen.has(s)){ seen.add(s); uniq.push(s); }
      if (uniq.length >= 12) break;
    }
    // pad to 3 unique distractors later using fallback in caller
    const need = Math.max(0, 3 - uniq.length);
    const distractors = App.shuffle(uniq).slice(0, 3);
    const variants = App.shuffle([correct, ...distractors]);
    variants.forEach(v => {
      const b = document.createElement('button');
      b.className = 'optionBtn';
      b.textContent = v;
      if (v === correct) b.dataset.correct = '1';
      b.addEventListener('click', () => onChoice(b, v === correct));
      D.optionsRow.appendChild(b);
    });
  }

  function addIDontKnowButton() {
    if (!D || !D.optionsRow) return;
    const t = (typeof App.i18n === 'function') ? App.i18n() : { iDontKnow: 'Не знаю' };
    const wrap = document.createElement('div');
    wrap.className = 'idkWrapper';
    const btn = document.createElement('button');
    btn.className = 'ghost';
    btn.textContent = t.iDontKnow || 'Не знаю';
    btn.addEventListener('click', onIDontKnow);
    wrap.appendChild(btn);
    D.optionsRow.appendChild(wrap);
  }

  // ─ mistakes pool (same source/dictLang only) ─
  function getMistakesDistractorPool(currentWord) {
    const out = [];
    const seen = new Set();
    const push = (w) => {
      if (!w || !w.id || String(w.id) === String(currentWord.id)) return;
      const label = ((App.settings.lang === 'ru') ? (w.ru || w.uk) : (w.uk || w.ru)) || w.translation || w.meaning;
      if (!label) return;
      const key = String(w.id) + '::' + String(label);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(w);
    };

    let srcKey = null;
    try { srcKey = (App.Mistakes && App.Mistakes.sourceKeyFor) ? App.Mistakes.sourceKeyFor(currentWord.id) : (currentWord._mistakeSourceKey || null); } catch (_) {}
    const dictLang = langOfKey(srcKey) || null;

    if (srcKey) {
      const srcDeck = App.Decks.resolveDeckByKey(srcKey) || [];
      for (let i = 0; i < srcDeck.length; i++) push(srcDeck[i]);
    }

    if (out.length < 12 && dictLang) {
      const keys = (App.Decks && App.Decks.builtinKeys) ? App.Decks.builtinKeys() : Object.keys(window.decks || {});
      for (let k of keys) {
        if (langOfKey(k) !== dictLang) continue;
        if (k === srcKey) continue;
        const d = App.Decks.resolveDeckByKey(k) || [];
        for (let i = 0; i < d.length; i++) push(d[i]);
        if (out.length >= 24) break;
      }
    }

    // mistakes deck (already filtered by dictLang/uiLang on module side)
    if (out.length < 24 && App.Mistakes && typeof App.Mistakes.deck === 'function') {
      const arr = App.Mistakes.deck() || [];
      for (let i = 0; i < arr.length; i++) push(arr[i]);
    }

    return out;
  }

  // ─ determine endless and pick index ─
  function allLearned(sub, key){
    const max = App.Trainer.starsMax();
    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      for (let i=0;i<sub.length;i++){
        const w = sub[i];
        const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
        if ((App.Mistakes.getStars(sk, w.id) || 0) < max) return false;
      }
      return true;
    }
    const stars = (App.state && App.state.stars) || {};
    for (let i=0;i<sub.length;i++){ const w=sub[i]; if ((stars[w.id]||0) < max) return false; }
    return true;
  }

  function pickIndexWithFallback(sub, key) {
    if (!Array.isArray(sub) || sub.length === 0) return -1;
    if (isEndlessDict(key) && allLearned(sub, key)) {
      return Math.floor(Math.random() * sub.length); // endless: keep training same set
    }
    return App.Trainer.sampleNextIndexWeighted(sub);
  }

  // ─ render & stats ─
  function renderStars() {
    const w = current();
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const max = App.Trainer.starsMax();
    let score = 0;
    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
      score = App.Mistakes.getStars(sk, w.id);
    } else {
      score = (App.state.stars[w.id] || 0);
    }
    score = Math.max(0, Math.min(max, score));
    const host = D.starsEl; if (!host) return;
    host.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const s = document.createElement('span');
      s.className = 'starIcon' + (i < score ? ' filled' : '');
      s.textContent = '★';
      host.appendChild(s);
    }
  }

  function updateStats() {
    const t = App.i18n ? App.i18n() : { totalWords: 'Всего слов', learned: 'Выучено' };
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const fullDeck = (App.Decks && App.Decks.resolveDeckByKey) ? (App.Decks.resolveDeckByKey(key) || []) : [];
    const repeats = (App.Trainer && typeof App.Trainer.starsMax === 'function') ? App.Trainer.starsMax() : ((App.state && App.state.repeats) || 3);
    let learned = 0;

    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      for (let i=0;i<fullDeck.length;i++){
        const w = fullDeck[i]; if(!w) continue;
        const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
        if ((App.Mistakes.getStars(sk, w.id) || 0) >= repeats) learned++;
      }
    } else {
      const starsMap = (App.state && App.state.stars) || {};
      for (let i = 0; i < fullDeck.length; i++) if ((starsMap[fullDeck[i].id] || 0) >= repeats) learned++;
    }

    if (App.DOM && App.DOM.statsBar) App.DOM.statsBar.textContent = `${t.totalWords || 'Всего слов'}: ${fullDeck.length} / ${(t.learned || 'Выучено')}: ${learned}`;
  }

  function renderCard(force = false) {
    if (document.activeElement && document.activeElement.blur) { try { document.activeElement.blur(); } catch (e) {} }
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const deck = getActiveDeck();
    if (!deck.length) {
      if (key === 'mistakes') {
        if (D.wordEl) D.wordEl.textContent = '—';
        if (D.hintEl) D.hintEl.textContent = '—';
        if (D.optionsRow) D.optionsRow.innerHTML = '';
        renderStars(); updateStats();
        return;
      }
      if (D.wordEl) D.wordEl.textContent = '—';
      if (D.hintEl) D.hintEl.textContent = '—';
      if (D.optionsRow) D.optionsRow.innerHTML = '';
      renderStars(); updateStats();
      return;
    }

    if (force || App.state.index === App.state.lastIndex) {
      const b = App.Sets ? App.Sets.activeBounds() : { start: 0, end: deck.length };
      const sub = deck.slice(b.start, b.end);
      const picked = pickIndexWithFallback(sub, key);
      if (picked >= 0) App.state.index = b.start + picked;
    }

    const w = current();
    if (App.state.lastShownWordId !== w.id) {
      App.state.totals.shown += 1;
      App.state.lastShownWordId = w.id;
      App.state.lastSeen[w.id] = Date.now();
      App.saveState();
      // Не авто-адвансим в endless-словарях
      if (!isEndlessDict(key)) {
        try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){}
      }
    }

    const t = App.i18n();
    const isReverse = decideModeForWord(w);

    renderStars();
    D.optionsRow.innerHTML = '';

    // Build pools with proper labels and dedup handled in drawOptions()
    if (!isReverse) {
      if (D.wordEl) D.wordEl.textContent = w.word;
      let poolWords;
      if (key === 'mistakes') {
        poolWords = getMistakesDistractorPool(w)
          .map(x => (App.settings.lang === 'ru') ? (x.ru || x.uk || x.translation || x.meaning) : (x.uk || x.ru || x.translation || x.meaning))
          .filter(Boolean);
      } else {
        poolWords = deck.filter(x => x.id !== w.id)
          .map(x => (App.settings.lang === 'ru') ? (x.ru || x.uk || x.translation || x.meaning) : (x.uk || x.ru || x.translation || x.meaning))
          .filter(Boolean);
      }
      const correct = (App.settings.lang === 'ru') ? (w.ru || w.uk || w.translation || w.meaning || '') : (w.uk || w.ru || w.translation || w.meaning || '');
      drawOptions(correct, poolWords);
    } else {
      if (D.wordEl) D.wordEl.textContent = (App.settings.lang === 'ru') ? (w.ru || w.uk || w.translation || w.meaning || '') : (w.uk || w.ru || w.translation || w.meaning || '');
      let poolWords;
      if (key === 'mistakes') {
        poolWords = getMistakesDistractorPool(w).map(x => x.word).filter(Boolean);
      } else {
        poolWords = deck.filter(x => x.id !== w.id).map(x => x.word).filter(Boolean);
      }
      const correct = w.word;
      drawOptions(correct, poolWords);
    }

    if (D.hintEl) D.hintEl.textContent = t.choose;

    if (D.favBtn) {
      // Сердечко неактивно в fav и mistakes
      D.favBtn.disabled = (key === 'fav' || key === 'favorites' || key === 'mistakes');
      const dictKey = (key === 'mistakes')
        ? ((w && (w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)))) || 'mistakes')
        : key;
      D.favBtn.textContent = (App.isFavorite && App.isFavorite(dictKey, w.id)) ? '♥' : '♡';
    }

    addIDontKnowButton();
    updateStats();
  }

  // ─ add to mistakes with favorite priority ─
  function addToMistakesOnFailure(word) {
    if (!word) return;
    try {
      // приоритет избранного: если слово в избранном для своего sourceKey — не добавляем в МО
      const sk = (word._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(word.id)) || (App.dictRegistry && App.dictRegistry.activeKey));
      if (App.isFavorite && App.isFavorite(sk, word.id)) return;

      const active = (App && App.dictRegistry && App.dictRegistry.activeKey) || null;
      let sourceKey;
      if (active === 'mistakes') {
        sourceKey = sk || 'mistakes';
      } else {
        sourceKey = active;
      }
      if (App && App.Mistakes && typeof App.Mistakes.add === 'function') {
        App.Mistakes.add(String(word.id), word, sourceKey);
      }
    } catch (e) {}
  }

  // ─ answers ─
  function onChoice(btn, correct) {
    const w = current();
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const max = App.Trainer.starsMax();

    if (correct) {
      btn.classList.add('correct');
      D.optionsRow.querySelectorAll('button.optionBtn').forEach(b => b.disabled = true);

      if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
        const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
        const cur = App.Mistakes.getStars(sk, w.id) || 0;
        App.Mistakes.setStars(sk, w.id, Math.max(0, Math.min(max, cur+1)));
      } else {
        const cur = Math.max(0, Math.min(max, App.state.stars[w.id] || 0));
        App.state.stars[w.id] = Math.max(0, Math.min(max, cur+1));
        App.state.successes[w.id] = (App.state.successes[w.id] || 0) + 1;
      }

      App.saveState();
      if (!isEndlessDict(key)) {
        try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){}
      }
      renderStars();
      updateStats();

      // milestones only "learned" left as-is — не трогаем

      setTimeout(nextWord, 500);
      return;
    }

    // wrong
    btn.classList.add('wrong');
    btn.disabled = true;

    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
      const cur = App.Mistakes.getStars(sk, w.id) || 0;
      App.Mistakes.setStars(sk, w.id, Math.max(0, Math.min(max, cur-1)));
    } else {
      const cur = Math.max(0, Math.min(max, App.state.stars[w.id] || 0));
      App.state.stars[w.id] = Math.max(0, Math.min(max, cur-1));
    }

    App.state.totals.errors += 1;
    App.state.totals.sessionErrors = (App.state.totals.sessionErrors || 0) + 1;

    // приоритет избранного: если слово уже в избранном — не добавляем в МО
    if (!(App.isFavorite && App.isFavorite((w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)) || (App.dictRegistry && App.dictRegistry.activeKey)), w.id))) {
      addToMistakesOnFailure(w);
    }

    App.saveState();
    if (!isEndlessDict(key)) {
      try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){}
    }
    renderStars();
    updateStats();
  }

  function onIDontKnow() {
    const w = current();
    const c = D.optionsRow.querySelector('button.optionBtn[data-correct="1"]');
    if (c) c.classList.add('correct');
    D.optionsRow.querySelectorAll('button.optionBtn').forEach(b => b.disabled = true);
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const max = App.Trainer.starsMax();

    if (key === 'mistakes' && App.Mistakes && App.Mistakes.getStars){
      const sk = w._mistakeSourceKey || (App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id));
      const cur = App.Mistakes.getStars(sk, w.id) || 0;
      App.Mistakes.setStars(sk, w.id, Math.max(0, Math.min(max, cur-1)));
    } else {
      const cur = Math.max(0, Math.min(max, App.state.stars[w.id] || 0));
      App.state.stars[w.id] = Math.max(0, Math.min(max, cur-1));
    }

    App.state.totals.errors += 1;
    App.state.totals.sessionErrors = (App.state.totals.sessionErrors || 0) + 1;

    // приоритет избранного: если слово в избранном — не добавляем в МО
    if (!(App.isFavorite && App.isFavorite((w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)) || (App.dictRegistry && App.dictRegistry.activeKey)), w.id))) {
      addToMistakesOnFailure(w);
    }

    App.saveState();
    if (!isEndlessDict(key)) {
      try{ if(App.Sets && App.Sets.checkCompletionAndAdvance) App.Sets.checkCompletionAndAdvance(); }catch(e){}
    }
    renderStars();
    updateStats();
    setTimeout(function () { nextWord(); }, 700);
  }

  // ─ sets bar ─
  App.renderSetsBar = function () {
    const host = document.getElementById('setsBar');
    if (!host) return;
    host.innerHTML = '';
    const total = (App.Sets && App.Sets.setTotalCount) ? App.Sets.setTotalCount() : 1;
    const active = (App.Sets && App.Sets.getActiveSetIndex) ? App.Sets.getActiveSetIndex() : 0;
    for (let i = 0; i < total; i++) {
      const btn = document.createElement('button');
      btn.className = 'setTile' + (i === active ? ' active' : '') + (App.Sets.isSetDone(i) ? ' done' : '');
      btn.setAttribute('type', 'button');
      btn.setAttribute('aria-pressed', i === active ? 'true' : 'false');
      if (i === active) btn.setAttribute('aria-current','true');
      btn.textContent = (i + 1);
      btn.addEventListener('click', () => {
        App.Sets.setActiveSetIndex(i);
        App.switchToSetImmediate();
      });
      host.appendChild(btn);
    }
    renderDictTitle();
    renderSetStats();
  };

  App.switchToSetImmediate = function () {
    const b = App.Sets.activeBounds();
    if (App.state.index < b.start || App.state.index >= b.end) App.state.index = b.start;
    renderCard(true);
    renderSetStats();
    App.saveState && App.saveState();
  };

  // ─ navigation ─
  function nextWord() {
    App.state.lastIndex = App.state.index;
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    const b = App.Sets ? App.Sets.activeBounds() : { start: 0, end: getActiveDeck().length };
    const full = (App.Decks.resolveDeckByKey(key) || []);
    const sub = full.slice(b.start, b.end);
    if (!sub.length) { renderCard(true); return; }
    const picked = pickIndexWithFallback(sub, key);
    if (picked < 0) { renderCard(true); return; }
    App.state.index = b.start + picked;
    renderCard(true);
  }

  // ─ favorites ─
  function toggleFav() {
    const w = current();
    const activeKey = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    // Если мы в mistakes — используем sourceKey слова, а не 'mistakes'
    const dictKey = (activeKey === 'mistakes')
      ? ((w && (w._mistakeSourceKey || (App.Mistakes && App.Mistakes.sourceKeyFor && App.Mistakes.sourceKeyFor(w.id)))) || 'mistakes')
      : activeKey;

    App.toggleFavorite && App.toggleFavorite(dictKey, w.id);
    if (D.favBtn) {
      D.favBtn.textContent = (App.isFavorite && App.isFavorite(dictKey, w.id)) ? '♥' : '♡';
      D.favBtn.style.transform = 'scale(1.2)';
      setTimeout(() => { D.favBtn.style.transform = 'scale(1)'; }, 140);
    }
    // Перерисовать списки — так появится/обновится «Избранное»
    if (typeof App.renderSetsBar === 'function') App.renderSetsBar();
  }

  // ─ dicts list, flags, bootstrap etc. (минимальные изменения) ─
  function renderDictList() {
    const host = D.dictListHost;
    if (!host) return;
    host.innerHTML = '';

    (function appendMistakesRowFirst() {
      try {
        const row = makeDictRow('mistakes');
        if (!row) return;
        host.appendChild(row);
        let cnt = 0;
        if (App.Mistakes && typeof App.Mistakes.count === 'function') cnt = App.Mistakes.count();
        if (cnt < 4) {
          row.classList.add('disabled');
          row.setAttribute('aria-disabled', 'true');
        }
      } catch (e) {}
    })();

    if (canShowFav()) host.appendChild(makeDictRow('fav'));

    (function(){
      const all = App.Decks.builtinKeys();
      const lg = (App.settings && App.settings.dictsLangFilter) || null;
      let keys = all;
      if (lg) keys = all.filter(k => keyLang(k) === lg);
      keys = _sortKeysByCategory(keys);
      keys.forEach(k => host.appendChild(makeDictRow(k)));
    })();

    for (const k of Object.keys(App.dictRegistry.user || {})) host.appendChild(makeDictRow(k));
  }

  function canShowFav() {
    try {
      App.migrateFavoritesToV2 && App.migrateFavoritesToV2();
      const v2 = (App.state && App.state.favorites_v2) || {};
      let cnt = 0; Object.keys(v2).forEach(k => { cnt += Object.keys(v2[k] || {}).filter(x => v2[k][x]).length; });
      return cnt >= 4;
    } catch (e) { return false; }
  }

  function makeDictRow(key) {
    const words = App.Decks.resolveDeckByKey(key) || [];
    const row = document.createElement('div');
    row.className = 'dictRow' + (key === App.dictRegistry.activeKey ? ' active' : '');
    row.dataset.key = key;

    const flag = document.createElement('div');
    flag.className = 'dictFlag';
    if (key === 'mistakes') flag.textContent = '⚠️';
    else flag.textContent = App.Decks.flagForKey(key, words);

    const name = document.createElement('div');
    name.className = 'dictName';
    if (key === 'mistakes') {
      const t = (typeof App.i18n === 'function') ? App.i18n() : null;
      name.textContent = (t && t.mistakesName) ? t.mistakesName : 'Мои ошибки';
    } else if (key === 'fav' || key === 'favorites') {
      name.textContent = (App.settings.lang === 'ru') ? 'Избранное' : 'Обране';
    } else {
      name.textContent = App.Decks.resolveNameByKey(key);
    }
    name.title = name.textContent;

    const actions = document.createElement('div');
    actions.className = 'dictActions';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'iconOnly';
    prevBtn.title = (App.i18n().ttPreview || 'Предпросмотр');
    prevBtn.textContent = '👁️';
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); App.Decks.openPreview(words, name.textContent); });
    actions.appendChild(prevBtn);

    if (key === 'mistakes') {
      const delBtn = document.createElement('button');
      delBtn.className = 'iconOnly';
      delBtn.title = (App.settings.lang === 'ru') ? 'Очистить «Мои ошибки»' : 'Очистити «Мої помилки»';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msg = (App.settings.lang === 'ru') ? 'Очистить «Мои ошибки» для активного языка? Это действие нельзя отменить.' : 'Очистити «Мої помилки» для активної мови? Дію не можна скасувати.';
        if (!confirm(msg)) return;
        if (App.Mistakes && typeof App.Mistakes.clearActive==='function') App.Mistakes.clearActive();
        renderDictList(); App.renderSetsBar && App.renderSetsBar(); renderCard(true); updateStats();
      });
      actions.appendChild(delBtn);
    }

    if (key === 'fav' || key === 'favorites') {
      const delBtn = document.createElement('button');
      delBtn.className = 'iconOnly';
      delBtn.title = (App.settings.lang === 'ru') ? 'Очистить «Избранное»' : 'Очистити «Обране»';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msg = (App.settings.lang === 'ru') ? 'Очистить «Избранное»? Это действие нельзя отменить.' : 'Очистити «Обране»? Дію не можна скасувати.';
        if (!confirm(msg)) return;
        App.clearFavoritesAll && App.clearFavoritesAll();
        App.dictRegistry.activeKey = App.Decks./* pickDefaultKey disabled by clean startup */
        App.saveDictRegistry();
        renderDictList(); App.renderSetsBar(); renderCard(true); updateStats();
      });
      actions.appendChild(delBtn);
    }

    row.appendChild(flag);
    row.appendChild(name);
    row.appendChild(actions);

    row.addEventListener('click', () => {
      if (row.classList.contains('disabled')) return;
      App.dictRegistry.activeKey = key;
      App.saveDictRegistry();

      App.state.index = 0;
      App.state.lastIndex = -1;
      renderDictList();
      App.renderSetsBar();
      renderCard(true);
      updateStats();
    });

    return row;
  }

  const FLAG_EMOJI = { ru:'🇷🇺', uk:'🇺🇦', en:'🇬🇧', de:'🇩🇪', es:'🇪🇸', fr:'🇫🇷', it:'🇮🇹', pl:'🇵🇱', sr:'🇷🇸', tr:'🇹🇷' };
  App.renderLangFlags = function(){
    if (!D.langFlags) return;
    const set = new Set();
    try {
      const keys = (App.Decks && typeof App.Decks.builtinKeys === 'function')
        ? App.Decks.builtinKeys()
        : Object.keys(window.decks || {});
      keys.forEach(k => {
        const m = String(k||'').match(/^([a-z]{2})_/i);
        const lg = m ? m[1].toLowerCase() : null;
        if (lg) set.add(lg);
      });
    } catch(_) {}
    const langs = Array.from(set);
    D.langFlags.innerHTML = '';
    if (!langs.length) return;
    const active = App.settings.dictsLangFilter || null;
    langs.forEach(lg => {
      const b = document.createElement('button');
      b.className = 'flagBtn' + ((active===lg)?' active':'');
      b.title = (App.i18n()['lang_'+lg] || lg.toUpperCase());
      b.textContent = FLAG_EMOJI[lg] || lg.toUpperCase();
      b.addEventListener('click', () => {
        App.settings.dictsLangFilter = lg;
        App.saveSettings && App.saveSettings(App.settings);
        renderDictList();
        App.renderLangFlags();
      });
      D.langFlags.appendChild(b);
    });
  };

  // bootstrap/bindings
  const _origBootstrap = App.bootstrap || function(){};
  App.bootstrap = function () {
    _origBootstrap();
    if (!App.state || !App.state.totals) App.state.totals = {};
    App.state.totals.sessionErrors = 0;

    if (!App.dictRegistry.activeKey) { App.dictRegistry.activeKey = App.Decks./* pickDefaultKey disabled by clean startup */ App.saveDictRegistry(); }

    applyLang();
    App.applyTheme && App.applyTheme();
    bindHeaderButtons();
    renderCard(true);
  };

  function applyLang() {
    const t = App.i18n();
    if (D.titleEl && D.titleEl.firstChild) D.titleEl.firstChild.textContent = (t.appTitle || 'App') + ' ';
    if (D.appVerEl) D.appVerEl.textContent = 'v' + (App.APP_VER || '1.0.0');
    if (D.taglineEl) D.taglineEl.textContent = t.tagline || '';
    if (D.dictsBtn) D.dictsBtn.title = t.dictsHeader || 'Словари';
    renderDictList();
    App.renderSetsBar && App.renderSetsBar();
    updateStats();
  }

  function openModal() { if (D.modal) D.modal.classList.remove('hidden'); var t=App.i18n?App.i18n():null; var el=document.getElementById('modalTitle'); if(el&&t&&t.modalTitle) el.textContent=t.modalTitle; }
  function closeModal() { if (D.modal) D.modal.classList.add('hidden'); }

  function bindHeaderButtons() {
    if (D.langToggleBtn) {
      D.langToggleBtn.addEventListener('click', () => {
        App.settings.lang = (App.settings.lang === 'ru') ? 'uk' : 'ru';
        D.langToggleBtn.textContent = (App.settings.lang === 'ru') ? '🇷🇺' : '🇺🇦';
        App.saveSettings(App.settings);
        applyLang();
        App.applyTheme && App.applyTheme();
        renderCard(true);
      });
    }
    if (D.themeToggleBtn) {
      const updateIcon = () => {
        const mode = document.documentElement.getAttribute('data-theme');
        D.themeToggleBtn.textContent = (mode === 'dark') ? '🌙' : '🌞';
      };
      D.themeToggleBtn.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = (cur === 'dark') ? 'light' : 'dark';
        App.settings.theme = next;
        App.saveSettings(App.settings);
        App.applyTheme && App.applyTheme();
        updateIcon();
      });
      updateIcon();
    }
    if (D.dictsBtn) { D.dictsBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openModal(); App.renderLangFlags && App.renderLangFlags(); }); }
    if (D.okBtn) { D.okBtn.addEventListener('click', () => { closeModal(); }); }
    if (D.backdrop) { D.backdrop.addEventListener('click', () => { closeModal(); }); }
    if (D.favBtn) { D.favBtn.addEventListener('click', toggleFav); }
  }
})();
