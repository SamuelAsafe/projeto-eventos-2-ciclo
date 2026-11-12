/*
 * Página de inscritos do painel (admin/inscritos.html) — listar (paginado) e remover.
 * Depende de: inscricoesService, eventosService, dom, text, pagination.
 *
 * Estado refletido na URL (?evento=ID&pagina=N) para permitir voltar/compartilhar
 * e para o link "Ver inscritos" da página de eventos.
 */
(function inscritosPage() {
    "use strict";

    const PAGE_SIZE = 10;
    const TABLE_COLUMNS = 6;
    const RANGE_NOT_SATISFIABLE = "PGRST103"; // página além do total de registros

    const elements = {
        tableBody: document.getElementById("inscritos"),
        eventFilter: document.getElementById("filtro-evento"),
        pagination: document.getElementById("inscritos-paginacao"),
        feedback: document.getElementById("inscritos-feedback")
    };

    const state = {
        page: 1,
        eventoId: "",
        items: new Map() // id → inscrição da página atual
    };

    const pager = pagination.create(elements.pagination, {
        onChange: (page) => loadPage(page)
    });

    /* ---------- URL ---------- */

    function readStateFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const page = Number.parseInt(params.get("pagina"), 10);

        state.page = Number.isInteger(page) && page > 0 ? page : 1;
        state.eventoId = /^\d+$/.test(params.get("evento") ?? "") ? params.get("evento") : "";
    }

    function writeStateToUrl() {
        const params = new URLSearchParams();
        if (state.eventoId) params.set("evento", state.eventoId);
        if (state.page > 1) params.set("pagina", String(state.page));

        const query = params.toString();
        window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
    }

    /* ---------- Tabela ---------- */

    function renderMessageRow(message) {
        elements.tableBody.innerHTML = `
            <tr><td colspan="${TABLE_COLUMNS}">${dom.escapeHtml(message)}</td></tr>
        `;
    }

    function rowTemplate(inscricao) {
        const participante = inscricao.participante ?? {};

        return `
            <tr>
                <td>${dom.escapeHtml(participante.nome ?? "—")}</td>
                <td>${dom.escapeHtml(participante.email ?? "—")}</td>
                <td>${dom.escapeHtml(participante.whatsapp ?? "—")}</td>
                <td>${dom.escapeHtml(inscricao.evento?.nome ?? "—")}</td>
                <td>${dom.escapeHtml(text.formatDateTime(inscricao.created_at))}</td>
                <td class="actions">
                    <button type="button" class="btn-sm btn-delete" data-action="remove"
                        data-id="${dom.escapeHtml(inscricao.id)}">Remover</button>
                </td>
            </tr>
        `;
    }

    async function loadPage(page = state.page) {
        state.page = page;
        writeStateToUrl();
        renderMessageRow("Carregando inscrições...");

        try {
            const { items, total } = await inscricoesService.list({
                page: state.page,
                pageSize: PAGE_SIZE,
                eventoId: state.eventoId || null
            });

            // Página ficou vazia (ex.: removeu o último item dela) → volta para a última existente.
            const lastPage = pagination.totalPages(total, PAGE_SIZE);
            if (items.length === 0 && total > 0 && state.page > lastPage) {
                return loadPage(lastPage);
            }

            state.items = new Map(items.map((item) => [String(item.id), item]));
            pager.render({ page: state.page, pageSize: PAGE_SIZE, total });

            if (items.length === 0) {
                renderMessageRow(state.eventoId ? "Nenhuma inscrição neste evento." : "Nenhuma inscrição cadastrada.");
                return;
            }

            elements.tableBody.innerHTML = items.map(rowTemplate).join("");
        } catch (error) {
            if (error?.code === RANGE_NOT_SATISFIABLE && state.page > 1) {
                return loadPage(1);
            }
            console.error("[inscritos] Falha ao listar:", error);
            pager.render({ page: 1, pageSize: PAGE_SIZE, total: 0 });
            renderMessageRow("Não foi possível carregar as inscrições.");
        }
    }

    async function loadEventFilter() {
        try {
            const eventos = await eventosService.listOptions();
            const options = eventos
                .map((evento) => `<option value="${dom.escapeHtml(evento.id)}">${dom.escapeHtml(evento.nome)}</option>`)
                .join("");

            elements.eventFilter.innerHTML = `<option value="">Todos os eventos</option>${options}`;
            elements.eventFilter.value = state.eventoId;

            // Evento da URL não existe mais → volta para "Todos".
            if (elements.eventFilter.value !== state.eventoId) {
                state.eventoId = "";
                elements.eventFilter.value = "";
            }
        } catch (error) {
            console.error("[inscritos] Falha ao listar eventos:", error);
        }
    }

    /* ---------- Ações ---------- */

    function handleFilterChange() {
        state.eventoId = elements.eventFilter.value;
        dom.hideFeedback(elements.feedback);
        loadPage(1);
    }

    async function handleRemove(button, inscricao) {
        const nome = inscricao.participante?.nome ?? "este participante";
        const evento = inscricao.evento?.nome ?? "o evento";
        const message = `Remover a inscrição de "${nome}" em "${evento}"? A vaga volta a ficar disponível.`;
        if (!window.confirm(message)) return;

        dom.setLoading(button, true, "Removendo...");

        try {
            await inscricoesService.remove(inscricao.id);
            dom.showFeedback(elements.feedback, "success", "Inscrição removida.");
            await loadPage();
        } catch (error) {
            console.error("[inscritos] Falha ao remover:", error);
            dom.showFeedback(elements.feedback, "error", "Não foi possível remover a inscrição.");
            dom.setLoading(button, false);
        }
    }

    function handleTableClick(event) {
        const button = event.target.closest("button[data-action='remove']");
        if (!button || button.disabled) return;

        const inscricao = state.items.get(button.dataset.id);
        if (inscricao) handleRemove(button, inscricao);
    }

    async function init() {
        readStateFromUrl();
        elements.eventFilter.addEventListener("change", handleFilterChange);
        elements.tableBody.addEventListener("click", handleTableClick);

        await loadEventFilter();
        loadPage();
    }

    init();
})();
