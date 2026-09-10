(function () {
  const STORAGE_KEY = "pillaris_funnel_state_v2";
  const SEEDED_FLAG = "pillaris_seeded_v2";

  const STAGES = ["site_visit", "ad_click", "chat_start", "quote_generated", "quote_approved"];
  const AD_STAGES = ["ad_click", "chat_start", "quote_generated", "quote_approved"];
  const ADS = ["Anúncio 1", "Anúncio 2"];

  function emptyAdCounts() {
    const c = {};
    AD_STAGES.forEach((s) => (c[s] = 0));
    return c;
  }

  function emptyState() {
    const counts = {};
    STAGES.forEach((s) => (counts[s] = 0));
    const ads = {};
    ADS.forEach((a) => (ads[a] = emptyAdCounts()));
    return { counts, ads, lead: null, queue: [] };
  }

  function getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      const base = emptyState();
      return {
        counts: { ...base.counts, ...parsed.counts },
        ads: {
          "Anúncio 1": { ...base.ads["Anúncio 1"], ...(parsed.ads && parsed.ads["Anúncio 1"]) },
          "Anúncio 2": { ...base.ads["Anúncio 2"], ...(parsed.ads && parsed.ads["Anúncio 2"]) },
        },
        lead: parsed.lead || null,
        queue: Array.isArray(parsed.queue) ? parsed.queue : [],
      };
    } catch (e) {
      return emptyState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("pillaris-funnel-update", { detail: state }));
  }

  // Registra um evento do funil.
  // lead: dados parciais do lead atual (nome, produto, valor_total...)
  // adId: "Anúncio 1" | "Anúncio 2" (obrigatório a partir do ad_click)
  // transcript: histórico de mensagens [{role, text, at}] no momento do evento
  function recordEvent(event, lead, adId, transcript) {
    if (!STAGES.includes(event)) return;
    const state = getState();
    const now = Date.now();

    state.counts[event] = (state.counts[event] || 0) + 1;

    if (adId && AD_STAGES.includes(event)) {
      if (!state.ads[adId]) state.ads[adId] = emptyAdCounts();
      state.ads[adId][event] = (state.ads[adId][event] || 0) + 1;
    }

    const prevLead = state.lead || {};
    const mergedLead = {
      ...prevLead,
      ...(lead || {}),
      stage: event,
      ad: adId || prevLead.ad,
    };
    if (transcript) mergedLead.transcript = transcript;

    if (event === "chat_start") mergedLead.chat_start_at = now;
    if (event === "quote_generated") mergedLead.quote_generated_at = now;
    if (event === "quote_approved") mergedLead.quote_approved_at = now;

    state.lead = mergedLead;

    // Fila de "Leads Qualificados": entra quando o orçamento é gerado,
    // sai quando aprovado (vendedor "atendeu"/fechou).
    if (event === "quote_generated") {
      state.queue = state.queue.filter((q) => q.id !== "live");
      state.queue.push({
        id: "live",
        nome: mergedLead.nome || "Cliente",
        produto: mergedLead.produto || "-",
        valor_total: mergedLead.valor_total || null,
        ad: mergedLead.ad || "-",
        qualified_at: now,
        transcript: mergedLead.transcript || [],
        live: true,
      });
    }
    if (event === "quote_approved") {
      state.queue = state.queue.filter((q) => q.id !== "live");
    }

    saveState(state);
  }

  // Atualiza só o transcript do lead ao vivo (chamado a cada mensagem nova,
  // sem contar como um novo "evento" de funil).
  function updateLiveTranscript(transcript) {
    const state = getState();
    if (state.lead) state.lead.transcript = transcript;
    const idx = state.queue.findIndex((q) => q.id === "live");
    if (idx >= 0) state.queue[idx].transcript = transcript;
    saveState(state);
  }

  function reset() {
    localStorage.removeItem(SEEDED_FLAG);
    saveState(emptyState());
  }

  function onChange(callback) {
    window.addEventListener("storage", (e) => {
      if (e.key === STORAGE_KEY) callback(getState());
    });
    window.addEventListener("pillaris-funnel-update", (e) => callback(e.detail));
  }

  // --- dados fictícios pra o painel não parecer vazio na primeira vez ---
  function seedIfEmpty() {
    if (localStorage.getItem(SEEDED_FLAG)) return;
    localStorage.setItem(SEEDED_FLAG, "1");

    const state = emptyState();
    state.counts = {
      site_visit: 96,
      ad_click: 71,
      chat_start: 52,
      quote_generated: 27,
      quote_approved: 15,
    };
    state.ads = {
      "Anúncio 1": { ad_click: 44, chat_start: 34, quote_generated: 19, quote_approved: 12 },
      "Anúncio 2": { ad_click: 27, chat_start: 18, quote_generated: 8, quote_approved: 3 },
    };

    const now = Date.now();
    state.queue = [
      {
        id: "seed1",
        nome: "Roberto Alves",
        produto: "Savane Teca (efeito madeira)",
        valor_total: 1740,
        ad: "Anúncio 1",
        qualified_at: now - 23 * 60 * 1000,
        transcript: [
          { role: "assistant", text: "Olá! Vi que você chegou pelo nosso anúncio. Qual seu nome e pra qual ambiente você busca revestimento?", at: now - 30 * 60 * 1000 },
          { role: "user", text: "Sou o Roberto, quero pro meu quarto", at: now - 29 * 60 * 1000 },
          { role: "assistant", text: "Show, Roberto! Quantos m² tem o quarto?", at: now - 28 * 60 * 1000 },
          { role: "user", text: "uns 21m2", at: now - 27 * 60 * 1000 },
          { role: "assistant", text: "Perfeito! Montei seu orçamento com o Savane Teca 👇", at: now - 23 * 60 * 1000 },
        ],
      },
      {
        id: "seed2",
        nome: "Marcia Fontes",
        produto: "Savane Nude (cimentício)",
        valor_total: 2830,
        ad: "Anúncio 2",
        qualified_at: now - 11 * 60 * 1000,
        transcript: [
          { role: "assistant", text: "Olá! Qual seu nome e pra qual ambiente você busca revestimento?", at: now - 15 * 60 * 1000 },
          { role: "user", text: "Marcia, é pra sala e cozinha integrada", at: now - 14 * 60 * 1000 },
          { role: "assistant", text: "Entendi! Quantos m² ao todo?", at: now - 13 * 60 * 1000 },
          { role: "user", text: "45m2", at: now - 12 * 60 * 1000 },
          { role: "assistant", text: "Montei seu orçamento com o Savane Nude 👇", at: now - 11 * 60 * 1000 },
        ],
      },
      {
        id: "seed3",
        nome: "Felipe Nogueira",
        produto: "Savane Canyon (efeito pedra)",
        valor_total: 1198,
        ad: "Anúncio 1",
        qualified_at: now - 4 * 60 * 1000,
        transcript: [
          { role: "assistant", text: "Olá! Qual seu nome e pra qual ambiente você busca revestimento?", at: now - 7 * 60 * 1000 },
          { role: "user", text: "Felipe, quero pra fachada de casa", at: now - 6 * 60 * 1000 },
          { role: "assistant", text: "Ótimo! Quantos m² de parede aproximadamente?", at: now - 5 * 60 * 1000 },
          { role: "user", text: "16m2", at: now - 4.5 * 60 * 1000 },
          { role: "assistant", text: "Montei seu orçamento com o Savane Canyon 👇", at: now - 4 * 60 * 1000 },
        ],
      },
    ];

    saveState(state);
  }

  window.FunnelStore = {
    STAGES,
    AD_STAGES,
    ADS,
    getState,
    recordEvent,
    updateLiveTranscript,
    reset,
    onChange,
    seedIfEmpty,
  };
})();
