
/* app.progress.js - scoped persistent progress buckets (lang -> dict -> set -> {stars, successes, lastSeen}) */
(function(){
  var App = window.App || (window.App = {});
  var LS_KEY = 'progress.v2';
  var cache = null;
  function load(){
    if (cache) return cache;
    try{
      var raw = localStorage.getItem(LS_KEY);
      cache = raw ? JSON.parse(raw) : {};
    }catch(e){ cache = {}; }
    return cache;
  }
  var saveScheduled = false;
  function saveNow(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(cache||{})); }catch(e){}
  }
  function save(){
    if (saveScheduled) return;
    saveScheduled = true;
    setTimeout(function(){ saveScheduled=false; saveNow(); }, 150);
  }
  function bucket(lang, dictKey, setIndex){
    var db = load();
    if (!db[lang]) db[lang] = {};
    if (!db[lang][dictKey]) db[lang][dictKey] = {};
    if (!db[lang][dictKey][setIndex]) db[lang][dictKey][setIndex] = { stars:{}, successes:{}, lastSeen:{} };
    return db[lang][dictKey][setIndex];
  }
  function ctx(){
    var lang = (App.settings && App.settings.lang) || 'ru';
    var dictKey = (App.dictRegistry && App.dictRegistry.activeKey) || (App.Decks && App.Decks.pickDefaultKey && App.Decks.pickDefaultKey()) || 'unknown';
    var setIndex = (App.Sets && App.Sets.getActiveSetIndex && App.Sets.getActiveSetIndex()) || 0;
    return { lang: lang, dictKey: dictKey, setIndex: setIndex, bucket: bucket(lang, dictKey, setIndex) };
  }
  App.Progress = {
    load: load,
    save: save,
    getBucket: function(lang, dictKey, setIndex){ return bucket(lang, dictKey, setIndex); },
    current: ctx,
    getStars: function(wordId){
      var c = ctx(); return (c.bucket.stars && c.bucket.stars[wordId]) || 0;
    },
    setStars: function(wordId, value){
      var c = ctx(); c.bucket.stars[String(wordId)] = value|0; save(); return value|0;
    },
    incSuccess: function(wordId){
      var c = ctx(); c.bucket.successes[String(wordId)] = (c.bucket.successes[String(wordId)]||0)+1; save(); return c.bucket.successes[String(wordId)];
    },
    setLastSeen: function(wordId, ts){
      var c = ctx(); c.bucket.lastSeen[String(wordId)] = ts||Date.now(); save(); return c.bucket.lastSeen[String(wordId)];
    },
    starsForWordIn: function(lang, dictKey, setIndex, wordId){
      var b = bucket(lang, dictKey, setIndex); return (b.stars && b.stars[String(wordId)]) || 0;
    }
  };
})();
