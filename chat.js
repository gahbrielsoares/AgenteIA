(function () {
  const chatWindow = document.getElementById("chatWindow");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const attachBtn = document.getElementById("attachBtn");
  const photoInput = document.getElementById("photoInput");
  const menuBtn = document.querySelector(".wa-menu");
  const statusLine = document.getElementById("statusLine");

  const urlParams = new URLSearchParams(window.location.search);
  const adId = urlParams.get("ad") === "2" ? "Anúncio 2" : "Anúncio 1";

  let history = []; // formato OpenAI, só role+content, pra mandar pra IA
  let transcript = []; // formato pra guardar/exibir no painel: {role, text, at}
  let chatStarted = false;
  let catalogo = null;
  let systemPrompt = "";
  let apiKey = "";
  let model = "";

  // --- estado de imagem/produto ---
  let currentProduct = null;
  let knownAmbiente = null;
  let pendingPhotoDataUri = null;
  let awaitingProductChoice = false;
  let awaitingAmbienteFor = null; // linha aguardando resposta de "qual ambiente"

  function nowLabel() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function scrollToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function pushTranscript(role, text) {
    transcript.push({ role, text, at: Date.now() });
    FunnelStore.updateLiveTranscript(transcript);
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
    pushTranscript(who === "out" ? "user" : "assistant", text);
  }

  function addImageBubble(src, who, caption) {
    const row = document.createElement("div");
    row.className = `wa-bubble-row ${who}`;
    const wrap = document.createElement("div");
    wrap.className = `wa-image-bubble ${who}`;
    const img = document.createElement("img");
    img.src = src;
    wrap.appendChild(img);
    if (caption) {
      const cap = document.createElement("div");
      cap.className = "wa-image-caption";
      cap.textContent = caption;
      wrap.appendChild(cap);
    }
    row.appendChild(wrap);
    chatWindow.appendChild(row);
    scrollToBottom();
    pushTranscript(who === "out" ? "user" : "assistant", caption ? `[imagem] ${caption}` : "[imagem]");
    return row;
  }

  function addImageLoading(text) {
    const row = document.createElement("div");
    row.className = "wa-bubble-row in";
    row.innerHTML = `<div class="wa-image-loading"><div class="wa-spinner"></div><span>${text}</span></div>`;
    chatWindow.appendChild(row);
    scrollToBottom();
    return row;
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
    pushTranscript("assistant", `[orçamento] ${quote.produto} - ${formatBRL(quote.valor_total)}`);
  }

  function addCatalogGallery() {
    const row = document.createElement("div");
    row.className = "wa-bubble-row in";

    const card = document.createElement("div");
    card.className = "wa-catalog-card";
    card.innerHTML = `<div class="wa-catalog-title">🧱 Nosso catálogo</div><div class="wa-catalog-hint">Clique no piso que mais gostou</div>`;

    const grid = document.createElement("div");
    grid.className = "wa-catalog-grid";

    catalogo.linhas.forEach((linha) => {
      const item = document.createElement("div");
      item.className = "wa-catalog-item";
      const preco = linha.formatos[0]?.preco_m2;
      item.innerHTML = `
        <img src="${linha.imagem}" alt="${linha.nome}" />
        <div class="wa-catalog-item-name">${linha.nome}</div>
        <div class="wa-catalog-item-price">${preco ? formatBRL(preco) + "/m²" : ""}</div>
      `;
      item.addEventListener("click", () => handleCatalogClick(linha));
      grid.appendChild(item);
    });

    card.appendChild(grid);
    row.appendChild(card);
    chatWindow.appendChild(row);
    scrollToBottom();
    pushTranscript("assistant", "[catálogo exibido]");
  }

  function stripStrayTags(text) {
    return text.replace(/<{1,2}\/?[A-Z0-9_]{2,}(:[^>]*)?>{1,2}/g, "").trim();
  }

  function findLinhaByNome(nomeAproximado) {
    if (!nomeAproximado || !catalogo) return null;
    const alvo = nomeAproximado.toLowerCase();
    return (
      catalogo.linhas.find((l) => alvo.includes(l.nome.toLowerCase())) ||
      catalogo.linhas.find((l) => l.nome.toLowerCase().includes(alvo)) ||
      null
    );
  }

  function parseAssistantText(rawText) {
    let text = rawText;
    let quote = null;
    let showImgLinha = null;
    let showCatalog = false;

    const quoteMatch = text.match(/<<QUOTE>>([\s\S]*?)<<END>>/);
    if (quoteMatch) {
      text = text.replace(quoteMatch[0], "");
      try {
        quote = JSON.parse(quoteMatch[1].trim());
        if (!quote.cliente_nome || String(quote.cliente_nome).trim() === "" || String(quote.cliente_nome).trim() === "-") {
          quote.cliente_nome = "Cliente";
        }
      } catch (e) {
        quote = null;
      }
    }

    const showImgMatch = text.match(/<<SHOWIMG:([^>]+)>>/);
    if (showImgMatch) {
      text = text.replace(showImgMatch[0], "");
      showImgLinha = showImgMatch[1].trim();
    }

    if (/<<CATALOG>>/.test(text)) {
      text = text.replace(/<<CATALOG>>/g, "");
      showCatalog = true;
    }

    return { visibleText: stripStrayTags(text), quote, showImgLinha, showCatalog };
  }

  function buildSystemPrompt() {
    const nomesLinhas = catalogo.linhas.map((l) => l.nome).join(", ");
    return `
Você é a atendente virtual do WhatsApp de uma loja revendedora autorizada de porcelanatos Savane.
Seu nome é "Ana", tom simpático, direto, humano (use emojis com moderação, frases curtas de WhatsApp).

Seu objetivo em uma conversa:
1. Entender o que o cliente precisa: ambiente (sala, área externa, fachada, banheiro etc.), estilo/tipologia desejada, e se possível a metragem (m²).
2. Fazer no máximo 2-3 perguntas por vez, nunca um formulário longo. Conduza como um vendedor de loja faria.
3. Use SOMENTE os produtos do catálogo abaixo para recomendar e montar orçamento. Nunca invente produto ou preço fora dele.
4. Assim que tiver: ambiente + linha/produto escolhido + metragem aproximada, gere um orçamento.

Catálogo da loja (linhas Savane disponíveis): ${nomesLinhas}
Detalhes de cada linha:
${JSON.stringify(catalogo.linhas, null, 2)}

Condições de pagamento padrão: ${JSON.stringify(catalogo.condicoes_pagamento_padrao)}
Prazo de entrega padrão: ${catalogo.prazo_entrega_padrao}

MOSTRANDO O CATÁLOGO: se o cliente pedir pra ver os produtos, o catálogo, ou "o que vocês têm", responda
brevemente em texto e inclua sozinho ao final o marcador <<CATALOG>> - isso mostra uma vitrine com fotos
reais de todas as linhas, e o próprio cliente pode clicar na que gostar (isso já vai disparar o restante
do fluxo sozinho, você não precisa fazer mais nada nesse momento além de aguardar).

MOSTRANDO FOTO DE UM PRODUTO ESPECÍFICO: se o cliente perguntar como é um produto específico que ele já
mencionou (não o catálogo geral), inclua <<SHOWIMG:Nome Exato da Linha>> ao final da mensagem.

GERANDO ORÇAMENTO: quando tiver informação suficiente, responda com uma mensagem curta de transição
(ex: "Perfeito! Montei seu orçamento aqui 👇") e, IMEDIATAMENTE APÓS, inclua um bloco especial no seguinte
formato EXATO (sem markdown, sem texto antes ou depois dentro do bloco):

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

No campo "cliente_nome": se o cliente já disse o nome dele durante a conversa, use esse nome. Se ele NUNCA
disse o nome, escreva exatamente a palavra "Cliente" - nunca deixe vazio, nunca use um traço "-" ou "N/A".

REGRA CRÍTICA DE FORMATO: as únicas tags especiais permitidas em toda a conversa são exatamente
<<QUOTE>>...<<END>>, <<SHOWIMG:Nome da Linha>> e <<CATALOG>>, nos formatos mostrados acima. Nunca invente,
gere ou deixe escapar qualquer outra tag, marcador ou código entre sinais de menor/maior. Se não for gerar
orçamento nem mostrar imagem/catálogo, responda apenas com texto comum.

Se você receber uma instrução de sistema avisando que o cliente viu uma prévia visual (foto do ambiente ou
prévia gerada), comente de forma natural e pergunte o que achou, sem gerar novo bloco.

Se você receber uma instrução de sistema avisando que o cliente aprovou o orçamento, assuma o papel de
"vendedor fechando a venda": confirme a forma de pagamento escolhida, informe prazo de entrega, e finalize
com uma mensagem de confirmação calorosa. Não gere novo bloco <<QUOTE>> nesse momento.

Mantenha sempre o tom de WhatsApp: mensagens curtas, sem formatação markdown (sem **negrito**, sem #, sem listas com traço),
pode usar emojis pontuais e quebras de linha.
`.trim();
  }

  // --- chamadas à OpenRouter ---

  async function callOpenRouterChat(messages) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.6,
        max_tokens: 500,
        reasoning: { exclude: true }, // impede o modelo de "pensar em voz alta" na resposta
      }),
    });
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // Detecta se a resposta parece ser um "vazamento de raciocínio" (modelo pensando
  // em voz alta em vez de responder) - alguns modelos gratuitos fazem isso mesmo
  // com reasoning.exclude, então isso é uma segunda camada de proteção.
  function looksLikeReasoningLeak(text) {
    if (!text) return false;
    const leakMarkers = /\b(Okay, let's|Let me think|Wait, but|Wait, the user|First, I need|I need to (check|confirm|figure))\b/i;
    if (leakMarkers.test(text)) return true;
    // resposta muito longa e sem nenhuma pontuação de emoji/tom de WhatsApp também é suspeita
    if (text.length > 900 && !/[😊👋✅📋🧱]/.test(text)) return true;
    return false;
  }

  async function callImageModelRaw(contentParts) {
    const imageModel = window.PILLARIS_CONFIG.IMAGE_MODEL;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: imageModel,
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
      }),
    });
    if (!response.ok) throw new Error(`OpenRouter(image) ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const images = data.choices?.[0]?.message?.images || [];
    const dataUri = images[0]?.image_url?.url || null;
    if (!dataUri) throw new Error("Resposta sem imagem");
    return dataUri;
  }

  // --- foto de referência do produto: agora é sempre a foto REAL bundled, sem IA ---

  function showProductImage(nomeAproximado) {
    const linha = findLinhaByNome(nomeAproximado);
    if (!linha) return;
    addImageBubble(linha.imagem, "in", `${linha.nome} — ${linha.tipologia}, ${linha.formatos[0]?.medida || ""}`);
  }

  // --- catálogo: clique gera prévia sintética (sem precisar de foto do cliente) ---

  function handleCatalogClick(linha) {
    currentProduct = linha;
    addBubble(`(Selecionou ${linha.nome} no catálogo)`, "out");

    if (knownAmbiente) {
      generateRoomPreview(linha, knownAmbiente);
    } else {
      awaitingAmbienteFor = linha;
      const alvo = linha.aplicacao === "parede" ? "colocar esse revestimento" : "colocar esse piso";
      addBubble(`Boa escolha, o ${linha.nome}! 😍 Onde você gostaria de ${alvo}? Sala? Quarto? Fachada? Me diga!`, "in");
    }
  }

  async function generateRoomPreview(linha, ambiente) {
    const loadingRow = addImageLoading(`Gerando uma prévia do ${linha.nome} no(a) ${ambiente}...`);
    try {
      const superficie = linha.aplicacao === "parede" ? "parede em destaque" : "piso";
      const prompt = `Fotografia realista e profissional de um(a) ${ambiente} residencial, decorado de forma simples e ` +
        `elegante, onde ${superficie} está revestido(a) com porcelanato ${linha.nome} (${linha.descricao}), ` +
        `tipologia ${linha.tipologia}. Luz natural, sem pessoas, sem texto na imagem, aparência de foto real de decoração.`;
      const dataUri = await callImageModelRaw([{ type: "text", text: prompt }]);
      loadingRow.remove();
      addImageBubble(dataUri, "in", `Prévia: ${linha.nome} no(a) ${ambiente}! O que achou? 😊`);
      history.push({ role: "user", content: `[Vi uma prévia gerada do ${linha.nome} aplicado no(a) ${ambiente}.]` });
      callAssistant(
        `O cliente acabou de ver uma prévia visual gerada (${linha.nome} aplicado no(a) ${ambiente}, sem ser foto do ` +
        `ambiente real dele, só uma simulação). Comente de forma breve e calorosa, pergunte o que achou e se quer ` +
        `seguir com esse produto pro orçamento. Não gere <<QUOTE>>, <<SHOWIMG>> nem <<CATALOG>> agora.`
      );
    } catch (e) {
      loadingRow.remove();
      addBubble(`Não consegui gerar a prévia agora 😕 Mas o ${linha.nome} é lindo, quer que eu já monte um orçamento com ele?`, "in");
    }
  }

  // --- upload da foto do próprio ambiente do cliente ---

  async function applyFloorToRoomPhoto(roomDataUri, linha) {
    const loadingRow = addImageLoading(`Aplicando o ${linha.nome} na sua foto...`);
    try {
      const superficie = linha.aplicacao === "parede" ? "parede em destaque" : "piso/chão";
      const prompt = `Edite esta foto de ambiente: substitua APENAS o(a) ${superficie} atual por ${linha.nome} ` +
        `(${linha.descricao}), tipologia ${linha.tipologia}. Mantenha o restante do ambiente exatamente igual - ` +
        `só essa superfície deve mudar. Resultado deve parecer uma foto real, não um desenho.`;
      const dataUri = await callImageModelRaw([
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: roomDataUri } },
      ]);
      loadingRow.remove();
      addImageBubble(dataUri, "in", `Prévia com ${linha.nome} na sua foto! O que achou? 😊`);
      history.push({ role: "user", content: `[Enviei foto do meu ambiente e recebi prévia com ${linha.nome} aplicado.]` });
      callAssistant(
        `O cliente viu uma prévia com foto REAL do ambiente dele, com o ${linha.nome} aplicado. Comente de forma breve ` +
        `e calorosa e pergunte o que achou. Não gere <<QUOTE>>, <<SHOWIMG>> nem <<CATALOG>> agora.`
      );
    } catch (e) {
      loadingRow.remove();
      addBubble("Não consegui gerar a prévia na sua foto agora 😕 Mas posso te mostrar o catálogo com fotos de referência!", "in");
    }
  }

  // --- fluxo de conversa (texto) ---

  async function callAssistant(systemNote) {
    showTyping();
    try {
      const messages = [{ role: "system", content: systemPrompt }];
      if (systemNote) messages.push({ role: "system", content: systemNote });
      messages.push(...history);

      let raw = await callOpenRouterChat(messages);

      // Se parecer vazamento de raciocínio, tenta de novo uma vez antes de desistir
      if (looksLikeReasoningLeak(raw)) {
        raw = await callOpenRouterChat(messages);
      }
      if (looksLikeReasoningLeak(raw)) {
        hideTyping();
        addBubble("Deixa eu reformular isso rapidinho... pode repetir sua última mensagem? 🙏", "in");
        return;
      }

      hideTyping();

      const { visibleText, quote, showImgLinha, showCatalog } = parseAssistantText(raw);

      if (visibleText) {
        addBubble(visibleText, "in");
        history.push({ role: "assistant", content: visibleText });
      }

      if (showCatalog) {
        setTimeout(addCatalogGallery, 400);
      }

      if (showImgLinha) {
        setTimeout(() => showProductImage(showImgLinha), 400);
      }

      if (quote) {
        setTimeout(() => {
          addQuoteCard(quote);
          const linha = findLinhaByNome(quote.produto);
          if (linha) currentProduct = linha;
          if (quote.ambiente) knownAmbiente = quote.ambiente;
          FunnelStore.recordEvent(
            "quote_generated",
            { nome: quote.cliente_nome, produto: quote.produto, valor_total: quote.valor_total },
            adId,
            transcript
          );
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
    FunnelStore.recordEvent(
      "quote_approved",
      { nome: quote.cliente_nome, produto: quote.produto, valor_total: quote.valor_total },
      adId,
      transcript
    );
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
      FunnelStore.recordEvent("chat_start", {}, adId, transcript);
    }

    addBubble(text, "out");
    msgInput.value = "";

    // Respondendo "qual ambiente" depois de clicar num piso do catálogo
    if (awaitingAmbienteFor) {
      const linha = awaitingAmbienteFor;
      awaitingAmbienteFor = null;
      knownAmbiente = text;
      history.push({ role: "user", content: text });
      generateRoomPreview(linha, text);
      return;
    }

    // Respondendo "qual linha" depois de anexar uma foto do ambiente sem produto definido
    if (awaitingProductChoice) {
      const linha = findLinhaByNome(text);
      if (linha && pendingPhotoDataUri) {
        awaitingProductChoice = false;
        currentProduct = linha;
        const photo = pendingPhotoDataUri;
        pendingPhotoDataUri = null;
        history.push({ role: "user", content: text });
        applyFloorToRoomPhoto(photo, linha);
        return;
      }
      awaitingProductChoice = false;
    }

    history.push({ role: "user", content: text });
    callAssistant();
  }

  // --- upload de foto do ambiente ---

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  attachBtn.addEventListener("click", () => photoInput.click());

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files[0];
    photoInput.value = "";
    if (!file) return;

    if (!chatStarted) {
      chatStarted = true;
      FunnelStore.recordEvent("chat_start", {}, adId, transcript);
    }

    const dataUri = await fileToDataUrl(file);
    addImageBubble(dataUri, "out");

    if (currentProduct) {
      applyFloorToRoomPhoto(dataUri, currentProduct);
    } else {
      pendingPhotoDataUri = dataUri;
      awaitingProductChoice = true;
      const nomes = catalogo ? catalogo.linhas.map((l) => l.nome).join(", ") : "";
      addBubble(`Adorei! 📸 Antes de aplicar, me diz qual linha você quer ver nessa foto: ${nomes}?`, "in");
    }
  });

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
    if (statusLine) statusLine.textContent = `online · origem: ${adId}`;

    try {
      const res = await fetch("data/savane-produtos.json");
      catalogo = await res.json();
    } catch (e) {
      addBubble("⚠️ Não consegui carregar o catálogo de produtos (data/savane-produtos.json).", "in");
      return;
    }
    systemPrompt = buildSystemPrompt();

    FunnelStore.recordEvent("ad_click", {}, adId);

    const opening = "Olá! 👋 Vi que você chegou pelo nosso anúncio.\nSou a Ana, da loja revendedora Savane. Antes de mais nada, qual seu nome? E me conta, você está buscando revestimento pra qual ambiente da sua obra ou reforma?";
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
