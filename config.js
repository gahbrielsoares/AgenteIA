// Modelo de IA usado via OpenRouter para CONVERSA (texto).
// "openrouter/free" escolhe sozinho um modelo de chat gratuito disponível
// no momento. Se quiser fixar um modelo específico, veja a lista em
// https://openrouter.ai/models?max_price=0
//
// Modelo usado só para as PRÉVIAS DE AMBIENTE geradas por IA (catálogo ->
// escolher piso -> ver prévia, ou anexar foto do seu ambiente). As fotos
// do catálogo em si são reais (arquivos em assets/pisos/), não usam IA.
// Fica fixado na versão GRATUITA de propósito - sem fallback pago.
window.PILLARIS_CONFIG = {
  DEFAULT_MODEL: "openrouter/free",
  IMAGE_MODEL: "google/gemini-2.5-flash-image-preview:free",
};
