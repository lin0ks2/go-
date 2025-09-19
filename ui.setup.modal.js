
/* ui.setup.modal.js — первичный мастер выбора языка UI / языка тренировки / словаря
   Бэкомпат: не ломает существующую логику. Работает один раз, затем читает из localStorage.
*/
(function(){
  var LS = {
    uiLang:'lexitron.uiLang',
    studyLang:'lexitron.studyLang',
    deckKey:'lexitron.deckKey',
    setupDone:'lexitron.setupDone',
    legacyActive:'lexitron.activeKey' // для совместимости со старым кодом
  };

  function get(k, d){ try{ var v = localStorage.getItem(k); return (v===null?d:v); }catch(e){ return d; } }
  function set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

  function t(key){
    try{
      var bag = (window.I18N && (I18N[(get(LS.uiLang,'ru')||'ru').toLowerCase()]||I18N['ru'])) || {};
      return bag[key] || key;
    }catch(_){ return key; }
  }

  // Доступные языки тренировки — по ключам словарей
  function studyLangs(){
    var keys = (window.App && App.Decks && App.Decks.builtinKeys) ? App.Decks.builtinKeys() : Object.keys(window.decks||{});
    var set = {};
    keys.forEach(function(k){
      var lg = (App.Decks && App.Decks.langOfKey) ? App.Decks.langOfKey(k) : String(k).slice(0,2).toLowerCase();
      if (lg) set[lg] = true;
    });
    return Object.keys(set).sort();
  }

  function decksForLang(lg){
    var keys = (window.App && App.Decks && App.Decks.builtinKeys) ? App.Decks.builtinKeys() : Object.keys(window.decks||{});
    return keys.filter(function(k){
      var kk = (App.Decks && App.Decks.langOfKey) ? App.Decks.langOfKey(k) : String(k).slice(0,2).toLowerCase();
      return kk === String(lg||'').toLowerCase();
    });
  }

  function deckTitle(key){
    return (App.Decks && App.Decks.resolveNameByKey) ? App.Decks.resolveNameByKey(key) : String(key);
  }
  function deckFlag(key){
    return (App.Decks && App.Decks.flagForKey) ? App.Decks.flagForKey(key) : '🌐';
  }

  function openModal(){
    // UI язык: ru/uk (и en если есть)
    var uiCurrent = (get(LS.uiLang) || (window.App && App.settings && App.settings.lang) || 'ru').toLowerCase();
    var allStudy = studyLangs();
    var studyCurrent = (get(LS.studyLang) || (allStudy[0]||'de')).toLowerCase();

    // deck по умолчанию
    var preDeck = get(LS.deckKey) || get(LS.legacyActive) || '';
    if (!preDeck){
      var list = decksForLang(studyCurrent);
      preDeck = list[0] || '';
    }

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="backdrop" data-close></div>'+
      '<div class="dialog">'+
        '<h2>'+ (t('setupTitle')||'Первичная настройка') +'</h2>'+

        '<div class="langBlock">'+
          '<div class="label">'+ (t('uiLanguage')||'Язык интерфейса') +'</div>'+
          '<div class="langFlags" id="uiFlags"></div>'+
        '</div>'+

        '<div class="langBlock">'+
          '<div class="label">'+ (t('studyLanguage')||'Язык тренировки') +'</div>'+
          '<div class="langFlags" id="studyFlags"></div>'+
        '</div>'+

        '<div class="langBlock">'+
          '<div class="label">'+ (t('chooseDeck')||'Выберите словарь') +'</div>'+
          '<div class="dictList" id="deckList" role="listbox" aria-label="'+(t('chooseDeck')||'Выберите словарь')+'"></div>'+
        '</div>'+

        '<div class="modalActions"><button class="primary" id="setupConfirm" disabled>'+ (t('ok')||t('confirm')||'OK') +'</button></div>'+
      '</div>';

    function mount(){
      document.body.appendChild(modal);
      // заполнить флаги UI
      var uiFlags = modal.querySelector('#uiFlags');
      var uiLangs = ['ru','uk'];
      if (window.I18N && I18N.en) uiLangs.push('en');
      uiLangs.forEach(function(code){
        var btn = document.createElement('button');
        btn.type='button'; btn.className='flagBtn'+(code===uiCurrent?' active':''); btn.dataset.code = code;
        btn.textContent = code==='ru'?'🇷🇺':(code==='uk'?'🇺🇦':(code==='en'?'🇬🇧':'🌐'));
        btn.title = code.toUpperCase();
        uiFlags.appendChild(btn);
      });

      // флаги языков тренировки
      var studyFlags = modal.querySelector('#studyFlags');
      allStudy.forEach(function(code){
        var btn = document.createElement('button');
        btn.type='button'; btn.className='flagBtn'+(code===studyCurrent?' active':''); btn.dataset.code = code;
        // используем flagForKey по одному из словарей данного языка
        var sampleKey = (decksForLang(code)[0]||'');
        var emoji = sampleKey ? deckFlag(sampleKey) : '🌐';
        btn.textContent = emoji;
        btn.title = code.toUpperCase();
        studyFlags.appendChild(btn);
      });

      function renderDecks(lg){
        var host = modal.querySelector('#deckList');
        host.innerHTML = '';
        var list = decksForLang(lg);
        list.forEach(function(key){
          var row = document.createElement('div');
          row.className = 'dictRow'+(key===preDeck?' active':'');
          row.setAttribute('role','option');
          row.dataset.key = key;
          row.innerHTML =
            '<div class="dictFlag">'+ deckFlag(key) +'</div>'+
            '<div class="dictName">'+ deckTitle(key) +'</div>'+
            '<div class="dictActions"><button class="iconOnly" title="'+(t('ttPreview')||'Предпросмотр')+'" data-preview>👁️</button></div>';
          host.appendChild(row);
        });
        modal.querySelector('#setupConfirm').disabled = !host.querySelector('.dictRow.active');
      }

      renderDecks(studyCurrent);

      // handlers
      uiFlags.addEventListener('click', function(ev){
        var btn = ev.target.closest('.flagBtn'); if (!btn) return;
        uiFlags.querySelectorAll('.flagBtn').forEach(function(b){ b.classList.toggle('active', b===btn); });
        uiCurrent = btn.dataset.code.toLowerCase();
        set(LS.uiLang, uiCurrent);
        // Переведём подписи без перезагрузки
        try {
          modal.querySelector('h2').textContent = t('setupTitle')||'Первичная настройка';
          modal.querySelectorAll('.label')[0].textContent = t('uiLanguage')||'Язык интерфейса';
          modal.querySelectorAll('.label')[1].textContent = t('studyLanguage')||'Язык тренировки';
          modal.querySelectorAll('.label')[2].textContent = t('chooseDeck')||'Выберите словарь';
          modal.querySelector('#setupConfirm').textContent = t('ok')||t('confirm')||'OK';
        } catch(_){}
      });

      studyFlags.addEventListener('click', function(ev){
        var btn = ev.target.closest('.flagBtn'); if (!btn) return;
        studyFlags.querySelectorAll('.flagBtn').forEach(function(b){ b.classList.toggle('active', b===btn); });
        studyCurrent = btn.dataset.code.toLowerCase();
        set(LS.studyLang, studyCurrent.toUpperCase());
        preDeck = ''; // сбрасываем выбранный словарь
        renderDecks(studyCurrent);
      });

      modal.querySelector('#deckList').addEventListener('click', function(ev){
        var row = ev.target.closest('.dictRow'); if (!row) return;
        modal.querySelectorAll('.dictRow').forEach(function(r){ r.classList.toggle('active', r===row); });
        preDeck = row.dataset.key;
        modal.querySelector('#setupConfirm').disabled = false;
      });

      modal.querySelector('#deckList').addEventListener('click', function(ev){
        var btn = ev.target.closest('button[data-preview]'); if (!btn) return;
        var row = ev.target.closest('.dictRow'); if (!row) return;
        try{
          var words = (App.Decks && App.Decks.resolveDeckByKey) ? App.Decks.resolveDeckByKey(row.dataset.key) : [];
          (App.Decks && App.Decks.openPreview) && App.Decks.openPreview(words, deckTitle(row.dataset.key));
        }catch(_){}
      });

      modal.querySelector('#setupConfirm').addEventListener('click', function(){
        if (!preDeck) return;
        set(LS.deckKey, preDeck);
        set(LS.legacyActive, preDeck); // для старого кода
        set(LS.setupDone, 'true');
        // применим язык UI немедленно
        try{ window.App = window.App||{}; App.settings = App.settings||{}; App.settings.lang = uiCurrent; }catch(_){}
        close();
        document.dispatchEvent(new CustomEvent('lexitron:setup:done', { detail:{ uiLang:uiCurrent, studyLang:studyCurrent.toUpperCase(), deckKey:preDeck } }));
      });

      modal.addEventListener('click', function(ev){
        if (ev.target.hasAttribute('data-close')) close();
      });
    }

    function close(){
      modal.classList.add('hidden');
      setTimeout(function(){ if (modal && modal.parentNode) modal.parentNode.removeChild(modal); }, 120);
    }

    mount();
  }

  window.SetupModal = {
    shouldShow: function(){
      return get(LS.setupDone) !== 'true';
    },
    show: function(){ openModal(); },
    keys: LS
  };
})();
