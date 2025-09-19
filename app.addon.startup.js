/* app.addon.startup.js v1.0.0 — отделённый запуск и подключение словарей */
(function(){
  const App = window.App || (window.App = {});
  if (!App.dictRegistry) App.dictRegistry = { activeKey:null, user:{} };

  function pickDefaultKey(){
    const keys = Object.keys(window.decks || {});
    if (!keys.length) {
      console.warn('[startup] Нет доступных словарей (window.decks пуст).');
      return null;
    }
    if (App.dictRegistry.activeKey && keys.includes(App.dictRegistry.activeKey))
      return App.dictRegistry.activeKey;
    try{
      const saved = localStorage.getItem('lexitron.activeKey');
      if (saved && keys.includes(saved)) {
        App.dictRegistry.activeKey = saved;
        return saved;
      }
    }catch(e){ /* ignore */ }
    App.dictRegistry.activeKey = keys[0];
    return App.dictRegistry.activeKey;
  }

  function ensureDictionaries(){
    if (!window.decks || !Object.keys(window.decks).length){
      console.warn('[startup] Похоже, словари ещё не загружены (window.decks). Убедись, что dicts.js подключён раньше.');
    }
  }

  
function start(){
  ensureDictionaries();

  // Decide if we must show first-run setup
  var force = false;
  try { force = /(?:\?|&)setup=1(?:&|$)/.test(location.search); } catch(_){}
  function noValidDeck(){
    try {
      var dk = localStorage.getItem('lexitron.deckKey') || localStorage.getItem('lexitron.activeKey');
      if (!dk) return true;
      if (!window.decks || !Array.isArray(window.decks[dk]) || window.decks[dk].length < 4) return true;
      return false;
    } catch(_){ return true; }
  }

  var needSetup = false;
  try {
    needSetup = (window.SetupModal && typeof SetupModal.shouldShow==='function' && SetupModal.shouldShow()) || force || noValidDeck();
  } catch(_){ needSetup = force || noValidDeck(); }

  if (needSetup && window.SetupModal && typeof SetupModal.build==='function'){
    document.addEventListener('lexitron:setup:done', function(){
      pickDefaultKey();
      if (typeof App.bootstrap === 'function') App.bootstrap();
      else console.error('[startup] App.bootstrap не найден.');
    }, { once:true });
    SetupModal.build();
    return;
  }

  // Normal path
  pickDefaultKey();
  if (typeof App.bootstrap === 'function') {
    App.bootstrap();
  } else {
    console.error('[startup] App.bootstrap не найден. Проверь порядок подключения скриптов.');
  }
}

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
