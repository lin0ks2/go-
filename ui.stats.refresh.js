// ui.stats.refresh.js — v2: sync top/bottom stats after answers & set changes
(function(){
  function refresh(){
    try{ if (typeof renderSetStats === 'function') renderSetStats(); }catch(e){}
    try{ if (typeof updateStats === 'function') updateStats(); }catch(e){}
  }
  function hook(name){
    var w = window;
    if (typeof w[name] !== 'function') return;
    var orig = w[name];
    w[name] = function(){
      var r = orig.apply(this, arguments);
      try{ refresh(); }catch(e){}
      return r;
    };
  }
  hook('onChoice');
  hook('onIDontKnow');
  hook('nextWord');

  try{
    if (window.App && App.Sets && typeof App.Sets.setActiveSetIndex === 'function'){
      var _set = App.Sets.setActiveSetIndex;
      App.Sets.setActiveSetIndex = function(i){
        var r = _set.apply(this, arguments);
        try{ refresh(); }catch(e){}
        return r;
      };
    }
  }catch(e){}
})();
