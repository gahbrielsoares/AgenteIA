(function () {
  const STORAGE_KEY = "pillaris_funnel_state";

  const STAGES = [
    "site_visit",
    "ad_click",
    "chat_start",
    "quote_generated",
    "quote_approved",
  ];

  function emptyState() {
    const counts = {};
    STAGES.forEach((s) => (counts[s] = 0));
    return { counts, lead: null };
  }

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      return { counts: { ...emptyState().counts, ...parsed.counts }, lead: parsed.lead || null };
    } catch (e) {
      return emptyState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // dispara um evento customizado pra permitir reagir na MESMA aba também
    // (o evento nativo 'storage' só dispara em outras abas)
    window.dispatchEvent(new CustomEvent("pillaris-funnel-update", { detail: state }));
  }

  function recordEvent(event, lead) {
    if (!STAGES.includes(event)) return;
    const state = getState();
    state.counts[event] = (state.counts[event] || 0) + 1;
    state.lead = { ...(state.lead || {}), ...(lead || {}), stage: event };
    saveState(state);
  }

  function reset() {
    saveState(emptyState());
  }

  function onChange(callback) {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) callback(getState());
    });
    window.addEventListener("pillaris-funnel-update", (e) => callback(e.detail));
  }

  window.FunnelStore = { STAGES, getState, recordEvent, reset, onChange };
})();
