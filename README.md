# Protótipo — Fluxo Comercial com IA (demo Pillaris-style)

Versão 100% estática. Sem Vercel, sem banco de dados, sem servidor — só GitHub Pages.

## Como funciona (arquitetura simples)

- **A chave da IA** fica guardada no `localStorage` do próprio navegador (um popup pede na entrada do site). O navegador chama a OpenRouter direto — ela permite chamadas de navegador (CORS liberado), diferente de OpenAI/Anthropic puras.
- **O painel/funil** também usa `localStorage`, só que compartilhado entre abas do mesmo navegador. Quando o WhatsApp simulado registra um evento, o painel (se estiver aberto em outra aba, mesmo navegador) atualiza sozinho via evento `storage` do navegador.

**Importante:** isso só sincroniza em tempo real se o painel e o WhatsApp simulado estiverem abertos **no mesmo navegador**, em abas diferentes — exatamente como planejado (duas abas lado a lado na reunião). Não sincroniza entre aparelhos diferentes.

## O que é cada arquivo

- `index.html`, `style.css` — landing com os 2 botões
- `anuncio.html`, `whatsapp.css`, `chat.js` — réplica do WhatsApp, IA respondendo de verdade
- `painel.html`, `painel.css`, `painel.js` — kanban do funil
- `apikey.js`, `apikey-modal.css` — popup que pede a chave da OpenRouter e guarda no navegador
- `funnel-store.js` — "banco de dados" simples via localStorage, compartilhado entre as abas
- `config.js` — modelo de IA padrão (pode trocar aqui)
- `data/savane-produtos.json` — catálogo que alimenta a IA (linhas, formatos, preços)

## Funcionalidade nova: fotos e prévia de ambiente

- **Foto do produto**: quando a Ana menciona ou recomenda uma linha, ela mostra automaticamente uma foto de referência gerada por IA (fica guardada na memória da aba, então só gera uma vez por linha por sessão).
- **Aplicar piso no seu ambiente**: clique no clipe (📎) ao lado da caixa de mensagem, mande uma foto do cômodo. Se já tiver um produto em discussão, a IA já aplica direto; senão, ela pergunta qual linha antes.

**Por que não pegamos as fotos direto do site da Savane?** Duas razões: (1) o site deles carrega os produtos via JavaScript depois que a página abre, então não dá pra "ler" esse conteúdo de outro site (navegadores bloqueiam isso por segurança - é a mesma trava que impede um site de bisbilhotar outro); (2) mesmo que desse, seriam fotos profissionais pertencentes à Savane, e usar sem autorização levanta questão de direito autoral.

**100% gratuito, de propósito:** `IMAGE_MODEL` está fixado na variante `:free`, e `IMAGE_MODEL_FALLBACK` está vazio — ou seja, o app NUNCA vai chamar um modelo pago, mesmo que o gratuito falhe. Se isso acontecer, você vê uma mensagem de erro amigável em vez de qualquer cobrança.

**Ponto de atenção real:** modelos gratuitos de geração de IMAGEM são mais instáveis que os de texto — podem ficar lentos, sair do ar, ou às vezes recusar o pedido. **Teste isso à exaustão antes de sexta** (gere fotos de 3-4 linhas diferentes, teste upload de foto de ambiente 2-3 vezes). Se a instabilidade for grande demais nos seus testes, meu conselho sincero: leve a demo com essa funcionalidade como "bônus experimental" e centre a apresentação no fluxo de texto + orçamento (que já está sólido), puxando a prévia de imagem só se der certo na hora.



### 1. Sua chave da OpenRouter

1. Acesse https://openrouter.ai/keys → gere uma chave
2. Modelo já vem configurado como `openrouter/free` em `config.js` — é um roteador oficial da OpenRouter que escolhe sozinho um modelo de chat gratuito disponível no momento, então não precisa nem de crédito na conta pra testar
3. **Atenção:** use sempre um modelo de **chat/conversa**. Modelos de "rerank" (ex: qualquer coisa com `-rerank-` no nome) não servem — eles só ordenam documentos por relevância, não geram texto de resposta, e não vão fazer a Ana conversar com ninguém
4. Se quiser trocar de modelo depois (ex: pra um pago, mais rápido/confiável), pode editar `config.js` ou usar o menu (⋮) no WhatsApp simulado — veja a lista completa em https://openrouter.ai/models?max_price=0 (filtro de gratuitos)

### 2. Subir no GitHub Pages

1. Crie um repositório no GitHub e suba todos os arquivos desta pasta
2. Settings → Pages → Source: branch `main`, pasta `/root`
3. Copie o link gerado, ex: `https://seuusuario.github.io/pillaris-mvp/`

Pronto — não tem passo 3. Sem Vercel, sem Upstash, sem variável de ambiente.

### 3. Testar ANTES da reunião

1. Abra o link do GitHub Pages
2. Vai aparecer o popup pedindo a chave da OpenRouter — cole e salve (fica guardada só nesse navegador)
3. Abra "Painel de Gestão" numa aba, deixe aberta
4. Em outra aba do **mesmo navegador**, abra "Anúncio Simulado" e converse com a IA como se fosse cliente comprando porcelanato
5. Veja o card se movendo pelas colunas do painel em tempo real
6. Clique em "Reiniciar demonstração" no painel antes da reunião de verdade, pra zerar os números

## Avisos importantes pra você saber (e não ser pego de surpresa)

- **A chave fica visível** pra quem abrir o "Inspecionar" do navegador durante a demo. Não é um problema pra uma demonstração privada de uma reunião, mas nunca reaproveite esse código puro assim num site público de verdade — nesse caso, aí sim precisaria de um backend escondendo a chave.
- Se quiser trocar a chave ou o modelo depois de já ter salvo, clique no ícone de menu (⋮) no topo do WhatsApp simulado.
- **Modo privado/anônimo do navegador apaga o localStorage ao fechar** — não use pra demo, ou vai ter que digitar a chave de novo toda vez.

## Se algo der errado no dia

- Popup não aparece → confira se `apikey.js` está sendo carregado (Console do navegador, F12, aba Console, procure erros)
- IA não responde / erro 401 → chave errada ou sem crédito na OpenRouter. Clique no menu (⋮) do WhatsApp pra reconfigurar
- IA responde só números/pontuações estranhas, ou dá erro estranho de formato → provavelmente configurou um modelo de "rerank" por engano. Troque pra `openrouter/free` ou outro modelo de chat
- IA "vaza" algum código estranho tipo `<CPA_DONE>` no meio da conversa → isso pode acontecer porque `openrouter/free` sorteia um modelo aleatório a cada vez, e alguns seguem instruções de formato pior que outros. Já existe um filtro de segurança no `chat.js` que remove esses vazamentos automaticamente, mas se quiser mais estabilidade pro dia da reunião, **fixe um modelo específico** em vez do sorteio — teste um destes em `config.js` antes de sexta e use o que se comportar melhor nas suas conversas de teste: `openai/gpt-oss-120b:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `nvidia/nemotron-nano-9b-v2:free`
- Foto do produto ou prévia de ambiente não geram / ficam girando e dão erro → o modelo de imagem gratuito provavelmente saiu do ar temporariamente (comum em modelos free de imagem) ou está sobrecarregado. Tente de novo em alguns minutos, ou troque `IMAGE_MODEL` em `config.js` por outra opção gratuita da lista em https://openrouter.ai/models?max_price=0
- Botão de anexo (📎) não abre nada → confira se está testando num navegador atualizado; em iPhone/Android deve abrir a opção de tirar foto ou escolher da galeria
- **Recomendação geral:** teste a conversa completa (do "oi" até o pagamento aprovado) pelo menos umas 5 vezes antes da reunião de verdade. Modelos gratuitos têm variação de comportamento — rodar várias vezes garante que você viu os erros possíveis antes do Junior ver
- Painel não atualiza → confira se as duas abas estão no **mesmo navegador** (não funciona entre navegadores diferentes ou celular + notebook)
- IA não gera orçamento → ela precisa saber ambiente + produto + metragem antes de montar o `<<QUOTE>>`. Sugestão de script pro Junior seguir: "quero porcelanato pra sala, uns 25m², queria algo tipo mármore" → já dá pra fechar o orçamento em 2-3 mensagens
