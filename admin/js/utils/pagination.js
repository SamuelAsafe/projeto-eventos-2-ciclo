/*
 * Controle de paginação reutilizável (Anterior / Página X de Y / Próxima).
 *
 * Uso:
 *   const pager = pagination.create(containerEl, { onChange: (page) => carregar(page) });
 *   pager.render({ page: 1, pageSize: 10, total: 42 });
 */
const pagination = (function () {
    "use strict";

    function totalPages(total, pageSize) {
        return Math.max(1, Math.ceil(total / pageSize));
    }

    /**
     * Converte página (1-based) em intervalo inclusivo para `.range(from, to)` do Supabase.
     * @returns {{ from: number, to: number }}
     */
    function toRange(page, pageSize) {
        const from = (page - 1) * pageSize;
        return { from, to: from + pageSize - 1 };
    }

    function create(container, { onChange }) {
        let current = { page: 1, pageSize: 10, total: 0 };

        // Delegação: um listener para os dois botões, mesmo após re-render.
        container.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-page]");
            if (!button || button.disabled) return;
            onChange(Number(button.dataset.page));
        });

        function render({ page, pageSize, total }) {
            current = { page, pageSize, total };
            const pages = totalPages(total, pageSize);

            if (total === 0) {
                container.innerHTML = "";
                return;
            }

            const first = (page - 1) * pageSize + 1;
            const last = Math.min(page * pageSize, total);

            container.innerHTML = `
                <nav class="pagination" aria-label="Paginação">
                    <button type="button" class="btn-sm btn-edit" data-page="${page - 1}"
                        ${page <= 1 ? "disabled" : ""} aria-label="Página anterior">Anterior</button>
                    <span class="pagination-info" aria-live="polite">
                        ${first}–${last} de ${total} · Página ${page} de ${pages}
                    </span>
                    <button type="button" class="btn-sm btn-edit" data-page="${page + 1}"
                        ${page >= pages ? "disabled" : ""} aria-label="Próxima página">Próxima</button>
                </nav>
            `;
        }

        return Object.freeze({
            render,
            get state() { return { ...current }; }
        });
    }

    return Object.freeze({ create, toRange, totalPages });
})();
