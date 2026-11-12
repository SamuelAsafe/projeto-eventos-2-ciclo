/*
 * Animações de entrada ao rolar a página.
 *
 * Uso no HTML/JS: adicionar `data-reveal` ao elemento. Opcional:
 *   data-reveal="up|fade|scale"  (padrão: up)
 * Elementos inseridos depois (ex.: cards vindos do Supabase) → motion.observe(container).
 *
 * Respeita prefers-reduced-motion: tudo aparece sem animação.
 */
const motion = (function () {
    "use strict";

    const STAGGER_MS = 70;
    const MAX_STAGGER_STEPS = 8;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const observer = "IntersectionObserver" in window
        ? new IntersectionObserver(onIntersect, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 })
        : null;

    function onIntersect(entries) {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    }

    function isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    /** Observa todos os `[data-reveal]` dentro de `scope` ainda não revelados. */
    function observe(scope = document) {
        const elements = [...scope.querySelectorAll("[data-reveal]:not(.is-visible)")];

        // Atraso escalonado entre irmãos do mesmo container (efeito "cascata").
        elements.forEach((element) => {
            const siblings = [...element.parentElement.children].filter((child) => child.hasAttribute("data-reveal"));
            const index = Math.min(siblings.indexOf(element), MAX_STAGGER_STEPS);
            element.style.setProperty("--reveal-delay", `${index * STAGGER_MS}ms`);

            if (!observer || reducedMotion.matches) {
                element.classList.add("is-visible");
            } else if (isInViewport(element)) {
                // Já visível: revela no próximo frame (garante a transição sem depender do observer).
                requestAnimationFrame(() => requestAnimationFrame(() => element.classList.add("is-visible")));
            } else {
                observer.observe(element);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => observe());
    } else {
        observe();
    }

    return Object.freeze({ observe });
})();
