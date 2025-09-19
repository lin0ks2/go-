
/* app.addon.startup.js — thin wrapper that delegates to StartupManager.gate() */
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
        console.error('[startup] StartupManager.gate() не найден. Проверь порядок подключения.');
      }
    } catch(e){
      console.error('[startup] gate failed', e);
    }
  });
})();
