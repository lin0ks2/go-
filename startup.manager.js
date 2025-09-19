
/* startup.manager.js — single source of truth for startup (v1)
   Responsibilities:
   - Read persisted setup (uiLang, studyLang, deckKey, setupDone)
   - Gate first-run: show SetupModal when needed (or when forced via ?setup=1)
   - Validate/fix deckKey: if missing/invalid → pick first deck of studyLang, else first available
   - Apply UI language (App.settings.lang)
   - Boot app (App.bootstrap) without any old auto-selection logic
   - Migrate legacy activeKey once for backward compatibility
*/
(function(){
  const LS = {
    uiLang: 'lexitron.uiLang',
    studyLang: 'lexitron.studyLang',
    deckKey: 'lexitron.deckKey',
    setupDone: 'lexitron.setupDone',
    legacyActiveKey: 'lexitron.activeKey'
  };

  const M = (window.StartupManager = {
    log(...a){ try{ console.debug('[Startup]', ...a); }catch(_){}},
    get(k, d){ try{ const v = localStorage.getItem(k); return v===null?d:v; }catch(_){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, v); }catch(_){ } },

    builtinKeys(){
      try{
        if (window.App && App.Decks && typeof App.Decks.builtinKeys==='function') return App.Decks.builtinKeys();
        return Object.keys(window.decks||{});
      }catch(_){ return []; }
    },
    firstLang(){
      const keys = M.builtinKeys();
      if (!keys.length) return null;
      const lang = String(keys[0]).split('_')[0] || null;
      return lang;
    },
    firstDeckForLang(lang){
      const keys = M.builtinKeys().filter(k=>String(k).startsWith((lang||'').toLowerCase()+'_'));
      return keys[0] || null;
    },
    deckExists(key){
      try { return key && window.decks && Array.isArray(window.decks[key]) && window.decks[key].length > 0; } catch(_){ return false; }
    },

    readSettings(){
      const uiLang = M.get(LS.uiLang) || (window.App && App.settings && App.settings.lang) || 'uk';
      const studyLang = M.get(LS.studyLang) || null;
      const deckKey = M.get(LS.deckKey) || M.get(LS.legacyActiveKey) || null;
      const setupDone = M.get(LS.setupDone) === 'true';
      return { uiLang: (uiLang||'uk').toLowerCase(), studyLang, deckKey, setupDone };
    },

    shouldShowSetup(initial){
      // force via ?setup=1
      try{
        if (/(?:\?|&)setup=1(?:&|$)/.test(location.search)) return true;
      }catch(_){}
      if (!initial.setupDone) return true;
      // if no valid deck stored — require setup
      if (!M.deckExists(initial.deckKey)) return true;
      return false;
    },

    validateAndFix(initial){
      let { uiLang, studyLang, deckKey } = initial;

      // Ensure UI lang applied early
      try{
        if (window.App && App.settings) App.settings.lang = uiLang;
        M.set(LS.uiLang, uiLang);
      }catch(_){}

      // If deck is valid — keep it, derive studyLang from it if missing
      if (M.deckExists(deckKey)){
        if (!studyLang) {
          try{ studyLang = String(deckKey).split('_')[0] || studyLang; }catch(_){}
        }
        return { uiLang, studyLang, deckKey };
      }

      // Deck invalid/missing → try by studyLang
      if (studyLang){
        const first = M.firstDeckForLang(studyLang);
        if (first){
          deckKey = first;
          return { uiLang, studyLang, deckKey };
        }
      }

      // No studyLang → pick first available
      const lang = M.firstLang();
      const first = lang && M.firstDeckForLang(lang);
      if (first){
        studyLang = lang;
        deckKey = first;
        return { uiLang, studyLang, deckKey };
      }

      // Nothing available
      return { uiLang, studyLang: null, deckKey: null };
    },

    persist(state){
      if (state.uiLang) M.set(LS.uiLang, state.uiLang);
      if (state.studyLang) M.set(LS.studyLang, state.studyLang);
      if (state.deckKey) {
        M.set(LS.deckKey, state.deckKey);
        // legacy for backward compatibility
        M.set(LS.legacyActiveKey, state.deckKey);
      }
    },

    boot(state){
      // At this point we assume decks are already loaded (as in current project).
      // If ever we switch to lazy-load, this is where we would ensure deck bundle for state.deckKey is present.
      if (!state.deckKey){
        alert('Нет доступных словарей для старта.');
        throw new Error('No deck to start');
      }
      try{
        if (window.App && typeof App.bootstrap === 'function'){
          App.bootstrap();
          M.log('boot ok with deck', state.deckKey);
        }else{
          console.error('[Startup] App.bootstrap не найден');
        }
      }catch(e){
        console.error('[Startup] boot failed', e);
      }
    },

    gate(){
      const initial = M.readSettings();
      M.log('initial', initial);

      if (M.shouldShowSetup(initial) && window.SetupModal && typeof SetupModal.build==='function'){
        M.log('show setup modal');
        document.addEventListener('lexitron:setup:done', function(ev){
          const after = M.readSettings(); // read values saved by modal
          const fixed = M.validateAndFix(after);
          M.persist(fixed);
          // mark setup done to skip next time
          M.set(LS.setupDone, 'true');
          M.log('setup done', fixed);
          M.boot(fixed);
        }, { once:true });
        SetupModal.build();
        return;
      }

      // Setup not required → validate/fix and boot
      const fixed = M.validateAndFix(initial);
      M.persist(fixed);
      M.log('continue without setup', fixed);
      M.boot(fixed);
    }
  });
})();
