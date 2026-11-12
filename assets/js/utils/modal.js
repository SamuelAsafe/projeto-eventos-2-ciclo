/*
 * Modal acessível baseado em <dialog> (substitui window.confirm/alert e
 * hospeda formulários).
 *
 *   // Confirmação
 *   const ok = await modal.confirm({ title: "Excluir evento?", message: "...", confirmLabel: "Excluir" });
 *
 *   // Mensagem com ações
 *   const value = await modal.show({
 *       title: "Inscrição confirmada!", content: elementoDom, tone: "success",
 *       actions: [{ label: "Ver evento", href: "...", variant: "primary" }, { label: "Fechar", value: "fechar" }]
 *   });
 *
 *   // Formulário: o modal NÃO fecha sozinho; a página chama ctrl.close() após salvar.
 *   const ctrl = modal.form({ title: "Editar evento", form: formElement, size: "lg" });
 *   ...await salvar(); ctrl.close("salvo");
 *   // Qualquer elemento com [data-modal-close] dentro do conteúdo fecha (ex.: "Cancelar").
 *
 * - <dialog>.showModal(): foco preso no modal, resto da página inerte.
 * - Esc e clique no fundo fecham (valor null), salvo `dismissible: false`.
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
    let current = null; // { token, resolve, returnFocus, dismissible }

    function build() {
        dialog = document.createElement("dialog");
        dialog.className = "modal";
        dialog.setAttribute("aria-labelledby", "modal-title");
        dialog.innerHTML = `
            <div class="modal-card">
                <button type="button" class="modal-close" data-modal-close aria-label="Fechar">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
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
            if (current?.dismissible) close(current.token, null);
        });

        // Clique no fundo (fora do cartão) → fecha.
        dialog.addEventListener("click", (event) => {
            if (!current) return;

            if (event.target === dialog && current.dismissible) {
                close(current.token, null);
                return;
            }

            const action = event.target.closest(".modal-actions button[data-value]");
            if (action) {
                close(current.token, action.dataset.value);
                return;
            }

            if (event.target.closest("[data-modal-close]")) close(current.token, null);
        });
    }

    function close(token, value) {
        if (!current || current.token !== token) return; // já fechado / outro modal
        const { resolve, returnFocus } = current;
        current = null;

        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            dialog.classList.remove("is-closing");
            dialog.close();
            returnFocus?.focus?.({ preventScroll: true });
            resolve(value);
        };

        dialog.classList.add("is-closing");
        dialog.addEventListener("animationend", finish, { once: true });
        setTimeout(finish, CLOSE_ANIMATION_FALLBACK_MS);
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
     * Núcleo: abre o modal e devolve um controle.
     * @returns {{ close: (value?: any) => void, closed: Promise<any> }}
     */
    function open({
        title,
        message = "",
        content = null,
        tone = "info",
        icon = true,
        actions = [],
        dismissible = true,
        size = "sm",
        initialFocus = null
    }) {
        if (!dialog) build();
        if (current) close(current.token, null); // um modal por vez

        const token = Symbol("modal");
        dialog.dataset.tone = tone;
        dialog.dataset.size = size;

        const iconEl = dialog.querySelector(".modal-icon");
        iconEl.innerHTML = icon ? (ICONS[tone] ?? ICONS.info) : "";

        dialog.querySelector(".modal-title").textContent = title ?? "";
        dialog.querySelector(".modal-close").hidden = !dismissible;

        const messageEl = dialog.querySelector(".modal-message");
        messageEl.textContent = message;
        messageEl.hidden = !message;
        if (message) dialog.setAttribute("aria-describedby", "modal-message");
        else dialog.removeAttribute("aria-describedby");

        const contentEl = dialog.querySelector(".modal-content");
        contentEl.replaceChildren(...(content ? [content] : []));
        contentEl.hidden = !content;

        const actionsEl = dialog.querySelector(".modal-actions");
        actionsEl.replaceChildren(...actions.map(renderAction));
        actionsEl.hidden = actions.length === 0;

        const closed = new Promise((resolve) => {
            current = { token, resolve, returnFocus: document.activeElement, dismissible };
        });

        dialog.showModal();
        const focusTarget = initialFocus
            ?? actionsEl.querySelector("[autofocus]")
            ?? contentEl.querySelector("input:not([type=hidden]), select, textarea")
            ?? actionsEl.firstElementChild;
        focusTarget?.focus();

        return Object.freeze({ close: (value = null) => close(token, value), closed });
    }

    /** Mensagem com ações. @returns {Promise<string|null>} */
    function show(options) {
        return open(options).closed;
    }

    /** Confirmação sim/não. @returns {Promise<boolean>} */
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

    /**
     * Hospeda um formulário. Não fecha ao enviar: a página valida/salva e chama close().
     * @param {{ title: string, form: HTMLElement, size?: "sm"|"md"|"lg" }} options
     */
    function form({ title, form: formElement, size = "md" }) {
        return open({ title, content: formElement, icon: false, size, tone: "form" });
    }

    return Object.freeze({ show, confirm, form });
})();
