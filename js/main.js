(function (GC) {
  function start() {
    GC.render();
    GC.initJoin();
    GC.initTerminal();
    GC.ui.nav();
    GC.ui.spotlight();
    GC.ui.counters();
    GC.ui.timelineProgress();
    GC.ui.reveal();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(window.GC);
