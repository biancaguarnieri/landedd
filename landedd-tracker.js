// landedd-tracker.js
// Lightweight client-side analytics tracker. Drop on every page that should
// be counted in the unified dashboard.
//
// Usage:
//   <script src="/landedd-tracker.js" data-site="main"></script>
//   <script src="/landedd-tracker.js" data-site="title38"></script>
//
// Auto-fires on load:
//   - user_signed_up   (once per visitor, per site, persisted in localStorage)
//   - app_opened       (once per session, persisted in sessionStorage)
//
// Manual API exposed on window.LandeddTrack:
//   LandeddTrack.run(toolName)            — call when AI output completes
//   LandeddTrack.rate('positive')         — call on thumbs up/down
//   LandeddTrack.download()               — call on resume export
//   LandeddTrack.wtp(tier)                — call on WTP response
//   LandeddTrack.feedback(rating)         — call on feedback submit
//
// UTM/ref handling:
//   Reads ?utm_source=, ?ref= from URL on first visit, persists in localStorage
//   so subsequent events from the same visitor still attribute correctly.

(function () {
  'use strict';

  // Read site from script tag's data-site attribute. Default to 'main'.
  var scriptTag = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf('landedd-tracker') !== -1) return scripts[i];
    }
    return null;
  })();
  var SITE = (scriptTag && scriptTag.getAttribute('data-site')) || 'main';
  if (SITE !== 'main' && SITE !== 'title38') SITE = 'main';

  var ENDPOINT = '/api/metrics';
  var VISITOR_KEY = 'ld_visitor_' + SITE;
  var SESSION_KEY = 'ld_session_' + SITE;
  var SOURCE_KEY  = 'ld_source_'  + SITE;

  // Extract UTM/ref from URL and persist
  function captureSource() {
    try {
      var params = new URLSearchParams(window.location.search);
      var utm = params.get('utm_source') || params.get('ref') || '';
      if (utm) {
        localStorage.setItem(SOURCE_KEY, utm);
        return utm;
      }
      // Fall back to stored value from previous visit
      return localStorage.getItem(SOURCE_KEY) || '';
    } catch (e) { return ''; }
  }

  function send(payload) {
    try {
      payload.site = SITE;
      var src = localStorage.getItem(SOURCE_KEY);
      if (src) payload.utm_source = src;

      // Use sendBeacon if available for reliability on page unload
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(ENDPOINT, blob);
        return;
      }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function once(storageKey, storage, eventName) {
    try {
      if (storage.getItem(storageKey)) return false;
      storage.setItem(storageKey, '1');
      send({ event: eventName });
      return true;
    } catch (e) { return false; }
  }

  // Auto-fire on page load
  function init() {
    captureSource();
    once(VISITOR_KEY, localStorage,    'user_signed_up');
    once(SESSION_KEY, sessionStorage,  'app_opened');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose manual tracking API
  window.LandeddTrack = {
    site: SITE,
    run: function (toolName) {
      send({ event: 'ai_output_generated', feature: toolName });
    },
    rate: function (direction) {
      send({ event: 'ai_output_rated', rating: direction });
    },
    download: function () {
      send({ event: 'resume_downloaded_or_saved' });
    },
    wtp: function (tier) {
      send({ event: 'wtp_response', tier: tier });
    },
    feedback: function (stars) {
      send({ event: 'feedback_submitted', rating: stars });
    }
  };
})();
