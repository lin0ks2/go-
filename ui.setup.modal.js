
// ui.setup.modal.js — first-run wizard (safe, additive, no breaking changes)
(function(){
  const LS = {
    uiLang: 'lexitron.uiLang',
    studyLang: 'lexitron.studyLang',
    deckKey: 'lexitron.deckKey',
    setupDone: 'lexitron.setupDone',
    legacyActiveKey: 'lexitron.activeKey'
  };
  const FLAG_EMOJI = { ru:'🇷🇺', uk:'🇺🇦', en:'🇬🇧', de:'🇩🇪', es:'🇪🇸', fr:'🇫🇷', it:'🇮🇹', pl:'🇵🇱', sr:'🇷🇸', tr:'🇹🇷' };

  function safeGet(k, def){ try{ const v = localStorage.getItem(k); return v===null?def:v; }catch(_){ return def; } }
  function safeSet(k, v){ try{ localStorage.setItem(k, v); }catch(_){ } }

  function i18n(key, def){
    try{
      const lang = (safeGet(LS.uiLang) || (window.App && App.settings && App.settings.lang) || 'uk');
      const bag = (window.I18N && I18N[lang]) || I18N.uk || {};
      return bag[key] || def || key;
    }catch(_){ return def || key; }
  }

  function builtinKeys(){
    try{
      if (window.App && App.Decks && typeof App.Decks.builtinKeys === 'function') return App.Decks.builtinKeys();
      return Object.keys(window.decks || {});
    }catch(_){ return []; }
  }

  function studyLangs(){
    const set = new Set();
    builtinKeys().forEach(k => {
      const m = String(k||'').match(/^([a-z]{2})_/i);
      if (m) set.add(m[1].toLowerCase());
    });
    return Array.from(set).sort();
  }

  function decksByLang(lang){
    const keys = builtinKeys().filter(k => String(k).startsWith((lang||'').toLowerCase()+'_'));
    return keys.map(key => ({ key, title: (window.App && App.Decks && App.Decks.resolveNameByKey)? App.Decks.resolveNameByKey(key) : key }));
  }

  function build(){
    // Root modal
    const modal = document.createElement('div');
    modal.id = 'setupModal';
    modal.className = 'modal hidden'; // reuse existing modal styles
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','setupTitle');
    modal.innerHTML = ''
      + '<div class="backdrop" id="setupBackdrop"></div>'
      + '<div class="dialog">'
      +   '<h2 id="setupTitle">' + (i18n('setupTitle','Первичная настройка')) + '</h2>'
      +   '<div class="field">'
      +     '<div class="label">' + (i18n('uiLanguage','Язык интерфейса')) + '</div>'
      +     '<div class="flagsRow" id="setupUiFlags" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;margin:8px 6px 10px;"></div>'
      +   '</div>'
      +   '<div class="field">'
      +     '<div class="label">' + (i18n('studyLanguage','Язык тренировки')) + '</div>'
      +     '<div class="flagsRow" id="setupStudyFlags" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;margin:8px 6px 10px;"></div>'
      +   '</div>'
      +   '<div class="field">'
      +     '<div class="label">' + (i18n('chooseDeck','Выберите словарь')) + '</div>'
      +     '<div class="dictList" id="setupDictList" style="max-height:40vh;overflow:auto;"></div>'
      +   '</div>'
      +   '<div class="modalActions">'
      +     '<button id="setupConfirm" class="primary" disabled>' + (i18n('ok','OK') || i18n('confirm','Подтвердить')) + '</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(modal);

    function open(){ modal.classList.remove('hidden'); }
    function close(){ modal.classList.add('hidden'); modal.remove(); }

    // UI flags (RU/UK + EN if present)
    const uiFlags = document.getElementById('setupUiFlags');
    const uiCandidates = Object.keys((window.I18N||{})).filter(c => ['ru','uk','en'].includes(c));
    const currentUi = (safeGet(LS.uiLang) || (window.App && App.settings && App.settings.lang) || 'uk').toLowerCase();
    (uiCandidates.length?uiCandidates:['ru','uk']).forEach(code => {
      const b = document.createElement('button');
      b.className = 'flagBtn' + (code===currentUi?' active':'');
      b.title = (I18N && I18N[code] && I18N[code].langLabel) ? I18N[code].langLabel : code.toUpperCase();
      b.textContent = FLAG_EMOJI[code] || code.toUpperCase();
      b.dataset.code = code;
      b.addEventListener('click', () => {
        uiFlags.querySelectorAll('.flagBtn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        safeSet(LS.uiLang, code);
        // update static labels to new language
        document.getElementById('setupTitle').textContent = i18n('setupTitle','Первичная настройка');
        modal.querySelectorAll('.field .label')[0].textContent = i18n('uiLanguage','Язык интерфейса');
        modal.querySelectorAll('.field .label')[1].textContent = i18n('studyLanguage','Язык тренировки');
        modal.querySelectorAll('.field .label')[2].textContent = i18n('chooseDeck','Выберите словарь');
        document.getElementById('setupConfirm').textContent = i18n('ok','OK');
      });
      uiFlags.appendChild(b);
    });

    // Study flags from available decks
    const studyFlags = document.getElementById('setupStudyFlags');
    const langs = studyLangs();
    const currentStudy = (safeGet(LS.studyLang) || langs[0] || 'de').toLowerCase();
    langs.forEach(code => {
      const b = document.createElement('button');
      b.className = 'flagBtn' + (code===currentStudy?' active':'');
      b.title = (App.i18n && App.i18n()['lang_'+code]) || code.toUpperCase();
      b.textContent = FLAG_EMOJI[code] || code.toUpperCase();
      b.dataset.code = code;
      b.addEventListener('click', () => {
        studyFlags.querySelectorAll('.flagBtn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        safeSet(LS.studyLang, code);
        renderDecks(code);
      });
      studyFlags.appendChild(b);
    });

    const listEl = document.getElementById('setupDictList');
    function renderDecks(langCode){
      listEl.innerHTML = '';
      const decks = decksByLang(langCode);
      decks.forEach(d => {
        const row = document.createElement('button');
        row.className = 'dictRow' + ((safeGet(LS.deckKey)===d.key)?' active':'');
        row.type = 'button';
        row.dataset.key = d.key;
        row.innerHTML = '<span class="dictFlag"></span><span class="dictName"></span>';
        row.querySelector('.dictName').textContent = d.title || d.key;
        row.addEventListener('click', () => {
          listEl.querySelectorAll('.dictRow').forEach(x => x.classList.remove('active'));
          row.classList.add('active');
          safeSet(LS.deckKey, d.key);
          document.getElementById('setupConfirm').disabled = false;
        });
        listEl.appendChild(row);
      });
      document.getElementById('setupConfirm').disabled = !listEl.querySelector('.dictRow.active');
    }

    renderDecks(currentStudy);

    document.getElementById('setupConfirm').addEventListener('click', () => {
      const ui = (uiFlags.querySelector('.flagBtn.active')?.dataset.code) || 'uk';
      const st = (studyFlags.querySelector('.flagBtn.active')?.dataset.code) || currentStudy || 'de';
      const deck = safeGet(LS.deckKey) || (listEl.querySelector('.dictRow')?.dataset.key) || null;
      if (!deck) return;
      safeSet(LS.uiLang, ui);
      safeSet(LS.studyLang, st);
      safeSet(LS.deckKey, deck);
      safeSet(LS.setupDone, 'true');
      safeSet(LS.legacyActiveKey, deck);
      try { if (window.App && App.settings) { App.settings.lang = ui; } } catch(_){}
      close();
      document.dispatchEvent(new CustomEvent('lexitron:setup:done', { detail: { uiLang: ui, studyLang: st, deckKey: deck } }));
    });

    // open last
    open();
  }

  function shouldShow(){
    return safeGet(LS.setupDone) !== 'true';
  }

  window.SetupModal = { build, shouldShow, LS };
})();
