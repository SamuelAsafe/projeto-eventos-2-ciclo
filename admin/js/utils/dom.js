/*
 * Helpers de DOM reutilizáveis pelas páginas do painel.
 */
const dom = (function () {
    "use strict";

    const HTML_ESCAPES = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    /** Escapa texto antes de interpolar em HTML (evita XSS). */
    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
    }

    /** Elemento `.error` dentro do mesmo `.form-field` do input. */
    function errorElementFor(input) {
        return input.closest(".form-field")?.querySelector(".error") ?? null;
    }

    function showFieldError(input, message) {
        const errorEl = errorElementFor(input);
        input.setAttribute("aria-invalid", "true");
        if (!errorEl) return;
        if (message) errorEl.textContent = message;
        errorEl.classList.add("show");
    }

    function clearFieldError(input) {
        input.removeAttribute("aria-invalid");
        errorElementFor(input)?.classList.remove("show");
    }

    /** Desabilita botão e troca o texto enquanto uma ação assíncrona roda. */
    function setLoading(button, isLoading, loadingText = "Aguarde...") {
        if (isLoading) {
            button.dataset.originalText = button.textContent;
            button.textContent = loadingText;
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
            return;
        }
        button.textContent = button.dataset.originalText ?? button.textContent;
        button.disabled = false;
        button.removeAttribute("aria-busy");
    }

    /**
     * Mostra mensagem de feedback (sucesso/erro) num elemento `.feedback`.
     * @param {HTMLElement} element
     * @param {"success"|"error"} type
     * @param {string} message
     */
    function showFeedback(element, type, message) {
        element.textContent = message;
        element.classList.remove("feedback-success", "feedback-error");
        element.classList.add(`feedback-${type}`, "show");
    }

    function hideFeedback(element) {
        element.textContent = "";
        element.classList.remove("show", "feedback-success", "feedback-error");
    }

    return Object.freeze({
        escapeHtml,
        showFieldError,
        clearFieldError,
        setLoading,
        showFeedback,
        hideFeedback
    });
})();
