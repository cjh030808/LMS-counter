// injected.js - runs in page context (not isolated). Accesses window.jwplayer directly.
(function() {
  'use strict';

  function safe(fn) {
    try { fn(); } catch(e) { console.error('injected.js error', e); }
  }

  function setupJW() {
    if (typeof window.jwplayer !== 'function') {
      // jwplayer not yet available
      return false;
    }

    safe(function() {
      // detach previous time listeners to avoid duplicates
      try { jwplayer().off('time'); } catch(e){ /* ignore */ }

      jwplayer().on('time', function(ev) {
        // ev may have currentTime or position depending on version; normalize to .position
        const position = ev.position !== undefined ? ev.position : (ev.currentTime !== undefined ? ev.currentTime : ev.currentTime);
        window.postMessage({ type: 'JW_TIME', position: position }, '*');
      });
    });

    // listen for commands from content script (sent via window.postMessage)
    window.addEventListener('message', function(event) {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'EXTENSION_COMMAND') return;
      const action = event.data.action;
      const payload = event.data.payload || {};
      safe(function() {
        switch(action) {
          case 'seek':
            if (typeof payload.time === 'number') jwplayer().seek(payload.time);
            break;
          case 'setPlaybackRate':
            if (typeof payload.rate === 'number') jwplayer().setPlaybackRate(payload.rate);
            break;
          case 'pause':
            jwplayer().pause();
            break;
          case 'play':
            jwplayer().play();
            break;
          default:
            // unknown
            break;
        }
      });
    });

    return true;
  }

  // try to setup now, if jwplayer not present, poll a few times
  (function trySetup(retries) {
    if (setupJW()) return;
    if (retries <= 0) return;
    setTimeout(function() { trySetup(retries - 1); }, 500);
  })(10);

})();
