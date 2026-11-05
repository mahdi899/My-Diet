// Anonymous interaction telemetry. Configure a receiver before enabling consent.
(() => {
  let enabled = false;
  let endpoint = null;
  let step = 'intro';
  let elapsed = 0;
  let since = performance.now();
  const session = crypto.randomUUID();
  const campaign = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = new URLSearchParams(location.search).get(key);
    if (value) campaign[key] = value.slice(0, 100);
  }
  function clock() {
    const now = performance.now();
    if (!document.hidden) elapsed += now - since;
    since = now;
  }
  function emit(event, data = {}) {
    if (!enabled || !endpoint) return;
    navigator.sendBeacon(endpoint, new Blob([JSON.stringify({
      event, session, step, campaign, at: new Date().toISOString(), ...data,
    })], { type: 'application/json' }));
  }
  function view(id) {
    if (id === step) return;
    clock();
    emit('step_left', { activeMilliseconds: Math.round(elapsed), nextStep: id });
    elapsed = 0;
    step = id;
    emit('step_viewed');
  }
  window.demoAnalytics = {
    view,
    // Receiver must implement validation, rate limiting and storage.
    configure(url, consent) {
      endpoint = new URL(url, location.origin).href;
      enabled = consent === true;
      elapsed = 0;
      since = performance.now();
      emit('step_viewed');
    },
    revoke() { enabled = false; },
    choice(questionIndex, optionIndex) {
      // Never transmit answer values: these may contain medical information.
      emit('option_clicked', { questionIndex });
    },
  };
  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.hidden) elapsed += now - since;
    since = now;
  });
  addEventListener('pagehide', () => {
    clock();
    emit('session_interrupted', { activeMilliseconds: Math.round(elapsed) });
  });
})();
