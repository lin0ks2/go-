
// ui.setup.modal.js — robust build (template literals), identical styles, reactive i18n, strict 4-row list
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
      ru:{setupTitle:'Первичная настройка', uiLanguage:'Язык интерфейса', studyLanguage:'Язык тренировки', chooseDeck:'Выберите словарь', ok:'OK'},
      uk:{setupTitle:'Початкове налаштування', uiLanguage:'Мова інтерфейсу', studyLanguage:'Мова тренування', chooseDeck:'Оберіть словник', ok:'OK'},
      en:{setupTitle:'Initial setup', uiLanguage:'Interface language', studyLanguage:'Study language', chooseDeck:'Choose deck', ok:'OK'}
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

  function build(){
    const m = document.createElement('div');
    m.id = 'setupModal';
    m.className = 'modal hidden';
    m.setAttribute('role','dialog');
    m.setAttribute('aria-modal','true');

    const labelSetup = T('setupTitle', L(get(LS.uiLang)).setupTitle);
    const labelUi = T('uiLanguage', L(get(LS.uiLang)).uiLanguage);
    const labelStudy = T('studyLanguage', L(get(LS.uiLang)).studyLanguage);
    const labelChoose = T('chooseDeck', L(get(LS.uiLang)).chooseDeck);
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
        <div class="field">
          <div class="label">${labelChoose}</div>
          <div class="dictList" id="setupDictList"></div>
        </div>
        <div class="modalActions">
          <button id="setupConfirm" class="primary" disabled>${labelOk}</button>
        </div>
      </div>`;
    document.body.appendChild(m);

    // Ensure theme if app hasn't set it yet
    try{
      const body=document.body;
      if (!body.getAttribute('data-theme')){
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      }
    }catch(_){}

    const uiFlagsEl = m.querySelector('#setupUiFlags');
    const studyFlagsEl = m.querySelector('#setupStudyFlags');
    const listEl = m.querySelector('#setupDictList');
    const okBtn = m.querySelector('#setupConfirm');

    function activeUi(){ return (uiFlagsEl.querySelector('.flagBtn.active')?.dataset.code)||'uk'; }
    function activeStudy(){ return (studyFlagsEl.querySelector('.flagBtn.active')?.dataset.code)||null; }

    function rerenderStaticLabels(code){
      const lab = L(code);
      m.querySelector('h2').textContent = (I18N[code]?.setupTitle)||lab.setupTitle;
      m.querySelectorAll('.field .label')[0].textContent = (I18N[code]?.uiLanguage)||lab.uiLanguage;
      m.querySelectorAll('.field .label')[1].textContent = (I18N[code]?.studyLanguage)||lab.studyLanguage;
      m.querySelectorAll('.field .label')[2].textContent = (I18N[code]?.chooseDeck)||lab.chooseDeck;
      okBtn.textContent = (I18N[code]?.ok || I18N[code]?.confirm || lab.ok);
    }

    function renderUiFlags(){
      uiFlagsEl.innerHTML = '';
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
          if (activeStudy()) renderDecks(activeStudy());
        });
        uiFlagsEl.appendChild(b);
      });
    }

    function renderStudyFlags(){
      studyFlagsEl.innerHTML='';
      const langs = Array.from(new Set(Object.keys(window.decks||{}).map(k=>k.split('_')[0]))).filter(Boolean);
      const cur = (get(LS.studyLang)||'').toLowerCase();
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
          renderDecks(code);
        });
        studyFlagsEl.appendChild(b);
      });
    }

    function renderDecks(langCode){
      listEl.innerHTML='';
      const keys = Object.keys(window.decks||{}).filter(k=>k.startsWith(langCode+'_'));
      keys.forEach(key=>{
        const words = (window.App&&App.Decks&&App.Decks.resolveDeckByKey)?(App.Decks.resolveDeckByKey(key)||[]):[];
        const row = document.createElement('div');
        row.className = 'dictRow' + ((get(LS.deckKey)===key)?' active':'');
        row.dataset.key = key;

        const flag = document.createElement('div');
        flag.className='dictFlag';
        flag.textContent = (window.App&&App.Decks&&App.Decks.flagForKey)?App.Decks.flagForKey(key, words):'🏳️';

        const name = document.createElement('div');
        name.className='dictName';
        name.textContent = (window.App&&App.Decks&&App.Decks.resolveNameByKey)?App.Decks.resolveNameByKey(key):key;

        const actions = document.createElement('div');
        actions.className='dictActions';
        const eye=document.createElement('button');
        eye.className='iconOnly';
        eye.title=(window.App&&App.i18n&&App.i18n().ttPreview)||'Предпросмотр';
        eye.textContent='👁️';
        eye.addEventListener('click',(e)=>{
          e.stopPropagation();
          if (window.App&&App.Decks&&typeof App.Decks.openPreview==='function') App.Decks.openPreview(words, name.textContent);
        });
        actions.appendChild(eye);

        row.appendChild(flag); row.appendChild(name); row.appendChild(actions);
        row.addEventListener('click',()=>{
          listEl.querySelectorAll('.dictRow').forEach(x=>x.classList.remove('active'));
          row.classList.add('active');
          set(LS.deckKey, key);
          okBtn.disabled = false;
        });
        listEl.appendChild(row);
      });

      // Strict 4 rows height
      try{
        const first=listEl.querySelector('.dictRow');
        if (first){
          const h = first.getBoundingClientRect().height;
          const gap = 6; // from .dictList gap in CSS
          const max = Math.round(h*4 + gap*3);
          listEl.style.maxHeight = max+'px';
          listEl.style.overflowY='auto';
        }
      }catch(_){}
    }

    renderUiFlags();
    renderStudyFlags();
    okBtn.disabled = !get(LS.deckKey);

    // open modal
    m.classList.remove('hidden');

    okBtn.addEventListener('click', ()=>{
      const ui = activeUi() || 'uk';
      const st = activeStudy() || get(LS.studyLang) || '';
      const deck = get(LS.deckKey);
      if (!deck) return;
      set(LS.uiLang, ui);
      set(LS.studyLang, st);
      set(LS.deckKey, deck);
      set(LS.setupDone, 'true');
      set(LS.legacyActiveKey, deck);
      if (window.App && App.settings) App.settings.lang = ui;
      m.remove();
      document.dispatchEvent(new CustomEvent('lexitron:setup:done', { detail:{ uiLang:ui, studyLang:st, deckKey:deck } }));
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
