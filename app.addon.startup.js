
/* app.addon.startup.js — thin wrapper, no legacy defaults */
(function(){
  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }
  onReady(function(){
    try{
      if (window.StartupManager && typeof StartupManager.gate === 'function') {
        StartupManager.gate();   // single source of truth
      } else {
        console.error('[startup] StartupManager.gate() not found – check script order');
      }
    }catch(e){
      console.error('[startup] gate failed', e);
    }
  });
})();
