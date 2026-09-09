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

## Deploy (bem mais simples agora)

### 1. Sua chave da OpenRouter

1. Acesse https://openrouter.ai/keys → gere uma chave
2. Adicione um pouco de crédito (a demo consome centavos por conversa)
3. Modelo sugerido: `anthropic/claude-3.5-sonnet` (segue melhor as instruções de formato) ou `openai/gpt-4o-mini` (mais barato) — já vem configurado em `config.js`, mas dá pra trocar no popup também

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
- Painel não atualiza → confira se as duas abas estão no **mesmo navegador** (não funciona entre navegadores diferentes ou celular + notebook)
- IA não gera orçamento → ela precisa saber ambiente + produto + metragem antes de montar o `<<QUOTE>>`. Sugestão de script pro Junior seguir: "quero porcelanato pra sala, uns 25m², queria algo tipo mármore" → já dá pra fechar o orçamento em 2-3 mensagens
