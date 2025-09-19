
// ui.setup.modal.js — Setup wizard (UI language + study language). Deck auto-selects the first deck of chosen language.
(function(){
  const LS = {
    uiLang: 'lexitron.uiLang',
    studyLang: 'lexitron.studyLang',
    deckKey: 'lexitron.deckKey',
    setupDone: 'lexitron.setupDone',
    legacyActiveKey: 'lexitron.activeKey'
  };
  const FLAG_EMOJI = { ru:'🇷🇺', uk:'🇺🇦', en:'🇬🇧', de:'🇩🇪', es:'🇪🇸', fr:'🇫🇷', it:'🇮🇹', pl:'🇵🇱', sr:'🇷🇸', tr:'🇹🇷' };

  function get(k, d){ try{ const v = localStorage.getItem(k); return v===null?d:v; }catch(_){ return d; } }
  function set(k, v){ try{ localStorage.setItem(k, v); }catch(_){ } }

  function L(lang){
    const l=(lang||'').toLowerCase();
    const map={
      ru:{setupTitle:'Первичная настройка', uiLanguage:'Язык интерфейса', studyLanguage:'Язык тренировки', ok:'OK'},
      uk:{setupTitle:'Початкове налаштування', uiLanguage:'Мова інтерфейсу', studyLanguage:'Мова тренування', ok:'OK'},
      en:{setupTitle:'Initial setup', uiLanguage:'Interface language', studyLanguage:'Study language', ok:'OK'}
    };
    return map[l]||map.ru;
  }
  function T(key, def){
    try{
      const lang=(get(LS.uiLang) || (window.App&&App.settings&&App.settings.lang) || 'uk');
      const bag=(window.I18N && I18N[lang]) || (I18N && I18N.uk) || {};
      return bag[key] || def || key;
    }catch(_){ return def || key; }
  }

  function builtinKeys(){
    try{
      if (window.App && App.Decks && typeof App.Decks.builtinKeys === 'function') return App.Decks.builtinKeys();
      return Object.keys(window.decks||{});
    }catch(_){ return []; }
  }
  function firstDeckForLang(lang){
    const keys = builtinKeys().filter(k=>String(k).startsWith(lang.toLowerCase()+'_'));
    return keys[0] || null;
  }

  function build(){
    const m = document.createElement('div');
    m.id = 'setupModal';
    m.className = 'modal hidden';
    m.setAttribute('role','dialog');
    m.setAttribute('aria-modal','true');

    const labelSetup = T('setupTitle', L(get(LS.uiLang)).setupTitle);
    const labelUi = T('uiLanguage', L(get(LS.uiLang)).uiLanguage);
    const labelStudy = T('studyLanguage', L(get(LS.uiLang)).studyLanguage);
    const labelOk = T('ok', L(get(LS.uiLang)).ok) || T('confirm', L(get(LS.uiLang)).ok);

    m.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <h2>${labelSetup}</h2>
        <div id="langFlags">
          <div class="field">
            <div class="label">${labelUi}</div>
            <div class="langFlags flagsRow" id="setupUiFlags"></div>
          </div>
          <div class="field">
            <div class="label">${labelStudy}</div>
            <div class="langFlags flagsRow" id="setupStudyFlags"></div>
          </div>
        </div>
        <div class="modalActions">
          <button id="setupConfirm" class="primary" disabled>${labelOk}</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    // Theme ensure if not set
    try{
      const body=document.body;
      if (!body.getAttribute('data-theme')){
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      }
    }catch(_){}

    const uiFlagsEl = m.querySelector('#setupUiFlags');
    const studyFlagsEl = m.querySelector('#setupStudyFlags');
    const okBtn = m.querySelector('#setupConfirm');

    function activeUi(){ return (uiFlagsEl.querySelector('.flagBtn.active')?.dataset.code)||'uk'; }
    function activeStudy(){ return (studyFlagsEl.querySelector('.flagBtn.active')?.dataset.code)||null; }

    function rerenderStaticLabels(code){
      const lab = L(code);
      m.querySelector('h2').textContent = (I18N[code]?.setupTitle)||lab.setupTitle;
      m.querySelectorAll('.field .label')[0].textContent = (I18N[code]?.uiLanguage)||lab.uiLanguage;
      m.querySelectorAll('.field .label')[1].textContent = (I18N[code]?.studyLanguage)||lab.studyLanguage;
      okBtn.textContent = (I18N[code]?.ok || I18N[code]?.confirm || lab.ok);
    }

    function renderUiFlags(){
      uiFlagsEl.innerHTML='';
      const current = (get(LS.uiLang) || (window.App&&App.settings&&App.settings.lang) || 'uk').toLowerCase();
      const candidates = Object.keys(window.I18N||{}).filter(x=>['ru','uk','en'].includes(x));
      (candidates.length?candidates:['ru','uk']).forEach(code=>{
        const b=document.createElement('button');
        b.className='flagBtn'+(code===current?' active':'');
        b.title=code.toUpperCase();
        b.textContent = FLAG_EMOJI[code] || code.toUpperCase();
        b.dataset.code=code;
        b.addEventListener('click',()=>{
          uiFlagsEl.querySelectorAll('.flagBtn').forEach(x=>x.classList.remove('active'));
          b.classList.add('active');
          set(LS.uiLang, code);
          if (window.App && App.settings) App.settings.lang = code;
          rerenderStaticLabels(code);
        });
        uiFlagsEl.appendChild(b);
      });
    }

    function renderStudyFlags(){
      studyFlagsEl.innerHTML='';
      const langs = Array.from(new Set(builtinKeys().map(k=>k.split('_')[0]))).filter(Boolean);
      // preselect by existing deckKey if belongs to a lang
      let cur = (get(LS.studyLang) || '').toLowerCase();
      if (!cur){
        const dk = get(LS.deckKey);
        if (dk) cur = String(dk).split('_')[0] || '';
      }
      langs.forEach(code=>{
        const b=document.createElement('button');
        b.className='flagBtn'+(code===cur?' active':'');
        b.title=code.toUpperCase();
        b.textContent=FLAG_EMOJI[code] || code.toUpperCase();
        b.dataset.code=code;
        b.addEventListener('click', ()=>{
          studyFlagsEl.querySelectorAll('.flagBtn').forEach(x=>x.classList.remove('active'));
          b.classList.add('active');
          set(LS.studyLang, code);
          // auto-pick first deck for this language
          const first = firstDeckForLang(code);
          if (first){ set(LS.deckKey, first); }
          okBtn.disabled = !first;
        });
        studyFlagsEl.appendChild(b);
      });
      // if there is a preselected lang, ensure deck auto-set
      if (cur){
        const first = firstDeckForLang(cur);
        if (first){ set(LS.deckKey, first); okBtn.disabled = false; }
      }
    }

    renderUiFlags();
    renderStudyFlags();
    okBtn.disabled = !get(LS.deckKey);

    // open modal
    m.classList.remove('hidden');

    okBtn.addEventListener('click', ()=>{
      const ui = activeUi() || 'uk';
      const st = activeStudy() || get(LS.studyLang) || '';
      // ensure deckKey is set to first deck of chosen study lang
      let dk = get(LS.deckKey);
      if (!dk && st){ dk = firstDeckForLang(st); if (dk) set(LS.deckKey, dk); }
      if (!dk) return; // cannot proceed

      set(LS.uiLang, ui);
      set(LS.studyLang, st);
      set(LS.deckKey, dk);
      set(LS.setupDone, 'true');
      set(LS.legacyActiveKey, dk);
      if (window.App && App.settings) App.settings.lang = ui;
      m.remove();
      document.dispatchEvent(new CustomEvent('lexitron:setup:done', { detail:{ uiLang:ui, studyLang:st, deckKey:dk } }));
    });
  }

  function shouldShow(){
    try{
      var force = /(?:\?|&)setup=1(?:&|$)/.test(location.search);
      if (force) return true;
    }catch(_){}
    try{
      var dk = localStorage.getItem('lexitron.deckKey') || localStorage.getItem('lexitron.activeKey');
      if (!dk) return true;
      if (!window.decks || !Array.isArray(window.decks[dk]) || window.decks[dk].length < 4) return true;
    }catch(_){ return true; }
    return get(LS.setupDone) !== 'true';
  }

  window.SetupModal = { build, shouldShow, LS };
})();
