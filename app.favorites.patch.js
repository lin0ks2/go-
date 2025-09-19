
/* app.favorites.patch.js — scoped clear for favorites per dict language */
(function(){
  const App = window.App || (window.App = {});

  function _langOfKey(k){
    try{
      const m = String(k||'').match(/^([a-z]{2})_/i);
      return m ? m[1].toLowerCase() : null;
    }catch(e){ return null; }
  }

  function _activeDictLang(){
    if (App.settings && App.settings.dictsLangFilter) return App.settings.dictsLangFilter;
    const key = (App.dictRegistry && App.dictRegistry.activeKey) || null;
    return _langOfKey(key) || 'de';
  }

  App.clearFavoritesForLang = function(dictLang){
    try{
      const lang = dictLang || _activeDictLang();
      const st = (App.state && App.state.favorites_v2) ? App.state.favorites_v2 : null;
      if (!st) return;
      Object.keys(st).forEach(function(sourceKey){
        if (_langOfKey(sourceKey) === lang) delete st[sourceKey];
      });
      App.saveState && App.saveState();
    }catch(e){}
  };

  // Keep global clear as a compatibility fallback
  App.clearFavoritesAll = App.clearFavoritesAll || function(){
    try { if (App.state) App.state.favorites_v2 = {}; App.saveState && App.saveState(); } catch(e){}
  };
})();
