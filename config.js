// Modelo de IA usado via OpenRouter para CONVERSA.
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
//
// Modelo de IA usado para IMAGEM (mostrar foto do produto e aplicar o piso
// na foto do ambiente do cliente). Esse recurso usa um modelo diferente,
// especializado em gerar/editar imagens.
// A variante ":free" pode sair do ar sem aviso (modelos gratuitos de imagem
// são mais instáveis que os de texto). Se parar de funcionar, troque para
// "google/gemini-3.1-flash-image" (pago, mas custa poucos centavos por
// imagem - precisa ter um pouco de crédito na conta OpenRouter).
window.PILLARIS_CONFIG = {
  DEFAULT_MODEL: "openrouter/free",
  IMAGE_MODEL: "google/gemini-2.5-flash-image-preview:free",
  IMAGE_MODEL_FALLBACK: "google/gemini-3.1-flash-image",
};
