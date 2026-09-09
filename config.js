// Modelo de IA usado via OpenRouter.
//
// IMPORTANTE: use um modelo de CHAT (conversa), não de "rerank" (ordenação de
// documentos por relevância) - rerank não gera texto, só retorna pontuações,
// e não serve pra IA conversar com o cliente.
//
// "openrouter/free" é um roteador oficial da OpenRouter que escolhe sozinho
// um modelo de chat gratuito disponível no momento (a lista de gratuitos muda
// com frequência, então isso evita que seu app pare de funcionar do nada).
// Se quiser fixar um modelo específico, veja a lista atualizada em
// https://openrouter.ai/models?max_price=0
window.PILLARIS_CONFIG = {
  DEFAULT_MODEL: "openrouter/free",
};
