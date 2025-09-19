
// ui.setup.modal.js — Setup wizard using same UI as dicts modal
(function(){
  const LS = {
    uiLang: 'lexitron.uiLang',
    studyLang: 'lexitron.studyLang',
    deckKey: 'lexitron.deckKey',
    setupDone: 'lexitron.setupDone',
    legacyActiveKey: 'lexitron.activeKey'
  };

  function safeGet(k, def){ try{ const v = localStorage.getItem(k); return v===null?def:v; }catch(_){ return def; } }
  function safeSet(k, v){ try{ localStorage.setItem(k, v); }catch(_){ } }

  function i18n(key, def){
    try{
      const lang = (safeGet(LS.uiLang) || (window.App && App.settings && App.settings.lang) || 'uk');
      const bag = (window.I18N && I18N[lang]) || I18N.uk || {};
      return bag[key] || def || key;
    }catch(_){ return def || key; }
  }

  function build(){
    const modal = document.createElement('div');
    modal.id = 'setupModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <h2>${i18n('setupTitle','Первичная настройка')}</h2>
        <div class="field">
          <div class="label">${i18n('uiLanguage','Язык интерфейса')}</div>
          <div class="langFlags" id="setupUiFlags"></div>
        </div>
        <div class="field">
          <div class="label">${i18n('studyLanguage','Язык тренировки')}</div>
          <div class="langFlags" id="setupStudyFlags"></div>
        </div>
        <div class="field">
          <div class="label">${i18n('chooseDeck','Выберите словарь')}</div>
          <div class="dictList" id="setupDictList"></div>
        </div>
        <div class="modalActions">
          <button id="setupConfirm" class="primary" disabled>${i18n('ok','OK')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    function open(){ modal.classList.remove('hidden'); }
    function close(){ modal.remove(); }

    // UI flags
    const uiFlagsEl = modal.querySelector('#setupUiFlags');
    const uiCandidates = Object.keys(window.I18N||{}).filter(c => ['ru','uk','en'].includes(c));
    const currentUi = (safeGet(LS.uiLang) || (App.settings&&App.settings.lang) || 'uk').toLowerCase();
    (uiCandidates.length?uiCandidates:['ru','uk']).forEach(code => {
      const b = document.createElement('button');
      b.className = 'flagBtn'+(code===currentUi?' active':'');
      b.textContent = code.toUpperCase();
      b.dataset.code = code;
      b.addEventListener('click', ()=>{
        uiFlagsEl.querySelectorAll('.flagBtn').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        safeSet(LS.uiLang, code);
        if(App.settings) App.settings.lang = code;
      });
      uiFlagsEl.appendChild(b);
    });

    // Study flags
    const studyFlagsEl = modal.querySelector('#setupStudyFlags');
    const langs = Array.from(new Set(Object.keys(window.decks||{}).map(k=>k.split('_')[0])));
    const currentStudy = (safeGet(LS.studyLang) || langs[0] || 'de').toLowerCase();
    langs.forEach(code => {
      const b = document.createElement('button');
      b.className = 'flagBtn'+(code===currentStudy?' active':'');
      b.textContent = code.toUpperCase();
      b.dataset.code = code;
      b.addEventListener('click', ()=>{
        studyFlagsEl.querySelectorAll('.flagBtn').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        safeSet(LS.studyLang, code);
        renderDecks(code);
      });
      studyFlagsEl.appendChild(b);
    });

    const listEl = modal.querySelector('#setupDictList');
    function renderDecks(langCode){
      listEl.innerHTML='';
      const decks = Object.keys(window.decks||{}).filter(k=>k.startsWith(langCode+'_'));
      decks.forEach(dk=>{
        const row = document.createElement('div');
        row.className = 'dictRow';
        row.innerHTML = `<span class="dictFlag"></span><span class="dictName">${App.Decks.resolveNameByKey(dk)}</span><span class="dictEye">👁</span>`;
        row.dataset.key = dk;
        row.addEventListener('click', ()=>{
          listEl.querySelectorAll('.dictRow').forEach(x=>x.classList.remove('active'));
          row.classList.add('active');
          safeSet(LS.deckKey, dk);
          modal.querySelector('#setupConfirm').disabled = false;
        });
        listEl.appendChild(row);
      });
      // limit visible height to 4 rows
      listEl.style.maxHeight = (listEl.querySelector('.dictRow')? (listEl.querySelector('.dictRow').offsetHeight*4)+'px':'12em');
      listEl.style.overflow='auto';
    }
    if(currentStudy) renderDecks(currentStudy);

    modal.querySelector('#setupConfirm').addEventListener('click', ()=>{
      const ui = (uiFlagsEl.querySelector('.flagBtn.active')?.dataset.code) || 'uk';
      const st = (studyFlagsEl.querySelector('.flagBtn.active')?.dataset.code) || currentStudy || 'de';
      const deck = safeGet(LS.deckKey);
      if(!deck) return;
      safeSet(LS.uiLang, ui);
      safeSet(LS.studyLang, st);
      safeSet(LS.deckKey, deck);
      safeSet(LS.setupDone, 'true');
      safeSet(LS.legacyActiveKey, deck);
      if(App.settings) App.settings.lang = ui;
      close();
      document.dispatchEvent(new CustomEvent('lexitron:setup:done',{detail:{uiLang:ui,studyLang:st,deckKey:deck}}));
    });

    open();
  }

  function shouldShow(){ return safeGet(LS.setupDone) !== 'true'; }

  window.SetupModal = { build, shouldShow, LS };
})();
