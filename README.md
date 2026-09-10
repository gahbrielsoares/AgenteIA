# Protótipo — Fluxo Comercial com IA (demo Pillaris-style)

100% estático. Sem servidor, sem banco de dados pago — só GitHub Pages + OpenRouter gratuito.

## Deploy

1. Suba todos os arquivos desta pasta pro seu repositório no GitHub (incluindo a pasta `assets/` com as fotos — **o zip ficou com ~3.7MB por causa das fotos dos pisos**, o upload pode demorar um pouco mais que da última vez)
2. Settings → Pages → branch `main`, pasta `/root`
3. Abra o link gerado, cole sua chave da OpenRouter no popup, pronto

## O que tem agora

### Dois anúncios rastreáveis
Na landing, "Anúncio 1" e "Anúncio 2" levam pro mesmo chat, mas cada um marca a origem do lead (`?ad=1` / `?ad=2` na URL). O painel mostra qual dos dois converte melhor.

### Catálogo real (suas 4 fotos)
- `Savane Nude`, `Savane Canyon`, `Savane Teca`, `Savane Alpina` — nomes fictícios, fotos reais que você mandou, em `assets/pisos/`
- Quando o cliente pede pra ver os produtos, a Ana mostra a vitrine (fotos reais, sem IA, carregam na hora)
- Ao clicar num piso: se já souber o ambiente, gera direto uma prévia (IA) de como fica nesse tipo de ambiente; se não souber, pergunta antes
- Também dá pra anexar uma foto do SEU ambiente (botão 📎) e a IA edita ela aplicando o piso escolhido

### Painel redesenhado
- KPIs no topo: visitas, taxa de conversão, tempo médio até o orçamento, anúncio com melhor conversão
- Funil (kanban) mais fino e minimalista
- Comparativo de conversão por anúncio (barras)
- "Onde os clientes mais abandonam" — calculado a partir dos números reais do funil, destaca a maior queda
- **Leads Qualificados**: fila de quem já recebeu orçamento mas ainda não fechou, ordenada por tempo de espera (mais urgente primeiro). Clicar num card abre o histórico completo da conversa
- Caixa "Pergunte à IA" — faz uma pergunta em português sobre os dados do funil (usa os números reais, não inventa)

### Dados de demonstração já populados
Na primeira vez que o painel ou o site abrem, ele semeia sozinho um histórico fictício (visitas, cliques, 3 leads qualificados fictícios com conversas de exemplo) pra não parecer vazio. Isso só acontece uma vez — depois disso, os números reais da sua demo ao vivo se somam a esse histórico. **Clicar em "Reiniciar demonstração" apaga esse histórico junto** — decida antes da reunião se quer o board "já rodando" (não reinicie) ou totalmente limpo (reinicie).

## Regra de "lead qualificado"
Um lead entra na fila de qualificados no momento em que a IA gera o orçamento (já tem ambiente + produto + metragem = tudo que um vendedor humano precisaria pra continuar). Sai da fila quando o orçamento é aprovado.

## Sem custo, de propósito
- Conversa: `openrouter/free` (roteador que escolhe um modelo de chat gratuito automaticamente)
- Imagem (prévias): `google/gemini-2.5-flash-image-preview:free` — sem fallback pago. Se sair do ar, você vê um erro amigável, nunca uma cobrança
- Fotos do catálogo: arquivos reais em `assets/`, não usam IA nem custam nada

## Teste antes da reunião
1. Rode o fluxo completo pelos dois anúncios pra ver o comparativo aparecer no painel
2. Teste "ver catálogo" → clicar num piso → responder o ambiente → ver a prévia gerada
3. Teste anexar uma foto sua também (fluxo separado, mais realista)
4. Deixe um orçamento parado de propósito (não aprove) e veja ele aparecer em "Leads Qualificados" com o tempo passando
5. Faça 2-3 perguntas na caixa "Pergunte à IA" do painel
6. Gere pelo menos 3-4 prévias de imagem diferentes — é a parte mais instável do protótipo

## Se algo der errado no dia
- Modelo gratuito de imagem ou de texto instável/fora do ar → troque em `config.js` por outra opção gratuita em https://openrouter.ai/models?max_price=0
- Painel não atualiza → confira se as abas estão no mesmo navegador (não sincroniza entre aparelhos)
- "Leads Qualificados" não mostra o lead ao vivo → só aparece depois que o orçamento é gerado (antes disso ele só existe na coluna do funil)
- Quer testar do zero sem o histórico fictício → botão "Reiniciar demonstração" no painel
