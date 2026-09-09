(function () {
  const board = document.getElementById("board");
  const resetBtn = document.getElementById("resetBtn");
  const lastUpdate = document.getElementById("lastUpdate");

  const STAGE_LABELS = {
    site_visit: "Visitou o site",
    ad_click: "Clicou no anúncio",
    chat_start: "Iniciou conversa",
    quote_generated: "Orçamento gerado",
    quote_approved: "Orçamento aprovado",
  };

  const STAGE_ORDER = FunnelStore.STAGES;

  function buildColumns() {
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

  function renderLeadCard(lead) {
    const card = document.createElement("div");
    card.className = "pnl-card";
    const nome = lead.nome || "Cliente";
    const produto = lead.produto ? lead.produto : "em atendimento";
    const valor = lead.valor_total
      ? Number(lead.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : null;

    card.innerHTML = `
      <div class="pnl-card-name">${nome}</div>
      <div class="pnl-card-meta">${produto}${valor ? " · " + valor : ""}</div>
    `;
    return card;
  }

  function render(state) {
    STAGE_ORDER.forEach((stage) => {
      const countEl = document.getElementById(`count-${stage}`);
      const bodyEl = document.getElementById(`body-${stage}`);
      if (countEl) countEl.textContent = state.counts[stage] || 0;
      if (bodyEl) bodyEl.innerHTML = "";
    });

    if (state.lead && state.lead.stage) {
      const bodyEl = document.getElementById(`body-${state.lead.stage}`);
      if (bodyEl) bodyEl.appendChild(renderLeadCard(state.lead));
    }

    lastUpdate.textContent = new Date().toLocaleTimeString("pt-BR");
  }

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reiniciar toda a demonstração (zera o funil)?")) return;
    FunnelStore.reset();
    render(FunnelStore.getState());
  });

  buildColumns();
  render(FunnelStore.getState());

  // atualiza quando o WhatsApp (outra aba) grava um evento
  FunnelStore.onChange(render);

  // poll de segurança - garante atualização mesmo se o evento 'storage' atrasar
  setInterval(() => render(FunnelStore.getState()), 1500);
})();
