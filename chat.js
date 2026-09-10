(function () {
  const chatWindow = document.getElementById("chatWindow");
  const msgInput = document.getElementById("msgInput");
  const sendBtn = document.getElementById("sendBtn");
  const attachBtn = document.getElementById("attachBtn");
  const photoInput = document.getElementById("photoInput");
  const menuBtn = document.querySelector(".wa-menu");

  let history = [];
  let chatStarted = false;
  let catalogo = null;
  let systemPrompt = "";
  let apiKey = "";
  let model = "";

  // --- estado da parte de imagem ---
  const imageCache = {}; // nome da linha -> data URI já gerado
  let currentProduct = null; // { nome, tipologia, formato, descricao }
  let pendingPhotoDataUri = null;
  let awaitingProductChoice = false;

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

  function addImageBubble(dataUri, who, caption) {
    const row = document.createElement("div");
    row.className = `wa-bubble-row ${who}`;
    const wrap = document.createElement("div");
    wrap.className = `wa-image-bubble ${who}`;
    const img = document.createElement("img");
    img.src = dataUri;
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

    return { visibleText: stripStrayTags(text), quote, showImgLinha };
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

MOSTRANDO IMAGENS: Se o cliente pedir pra ver como é o produto, pedir uma foto/imagem, ou perguntar
"como ele é visualmente", responda normalmente explicando em texto E inclua, sozinho ao final da mensagem,
o marcador <<SHOWIMG:Nome Exato da Linha>> (usando o nome EXATO de uma das linhas do catálogo, ex:
<<SHOWIMG:Savane Wood>>). Isso vai mostrar uma foto de referência pro cliente. Também pode usar esse
marcador proativamente quando estiver recomendando/sugerindo uma linha específica pela primeira vez.

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
<<QUOTE>> ... <<END>> e <<SHOWIMG:Nome da Linha>>, nos formatos mostrados acima. Nunca invente, gere ou
deixe escapar qualquer outra tag, marcador ou código entre sinais de menor/maior (como <ALGO>, [ALGO] ou
similares). Se não for gerar orçamento nem mostrar imagem, responda apenas com texto comum.

Se você receber uma instrução de sistema avisando que o cliente enviou uma foto do ambiente dele e viu uma
prévia com o piso aplicado, comente de forma natural e pergunte o que achou, sem gerar novo bloco.

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
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 500 }),
    });
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }

  async function callImageModelRaw(imageModel, contentParts) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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

  async function callImageModel(contentParts) {
    const primary = window.PILLARIS_CONFIG.IMAGE_MODEL;
    const fallback = window.PILLARIS_CONFIG.IMAGE_MODEL_FALLBACK;
    try {
      return await callImageModelRaw(primary, contentParts);
    } catch (e) {
      if (!fallback || fallback === primary) throw e;
      return await callImageModelRaw(fallback, contentParts);
    }
  }

  // --- foto de referência do produto ---

  async function getProductImageDataUri(linha) {
    if (imageCache[linha.nome]) return imageCache[linha.nome];
    const prompt = `Fotografia realista, em close-up, de um piso de porcelanato ${linha.nome}, ` +
      `tipologia ${linha.tipologia}, formato ${linha.formato}, aplicado em um ambiente de ${linha.ambientes.join(" ou ")}. ` +
      `${linha.descricao} Luz natural, foto de catálogo de loja de materiais de construção, alta qualidade, sem pessoas, sem texto na imagem.`;
    const dataUri = await callImageModel([{ type: "text", text: prompt }]);
    imageCache[linha.nome] = dataUri;
    return dataUri;
  }

  async function showProductImage(nomeAproximado) {
    const linha = findLinhaByNome(nomeAproximado);
    if (!linha) return;
    const loadingRow = addImageLoading(`Gerando foto de referência do ${linha.nome}...`);
    try {
      const dataUri = await getProductImageDataUri(linha);
      loadingRow.remove();
      addImageBubble(dataUri, "in", `${linha.nome} — ${linha.tipologia}, ${linha.formato}`);
    } catch (e) {
      loadingRow.remove();
      addBubble(`(Não consegui gerar a foto de referência agora, mas o ${linha.nome} tem ${linha.descricao.toLowerCase()})`, "in");
    }
  }

  // --- aplicar piso na foto do ambiente do cliente ---

  async function applyFloorToRoomPhoto(roomDataUri, linha) {
    const loadingRow = addImageLoading(`Aplicando o piso ${linha.nome} na sua foto...`);
    try {
      const prompt = `Edite esta foto de ambiente: substitua APENAS o piso/chão atual por um piso de ` +
        `porcelanato ${linha.nome} (${linha.descricao}), tipologia ${linha.tipologia}, formato ${linha.formato}. ` +
        `Mantenha paredes, móveis, iluminação e todo o resto do ambiente exatamente iguais - só o piso deve mudar. ` +
        `Resultado deve parecer uma foto real, não um desenho.`;
      const dataUri = await callImageModel([
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: roomDataUri } },
      ]);
      loadingRow.remove();
      addImageBubble(dataUri, "in", `Prévia com ${linha.nome}! O que achou? 😊`);
      history.push({
        role: "user",
        content: `[Enviei uma foto do meu ambiente e recebi uma prévia com o piso ${linha.nome} aplicado.]`,
      });
      callAssistant(
        `O cliente acabou de ver uma prévia visual (foto do ambiente dele com o piso ${linha.nome} aplicado). ` +
        `Comente de forma breve e calorosa e pergunte o que achou, sem gerar bloco <<QUOTE>> nem <<SHOWIMG>> agora.`
      );
    } catch (e) {
      loadingRow.remove();
      addBubble("Poxa, não consegui gerar a prévia na sua foto agora 😕 Mas posso te mostrar uma foto de referência do produto, se quiser!", "in");
    }
  }

  // --- fluxo de conversa (texto) ---

  async function callAssistant(systemNote) {
    showTyping();
    try {
      const messages = [{ role: "system", content: systemPrompt }];
      if (systemNote) messages.push({ role: "system", content: systemNote });
      messages.push(...history);

      const raw = await callOpenRouterChat(messages);
      hideTyping();

      const { visibleText, quote, showImgLinha } = parseAssistantText(raw);

      if (visibleText) {
        addBubble(visibleText, "in");
        history.push({ role: "assistant", content: visibleText });
      }

      if (showImgLinha) {
        setTimeout(() => showProductImage(showImgLinha), 400);
      }

      if (quote) {
        setTimeout(() => {
          addQuoteCard(quote);
          const linha = findLinhaByNome(quote.produto);
          if (linha) currentProduct = linha;
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
    msgInput.value = "";

    // Se estávamos esperando o cliente escolher qual linha aplicar na foto
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
      // não reconheceu a linha: deixa cair no fluxo normal, a Ana pode ajudar
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
      FunnelStore.recordEvent("chat_start", {});
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
    try {
      const res = await fetch("data/savane-produtos.json");
      catalogo = await res.json();
    } catch (e) {
      addBubble("⚠️ Não consegui carregar o catálogo de produtos (data/savane-produtos.json).", "in");
      return;
    }
    systemPrompt = buildSystemPrompt();

    FunnelStore.recordEvent("ad_click", {});

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
