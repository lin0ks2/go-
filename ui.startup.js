
// ui.startup.js
(function(){
  const App = window.App||{};
  App.settings = App.settings || {};
  if (!App.settings.dictsLangFilter) App.settings.dictsLangFilter = 'en';
  try{
    if (!App.dictRegistry || !App.dictRegistry.activeKey){
      const keys = Object.keys(window.decks || {});
      const en = keys.find(k => /^en[_-]/i.test(k));
      if (en){
        App.dictRegistry = App.dictRegistry || {};
        App.dictRegistry.activeKey = en;
        App.saveDictRegistry && App.saveDictRegistry();
      } else if (App.Decks && typeof App.Decks.pickDefaultKey==='function'){
        App.Decks.pickDefaultKey();
      }
    }
  }catch(e){}
  try{ UIState.syncTrainer(); }catch(e){}
  try{ typeof renderDictList==='function' && renderDictList(); }catch(e){}
  try{ App.renderSetsBar && App.renderSetsBar(); }catch(e){}
  try{ typeof renderSetStats==='function' && renderSetStats(); }catch(e){}
  try{ typeof renderCard==='function' && renderCard(true); }catch(e){}
  try{ typeof updateStats==='function' && updateStats(); }catch(e){}
})();
