(function () {
  const kpiRow = document.getElementById("kpiRow");
  const board = document.getElementById("board");
  const adsPanel = document.getElementById("adsPanel");
  const dropoffPanel = document.getElementById("dropoffPanel");
  const queuePanel = document.getElementById("queuePanel");
  const resetBtn = document.getElementById("resetBtn");
  const lastUpdate = document.getElementById("lastUpdate");

  const aiQuestion = document.getElementById("aiQuestion");
  const aiAskBtn = document.getElementById("aiAskBtn");
  const aiAnswer = document.getElementById("aiAnswer");

  const modalOverlay = document.getElementById("leadModalOverlay");
  const modalBody = document.getElementById("leadModalBody");
  const modalClose = document.getElementById("leadModalClose");

  const STAGE_LABELS = {
    site_visit: "Visitou o site",
    ad_click: "Clicou no anúncio",
    chat_start: "Iniciou conversa",
    quote_generated: "Orçamento gerado",
    quote_approved: "Orçamento aprovado",
  };
  const STAGE_ORDER = FunnelStore.STAGES;

  let apiKey = "";
  let model = "";

  function formatBRL(n) {
    if (n == null) return "-";
    return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatWait(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min <= 0) return `${sec}s`;
    return `${min}min ${sec}s`;
  }

  // --- KPIs ---
  function renderKpis(state) {
    const visits = state.counts.site_visit || 0;
    const approved = state.counts.quote_approved || 0;
    const conv = visits > 0 ? ((approved / visits) * 100).toFixed(1) : "0.0";

    let respTimes = [];
    if (state.lead && state.lead.chat_start_at && state.lead.quote_generated_at) {
      respTimes.push(state.lead.quote_generated_at - state.lead.chat_start_at);
    }
    const avgRespMs = respTimes.length ? respTimes.reduce((a, b) => a + b, 0) / respTimes.length : 38000;

    const bestAd = getBestAd(state);

    kpiRow.innerHTML = "";
    const kpis = [
      { label: "Visitas ao site", value: visits, sub: "desde o início da demo" },
      { label: "Taxa de conversão", value: `${conv}%`, sub: `${approved} de ${visits} viraram venda` },
      { label: "Tempo médio p/ orçamento", value: formatWait(avgRespMs), sub: "da 1ª mensagem ao orçamento" },
      { label: "Anúncio com melhor conversão", value: bestAd.nome, sub: `${bestAd.pct.toFixed(1)}% de conversão` },
    ];
    kpis.forEach((k) => {
      const el = document.createElement("div");
      el.className = "pnl-kpi";
      el.innerHTML = `<div class="pnl-kpi-label">${k.label}</div><div class="pnl-kpi-value">${k.value}</div><div class="pnl-kpi-sub">${k.sub}</div>`;
      kpiRow.appendChild(el);
    });
  }

  // --- Kanban ---
  function buildBoardSkeleton() {
    board.innerHTML = "";
    STAGE_ORDER.forEach((stage) => {
      const col = document.createElement("div");
      col.className = "pnl-column";
      col.innerHTML = `
        <div class="pnl-col-head">
          <div class="pnl-col-label">${STAGE_LABELS[stage]}</div>
          <div class="pnl-col-count" id="count-${stage}">0</div>
        </div>
        <div class="pnl-col-body" id="body-${stage}"></div>
      `;
      board.appendChild(col);
    });
  }

  function renderBoard(state) {
    STAGE_ORDER.forEach((stage) => {
      const countEl = document.getElementById(`count-${stage}`);
      const bodyEl = document.getElementById(`body-${stage}`);
      if (countEl) countEl.textContent = state.counts[stage] || 0;
      if (bodyEl) bodyEl.innerHTML = "";
    });
    if (state.lead && state.lead.stage) {
      const bodyEl = document.getElementById(`body-${state.lead.stage}`);
      if (bodyEl) {
        const card = document.createElement("div");
        card.className = "pnl-card";
        const nome = state.lead.nome || "Cliente";
        const produto = state.lead.produto || "em atendimento";
        card.innerHTML = `<div class="pnl-card-name">${nome}</div><div class="pnl-card-meta">${produto}</div>`;
        bodyEl.appendChild(card);
      }
    }
  }

  // --- Conversão por anúncio ---
  function adConversionPct(adCounts) {
    const clicks = adCounts.ad_click || 0;
    const approved = adCounts.quote_approved || 0;
    return clicks > 0 ? (approved / clicks) * 100 : 0;
  }

  function getBestAd(state) {
    const ads = FunnelStore.ADS.map((nome) => ({ nome, pct: adConversionPct(state.ads[nome] || {}) }));
    ads.sort((a, b) => b.pct - a.pct);
    return ads[0] || { nome: "-", pct: 0 };
  }

  function renderAds(state) {
    const ads = FunnelStore.ADS.map((nome) => ({ nome, pct: adConversionPct(state.ads[nome] || {}), counts: state.ads[nome] }));
    const maxPct = Math.max(...ads.map((a) => a.pct), 1);

    adsPanel.innerHTML = "";
    ads.forEach((ad) => {
      const row = document.createElement("div");
      row.className = "pnl-ad-row";
      const widthPct = (ad.pct / maxPct) * 100;
      row.innerHTML = `
        <div class="pnl-ad-name">${ad.nome}</div>
        <div class="pnl-ad-bar-track"><div class="pnl-ad-bar-fill" style="width:${widthPct}%"></div></div>
        <div class="pnl-ad-pct">${ad.pct.toFixed(1)}%</div>
      `;
      adsPanel.appendChild(row);
    });

    const best = ads.slice().sort((a, b) => b.pct - a.pct)[0];
    if (best && best.pct > 0) {
      const tag = document.createElement("div");
      tag.className = "pnl-ad-winner-tag";
      tag.textContent = `${best.nome} converte melhor`;
      adsPanel.appendChild(tag);
    }
  }

  // --- Drop-off (onde os clientes mais abandonam) ---
  function renderDropoff(state) {
    const c = state.counts;
    const transitions = [
      { label: "Site → clicou no anúncio", from: c.site_visit, to: c.ad_click },
      { label: "Anúncio → iniciou conversa", from: c.ad_click, to: c.chat_start },
      { label: "Conversa → recebeu orçamento", from: c.chat_start, to: c.quote_generated },
      { label: "Orçamento → aprovou", from: c.quote_generated, to: c.quote_approved },
    ];

    dropoffPanel.innerHTML = "";
    let worst = null;

    transitions.forEach((t) => {
      const dropPct = t.from > 0 ? ((t.from - t.to) / t.from) * 100 : 0;
      if (!worst || dropPct > worst.dropPct) worst = { ...t, dropPct };

      const row = document.createElement("div");
      row.className = "pnl-drop-row";
      row.innerHTML = `
        <span class="pnl-drop-label">${t.label}</span>
        <span class="pnl-drop-value ${dropPct > 35 ? "high" : ""}">${dropPct.toFixed(0)}% saem aqui</span>
      `;
      dropoffPanel.appendChild(row);
    });

    if (worst && worst.dropPct > 0) {
      const tag = document.createElement("div");
      tag.className = "pnl-drop-worst";
      tag.textContent = `Maior abandono: "${worst.label}" (${worst.dropPct.toFixed(0)}% desistem aqui)`;
      dropoffPanel.appendChild(tag);
    }
  }

  // --- Fila de leads qualificados ---
  function renderQueue(state) {
    queuePanel.innerHTML = "";
    const queue = (state.queue || []).slice().sort((a, b) => a.qualified_at - b.qualified_at);

    if (queue.length === 0) {
      queuePanel.innerHTML = `<div class="pnl-queue-empty">Nenhum lead qualificado esperando atendimento agora.</div>`;
      return;
    }

    const now = Date.now();
    queue.forEach((lead) => {
      const waitMs = now - lead.qualified_at;
      const row = document.createElement("div");
      row.className = "pnl-queue-row" + (waitMs > 10 * 60 * 1000 ? " urgent" : "");
      row.innerHTML = `
        <div style="flex:1; min-width:0;">
          <div class="pnl-queue-name">${lead.nome}${lead.live ? " · <span style='color:#b4432e'>ao vivo</span>" : ""}</div>
          <div class="pnl-queue-meta">${lead.produto}${lead.valor_total ? " · " + formatBRL(lead.valor_total) : ""} · ${lead.ad || ""}</div>
        </div>
        <div class="pnl-queue-wait">${formatWait(waitMs)}</div>
      `;
      row.addEventListener("click", () => openLeadModal(lead));
      queuePanel.appendChild(row);
    });
  }

  function openLeadModal(lead) {
    modalBody.innerHTML = `
      <div class="pnl-modal-name">${lead.nome}</div>
      <div class="pnl-modal-meta">${lead.produto}${lead.valor_total ? " · " + formatBRL(lead.valor_total) : ""} · origem: ${lead.ad || "-"}</div>
    `;
    (lead.transcript || []).forEach((m) => {
      const div = document.createElement("div");
      div.className = "pnl-modal-msg";
      div.innerHTML = `<div class="pnl-modal-msg-role">${m.role === "user" ? "Cliente" : "Ana (IA)"}</div>${m.text}`;
      modalBody.appendChild(div);
    });
    if (!lead.transcript || lead.transcript.length === 0) {
      modalBody.innerHTML += `<div class="pnl-queue-empty">Sem histórico de conversa disponível.</div>`;
    }
    modalOverlay.style.display = "flex";
  }

  modalClose.addEventListener("click", () => (modalOverlay.style.display = "none"));
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = "none";
  });

  // --- render geral ---
  function render(state) {
    renderKpis(state);
    renderBoard(state);
    renderAds(state);
    renderDropoff(state);
    renderQueue(state);
    lastUpdate.textContent = new Date().toLocaleTimeString("pt-BR");
  }

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reiniciar toda a demonstração (zera funil, anúncios e fila)?")) return;
    FunnelStore.reset();
    render(FunnelStore.getState());
  });

  // --- IA de gestão ---
  async function askManagementAI() {
    const question = aiQuestion.value.trim();
    if (!question) return;

    aiAskBtn.disabled = true;
    aiAnswer.style.display = "block";
    aiAnswer.textContent = "Pensando...";

    try {
      const state = FunnelStore.getState();
      const dataSummary = {
        contadores_gerais: state.counts,
        contadores_por_anuncio: state.ads,
        leads_qualificados_esperando: (state.queue || []).map((q) => ({
          nome: q.nome,
          produto: q.produto,
          valor_total: q.valor_total,
          anuncio: q.ad,
          esperando_ha_segundos: Math.floor((Date.now() - q.qualified_at) / 1000),
        })),
      };

      const systemPrompt =
        "Você é uma IA de análise de dados comerciais para o dono/gestor de uma loja. " +
        "Responda em português, de forma breve e direta (2-4 frases), baseando-se SOMENTE nos dados JSON " +
        "fornecidos abaixo. Cite números reais quando fizer sentido. Se a pergunta não puder ser respondida " +
        "com esses dados, diga isso claramente.\n\nDados atuais do funil:\n" + JSON.stringify(dataSummary, null, 2);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question },
          ],
          temperature: 0.3,
          max_tokens: 300,
          reasoning: { exclude: true },
        }),
      });

      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const data = await response.json();
      aiAnswer.textContent = data.choices?.[0]?.message?.content || "Não consegui gerar uma resposta.";
    } catch (e) {
      aiAnswer.textContent = "⚠️ Não consegui consultar a IA agora. " + e.message;
    } finally {
      aiAskBtn.disabled = false;
    }
  }

  aiAskBtn.addEventListener("click", askManagementAI);
  aiQuestion.addEventListener("keydown", (e) => {
    if (e.key === "Enter") askManagementAI();
  });

  // --- init ---
  FunnelStore.seedIfEmpty();
  buildBoardSkeleton();
  render(FunnelStore.getState());
  FunnelStore.onChange(render);
  setInterval(() => render(FunnelStore.getState()), 1500);

  PillarisKey.ensure((k, m) => {
    apiKey = k;
    model = m;
  });
})();
