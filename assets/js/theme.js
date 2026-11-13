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
    const THEMES = ["overworld", "nether", "end"];
    const LABELS = {
        overworld: "Over World",
        nether: "Nether",
        end: "The End"
    };

    root.classList.add("js");

    function readSaved() {
        try {
            const value = window.localStorage.getItem(STORAGE_KEY);
            return THEMES.includes(value) ? value : null;
        } catch {
            return null;
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
        return THEMES.includes(root.dataset.theme) ? root.dataset.theme : "overworld";
    }

    function nextTheme(theme) {
        const index = THEMES.indexOf(theme);
        return THEMES[(index + 1) % THEMES.length];
    }

    function apply(value) {
        root.dataset.theme = value;
        document.querySelectorAll(".theme-toggle").forEach(updateButton);
    }

    function updateButton(button) {
        const activeTheme = current();
        const label = LABELS[activeTheme] || "Over World";
        const next = nextTheme(activeTheme);
        const labelNode = button.querySelector(".theme-toggle__label");

        if (labelNode) {
            labelNode.textContent = label;
        }

        button.dataset.theme = activeTheme;
        button.setAttribute("aria-label", `Alternar para o tema ${LABELS[next]}`);
        button.title = `Tema atual: ${label}`;
    }

    function toggle(event) {
        const next = nextTheme(current());
        save(next);

        if (!document.startViewTransition || reducedMotion.matches) {
            apply(next);
            return;
        }

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
        item.innerHTML = `<button type="button" class="theme-toggle"><span class="theme-toggle__icons">${ICONS}</span><span class="theme-toggle__label">Over World</span></button>`;

        const button = item.querySelector("button");
        button.addEventListener("click", toggle);
        updateButton(button);
        nav.appendChild(item);
    }

    apply(readSaved() ?? (systemDark.matches ? "nether" : "overworld"));

    systemDark.addEventListener("change", (event) => {
        if (!readSaved()) apply(event.matches ? "nether" : "overworld");
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectToggle);
    } else {
        injectToggle();
    }
})();
