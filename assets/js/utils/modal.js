/*
 * Modal acessível baseado em <dialog> (substitui window.confirm/alert).
 *
 *   const ok = await modal.confirm({
 *       title: "Excluir evento?",
 *       message: 'O evento "X" será removido.',
 *       confirmLabel: "Excluir",
 *       tone: "danger"
 *   });
 *
 *   const value = await modal.show({
 *       title: "Inscrição confirmada!",
 *       content: elementoDom,              // conteúdo customizado (opcional)
 *       tone: "success",
 *       actions: [
 *           { label: "Ver evento", href: "evento.html?id=1", variant: "primary" },
 *           { label: "Fechar", value: "fechar", variant: "ghost" }
 *       ]
 *   });
 *
 * - <dialog>.showModal(): foco preso no modal, resto da página inerte.
 * - Esc e clique no fundo fecham (retornam null), salvo `dismissible: false`.
 * - Foco volta para o elemento que abriu o modal.
 * - Textos (title/message/labels) entram via textContent (sem risco de XSS).
 */
const modal = (function () {
    "use strict";

    const CLOSE_ANIMATION_FALLBACK_MS = 300;

    const ICONS = {
        danger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
        info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
        // Check "desenhado" (animação de traço definida no CSS em .success-check)
        success: '<svg class="success-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>'
    };

    let dialog = null;
    let current = null; // { resolve, returnFocus, dismissible }

    function build() {
        dialog = document.createElement("dialog");
        dialog.className = "modal";
        dialog.setAttribute("aria-labelledby", "modal-title");
        dialog.setAttribute("aria-describedby", "modal-message");
        dialog.innerHTML = `
            <div class="modal-card">
                <div class="modal-icon" aria-hidden="true"></div>
                <h2 class="modal-title" id="modal-title"></h2>
                <p class="modal-message" id="modal-message"></p>
                <div class="modal-content"></div>
                <div class="modal-actions"></div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Esc → fecha (se permitido), sempre com animação.
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            if (current?.dismissible) close(null);
        });

        // Clique no fundo (fora do cartão) → fecha.
        dialog.addEventListener("click", (event) => {
            if (event.target === dialog && current?.dismissible) close(null);
        });

        dialog.querySelector(".modal-actions").addEventListener("click", (event) => {
            const button = event.target.closest("button[data-value]");
            if (button) close(button.dataset.value);
        });
    }

    function close(value) {
        if (!current) return;
        const { resolve, returnFocus } = current;
        current = null;

        const finish = () => {
            dialog.classList.remove("is-closing");
            dialog.close();
            returnFocus?.focus?.({ preventScroll: true });
            resolve(value);
        };

        dialog.classList.add("is-closing");
        let done = false;
        const once = () => { if (!done) { done = true; finish(); } };
        dialog.addEventListener("animationend", once, { once: true });
        setTimeout(once, CLOSE_ANIMATION_FALLBACK_MS);
    }

    function renderAction(action) {
        const variantClass = {
            primary: "btn-cta",
            danger: "btn-danger",
            ghost: "btn-ghost"
        }[action.variant ?? "ghost"];

        const element = document.createElement(action.href ? "a" : "button");
        element.className = variantClass;
        element.textContent = action.label;

        if (action.href) {
            element.href = action.href;
        } else {
            element.type = "button";
            element.dataset.value = action.value ?? "";
        }
        if (action.autofocus) element.autofocus = true;
        return element;
    }

    /**
     * Abre o modal.
     * @returns {Promise<string|null>} `value` da ação clicada, ou null se dispensado.
     */
    function show({ title, message = "", content = null, tone = "info", actions = [], dismissible = true }) {
        if (!dialog) build();
        if (current) close(null); // um modal por vez

        dialog.dataset.tone = tone;
        dialog.querySelector(".modal-icon").innerHTML = ICONS[tone] ?? ICONS.info;
        dialog.querySelector(".modal-title").textContent = title ?? "";

        const messageEl = dialog.querySelector(".modal-message");
        messageEl.textContent = message;
        messageEl.hidden = !message;

        const contentEl = dialog.querySelector(".modal-content");
        contentEl.replaceChildren(...(content ? [content] : []));
        contentEl.hidden = !content;

        const actionsEl = dialog.querySelector(".modal-actions");
        actionsEl.replaceChildren(...actions.map(renderAction));

        return new Promise((resolve) => {
            current = { resolve, returnFocus: document.activeElement, dismissible };
            dialog.showModal();
            (actionsEl.querySelector("[autofocus]") ?? actionsEl.firstElementChild)?.focus();
        });
    }

    /**
     * Confirmação sim/não.
     * @returns {Promise<boolean>}
     */
    async function confirm({ title, message, confirmLabel = "Confirmar", cancelLabel = "Cancelar", tone = "danger" }) {
        const value = await show({
            title,
            message,
            tone,
            actions: [
                // Foco inicial em "Cancelar": Enter acidental não executa ação destrutiva.
                { label: cancelLabel, value: "cancel", variant: "ghost", autofocus: true },
                { label: confirmLabel, value: "confirm", variant: tone === "danger" ? "danger" : "primary" }
            ]
        });
        return value === "confirm";
    }

    return Object.freeze({ show, confirm });
})();
