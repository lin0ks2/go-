
/* app.addon.startup.js — thin wrapper delegating to StartupManager */
(function(){
  function onReady(fn){
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }
  onReady(function(){
    try {
      if (window.StartupManager && typeof StartupManager.gate === 'function'){
        StartupManager.gate();
      } else {
        console.error('[startup] StartupManager.gate() не найден — проверь порядок скриптов.');
      }
    } catch(e){
      console.error('[startup] gate failed', e);
    }
  });
})();
