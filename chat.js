(function () {
  const chatWindow = document.getElementById("chatWindow");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const menuBtn = document.querySelector(".wa-menu");

  let history = [];
  let chatStarted = false;
  let catalogo = null;
  let systemPrompt = "";
  let apiKey = "";
  let model = "";

  function nowLabel() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function addBubble(text, who) {
    const row = document.createElement("div");
    row.className = `wa-bubble-row ${who}`;
    const bubble = document.createElement("div");
    bubble.className = `wa-bubble ${who}`;
    bubble.textContent = text;
    const time = document.createElement("span");
    time.className = "wa-time";
    time.textContent = nowLabel();
    bubble.appendChild(time);
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    scrollToBottom();
  }

  function showTyping() {
    const row = document.createElement("div");
    row.className = "wa-bubble-row in";
    row.id = "typingRow";
    const bubble = document.createElement("div");
    bubble.className = "wa-bubble in wa-typing";
    bubble.innerHTML = "<span></span><span></span><span></span>";
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    const row = document.getElementById("typingRow");
    if (row) row.remove();
  }

  function formatBRL(n) {
    return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function addQuoteCard(quote) {
    const row = document.createElement("div");
    row.className = "wa-bubble-row in";

    const card = document.createElement("div");
    card.className = "wa-quote-card";

    const title = document.createElement("div");
    title.className = "wa-quote-title";
    title.textContent = "📋 Orçamento";
    card.appendChild(title);

    const rows = [
      ["Cliente", quote.cliente_nome],
      ["Produto", quote.produto],
      ["Formato", quote.formato],
      ["Ambiente", quote.ambiente],
      ["Metragem", `${quote.metragem_m2} m²`],
      ["Valor por m²", formatBRL(quote.preco_m2)],
      ["Prazo de entrega", quote.prazo_entrega],
    ];

    rows.forEach(([label, value]) => {
      const r = document.createElement("div");
      r.className = "wa-quote-row";
      r.innerHTML = `<span>${label}</span><span>${value ?? "-"}</span>`;
      card.appendChild(r);
    });

    const total = document.createElement("div");
    total.className = "wa-quote-total";
    total.innerHTML = `<span>Total</span><span>${formatBRL(quote.valor_total)}</span>`;
    card.appendChild(total);

    const actions = document.createElement("div");
    actions.className = "wa-quote-actions";

    const approveBtn = document.createElement("button");
    approveBtn.className = "wa-quote-btn approve";
    approveBtn.textContent = "✅ Aprovar orçamento";

    const rejectBtn = document.createElement("button");
    rejectBtn.className = "wa-quote-btn reject";
    rejectBtn.textContent = "Ajustar";

    approveBtn.onclick = () => {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      handleApprove(quote);
    };
    rejectBtn.onclick = () => {
      approveBtn.disabled = true;
      rejectBtn.disabled = true;
      handleReject();
    };

    actions.appendChild(approveBtn);
    actions.appendChild(rejectBtn);
    card.appendChild(actions);

    row.appendChild(card);
    chatWindow.appendChild(row);
    scrollToBottom();
  }

  function parseQuoteBlock(text) {
    const match = text.match(/<<QUOTE>>([\s\S]*?)<<END>>/);
    if (!match) return { visibleText: text.trim(), quote: null };
    const visibleText = text.replace(match[0], "").trim();
    let quote = null;
    try {
      quote = JSON.parse(match[1].trim());
    } catch (e) {
      quote = null;
    }
    return { visibleText, quote };
  }

  function buildSystemPrompt() {
    return `
Você é a atendente virtual do WhatsApp de uma loja revendedora autorizada de porcelanatos Savane.
Seu nome é "Ana", tom simpático, direto, humano (use emojis com moderação, frases curtas de WhatsApp).

Seu objetivo em uma conversa:
1. Entender o que o cliente precisa: ambiente (sala, área externa, fachada, banheiro etc.), estilo/tipologia desejada, e se possível a metragem (m²).
2. Fazer no máximo 2-3 perguntas por vez, nunca um formulário longo. Conduza como um vendedor de loja faria.
3. Use SOMENTE os produtos do catálogo abaixo para recomendar e montar orçamento. Nunca invente produto ou preço fora dele.
4. Assim que tiver: ambiente + linha/produto escolhido + metragem aproximada, gere um orçamento.

Catálogo da loja (linhas Savane disponíveis):
${JSON.stringify(catalogo.linhas, null, 2)}

Condições de pagamento padrão: ${JSON.stringify(catalogo.condicoes_pagamento_padrao)}
Prazo de entrega padrão: ${catalogo.prazo_entrega_padrao}

QUANDO você tiver informação suficiente para montar o orçamento, responda com uma mensagem curta de transição
(ex: "Perfeito! Montei seu orçamento aqui 👇") e, IMEDIATAMENTE APÓS, inclua um bloco especial no seguinte formato
EXATO (sem markdown, sem texto antes ou depois dentro do bloco):

<<QUOTE>>
{
  "cliente_nome": "nome do cliente ou 'Cliente'",
  "produto": "nome da linha + tipologia",
  "formato": "medida escolhida",
  "ambiente": "ambiente informado",
  "metragem_m2": numero,
  "preco_m2": numero,
  "valor_total": numero,
  "prazo_entrega": "texto",
  "condicoes_pagamento": ["..."]
}
<<END>>

Nunca gere o bloco <<QUOTE>> antes de ter ambiente, produto/linha e metragem. Se faltar metragem, pergunte
"quantos m² você precisa, ou me passa as medidas do espaço que eu calculo pra você?".

Se você receber uma instrução de sistema avisando que o cliente aprovou o orçamento, assuma o papel de
"vendedor fechando a venda": confirme a forma de pagamento escolhida, informe prazo de entrega, e finalize
com uma mensagem de confirmação calorosa. Não gere novo bloco <<QUOTE>> nesse momento.

Mantenha sempre o tom de WhatsApp: mensagens curtas, sem formatação markdown (sem **negrito**, sem #, sem listas com traço),
pode usar emojis pontuais e quebras de linha.
`.trim();
  }

  async function callOpenRouter(messages) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenRouter ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async function callAssistant(systemNote) {
    showTyping();
    try {
      const messages = [{ role: "system", content: systemPrompt }];
      if (systemNote) messages.push({ role: "system", content: systemNote });
      messages.push(...history);

      const raw = await callOpenRouter(messages);
      hideTyping();

      const { visibleText, quote } = parseQuoteBlock(raw);

      if (visibleText) {
        addBubble(visibleText, "in");
        history.push({ role: "assistant", content: visibleText });
      }

      if (quote) {
        setTimeout(() => {
          addQuoteCard(quote);
          FunnelStore.recordEvent("quote_generated", {
            nome: quote.cliente_nome,
            produto: quote.produto,
            valor_total: quote.valor_total,
          });
        }, 500);
      }
    } catch (e) {
      hideTyping();
      if (String(e).includes("401") || String(e).includes("403")) {
        addBubble("⚠️ Chave da IA inválida ou sem crédito. Clique no menu (⋮) pra reconfigurar.", "in");
      } else {
        addBubble("⚠️ Não consegui falar com a IA agora. " + e.message, "in");
      }
    }
  }

  function handleApprove(quote) {
    addBubble("✅ Aprovado! Pode seguir.", "out");
    history.push({ role: "user", content: "Aprovo o orçamento. Pode seguir." });
    FunnelStore.recordEvent("quote_approved", {
      nome: quote.cliente_nome,
      produto: quote.produto,
      valor_total: quote.valor_total,
    });
    callAssistant(
      "O cliente ACABOU DE APROVAR o orçamento. Assuma agora o papel de vendedor fechando a venda: " +
      "pergunte/confirme a forma de pagamento entre as opções disponíveis, confirme o prazo de entrega, " +
      "e finalize com uma mensagem calorosa de confirmação do pedido. Não gere um novo bloco <<QUOTE>>."
    );
  }

  function handleReject() {
    const text = "Poxa, prefiro ajustar algo no orçamento antes de fechar.";
    addBubble(text, "out");
    history.push({ role: "user", content: text });
    callAssistant();
  }

  function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    if (!chatStarted) {
      chatStarted = true;
      FunnelStore.recordEvent("chat_start", {});
    }

    addBubble(text, "out");
    history.push({ role: "user", content: text });
    msgInput.value = "";
    callAssistant();
  }

  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  if (menuBtn) {
    menuBtn.style.cursor = "pointer";
    menuBtn.title = "Reconfigurar chave da IA";
    menuBtn.addEventListener("click", () => {
      PillarisKey.reconfigure((k, m) => {
        apiKey = k;
        model = m;
      });
    });
  }

  async function init() {
    try {
      const res = await fetch("data/savane-produtos.json");
      catalogo = await res.json();
    } catch (e) {
      addBubble("⚠️ Não consegui carregar o catálogo de produtos (data/savane-produtos.json).", "in");
      return;
    }
    systemPrompt = buildSystemPrompt();

    FunnelStore.recordEvent("ad_click", {});

    const opening = "Olá! 👋 Vi que você chegou pelo nosso anúncio.\nSou a Ana, da loja revendedora Savane. Me conta, você está buscando revestimento pra qual ambiente da sua obra ou reforma?";
    setTimeout(() => {
      addBubble(opening, "in");
      history.push({ role: "assistant", content: opening });
    }, 600);
  }

  PillarisKey.ensure((k, m) => {
    apiKey = k;
    model = m;
    init();
  });
})();
