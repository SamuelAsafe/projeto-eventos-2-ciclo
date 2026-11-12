/*
 * Tema claro/escuro.
 *
 * Carregar no <head> (sem defer) de TODAS as páginas: aplica o tema antes da
 * primeira pintura, evitando o "flash" do tema errado.
 *
 * - Preferência salva (localStorage) > preferência do sistema (prefers-color-scheme).
 * - Injeta o botão de alternância em `.header-menu .navigation`.
 * - Troca animada com View Transitions API (círculo a partir do botão), quando
 *   suportada e quando o usuário não pediu movimento reduzido.
 */
(function theme() {
    "use strict";

    const STORAGE_KEY = "eventos-fatec:tema";
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Marca que o JS está ativo (CSS só esconde elementos animáveis quando há JS).
    root.classList.add("js");

    function readSaved() {
        try {
            const value = window.localStorage.getItem(STORAGE_KEY);
            return value === "light" || value === "dark" ? value : null;
        } catch {
            return null; // modo privado / storage bloqueado
        }
    }

    function save(value) {
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch {
            // sem persistência: tema vale só para esta página
        }
    }

    function current() {
        return root.dataset.theme === "light" ? "light" : "dark";
    }

    function apply(value) {
        root.dataset.theme = value;
        document.querySelectorAll(".theme-toggle").forEach(updateButton);
    }

    function updateButton(button) {
        const isDark = current() === "dark";
        button.setAttribute("aria-pressed", String(isDark));
        button.setAttribute("aria-label", isDark ? "Ativar tema claro" : "Ativar tema escuro");
        button.title = isDark ? "Tema claro" : "Tema escuro";
    }

    function toggle(event) {
        const next = current() === "dark" ? "light" : "dark";
        save(next);

        if (!document.startViewTransition || reducedMotion.matches) {
            apply(next);
            return;
        }

        // Origem do círculo: centro do botão clicado.
        const rect = event.currentTarget.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

        const transition = document.startViewTransition(() => apply(next));
        transition.ready.then(() => {
            document.documentElement.animate(
                { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 550, easing: "cubic-bezier(.4, 0, .2, 1)", pseudoElement: "::view-transition-new(root)" }
            );
        });
    }

    const ICONS = `
        <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
        <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    `;

    function injectToggle() {
        const nav = document.querySelector(".header-menu .navigation");
        if (!nav || nav.querySelector(".theme-toggle")) return;

        const item = document.createElement("li");
        item.className = "item item-theme";
        item.innerHTML = `<button type="button" class="theme-toggle">${ICONS}</button>`;

        const button = item.querySelector("button");
        button.addEventListener("click", toggle);
        updateButton(button);
        nav.appendChild(item);
    }

    // Aplica imediatamente (antes do body).
    apply(readSaved() ?? (systemDark.matches ? "dark" : "light"));

    // Segue o sistema enquanto o usuário não escolheu manualmente.
    systemDark.addEventListener("change", (event) => {
        if (!readSaved()) apply(event.matches ? "dark" : "light");
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectToggle);
    } else {
        injectToggle();
    }
})();
