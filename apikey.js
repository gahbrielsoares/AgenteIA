(function () {
  const KEY_STORAGE = "pillaris_openrouter_key";
  const MODEL_STORAGE = "pillaris_openrouter_model";

  function get() {
    return localStorage.getItem(KEY_STORAGE) || "";
  }

  function getModel() {
    return localStorage.getItem(MODEL_STORAGE) || (window.PILLARIS_CONFIG && window.PILLARIS_CONFIG.DEFAULT_MODEL) || "anthropic/claude-3.5-sonnet";
  }

  function save(key, model) {
    localStorage.setItem(KEY_STORAGE, key.trim());
    if (model) localStorage.setItem(MODEL_STORAGE, model.trim());
  }

  function clear() {
    localStorage.removeItem(KEY_STORAGE);
    localStorage.removeItem(MODEL_STORAGE);
  }

  function buildModal(onSave) {
    const overlay = document.createElement("div");
    overlay.className = "pk-overlay";

    const defaultModel = getModel();

    overlay.innerHTML = `
      <div class="pk-modal">
        <div class="pk-modal-title">Configurar IA da demonstração</div>
        <p class="pk-modal-text">
          Cole aqui sua chave da OpenRouter. Ela fica salva <strong>só neste navegador</strong>
          (localStorage) — nunca é enviada para nenhum servidor nosso, só direto para a OpenRouter.
        </p>
        <label class="pk-label">Chave da OpenRouter (sk-or-...)</label>
        <input type="password" id="pkKeyInput" class="pk-input" placeholder="sk-or-v1-..." autocomplete="off" />
        <label class="pk-label">Modelo</label>
        <input type="text" id="pkModelInput" class="pk-input" value="${defaultModel}" autocomplete="off" />
        <button id="pkSaveBtn" class="pk-btn">Salvar e continuar</button>
        <div class="pk-modal-hint">Gere uma chave grátis em openrouter.ai/keys</div>
      </div>
    `;

    document.body.appendChild(overlay);

    const keyInput = overlay.querySelector("#pkKeyInput");
    const modelInput = overlay.querySelector("#pkModelInput");
    const saveBtn = overlay.querySelector("#pkSaveBtn");

    keyInput.focus();

    function submit() {
      const k = keyInput.value.trim();
      if (!k) {
        keyInput.classList.add("pk-input-error");
        return;
      }
      save(k, modelInput.value.trim());
      overlay.remove();
      onSave(k, modelInput.value.trim());
    }

    saveBtn.addEventListener("click", submit);
    keyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
  }

  function ensure(callback) {
    const existing = get();
    if (existing) {
      callback(existing, getModel());
      return;
    }
    buildModal(callback);
  }

  function reconfigure(callback) {
    buildModal(callback || function () {});
  }

  window.PillarisKey = { get, getModel, save, clear, ensure, reconfigure };
})();
