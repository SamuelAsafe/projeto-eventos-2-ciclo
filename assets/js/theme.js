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
        const input = button.querySelector("input");

        button.dataset.theme = activeTheme;
        button.setAttribute("aria-label", `Alternar para o tema ${LABELS[next]}`);
        button.title = `Tema atual: ${label}`;

        if (input) {
            input.checked = activeTheme !== "overworld";
            input.setAttribute("aria-label", `Tema atual: ${label}`);
        }
    }

    function toggle(event) {
        event.preventDefault();
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

    function injectToggle() {
        const nav = document.querySelector(".header-menu .navigation");
        if (!nav || nav.querySelector(".theme-toggle")) return;

        const item = document.createElement("li");
        item.className = "item item-theme";
        item.innerHTML = `
            <label class="theme-toggle theme-switch" title="Tema atual: Over World">
                <input type="checkbox" aria-label="Tema atual: Over World" />
                <span class="slider"></span>
                <img class="theme-icon theme-icon--off" alt="" aria-hidden="true"
                    src="../assets/images/grass.png" />
                <img class="theme-icon theme-icon--on" alt="" aria-hidden="true"
                    src="../assets/images/netherrack.png" />
                <img class="theme-icon theme-icon--end" alt="✦" aria-hidden="true"
                    src="../assets/images/endstone.png" />
            </label>`;

        const button = item.querySelector(".theme-toggle");
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

    document.addEventListener("navigationLoaded", injectToggle);
})();
