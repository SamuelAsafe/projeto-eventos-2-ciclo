/*
 * Página inicial (index.html): busca, destaques (carrossel) e lista filtrável.
 * Depende de: catalogoService, eventoView, dom, text, motion.
 *
 * Os filtros ficam na URL (?q=&quando=&categoria=) para permitir compartilhar
 * e voltar com o mesmo resultado.
 */
(function homePage() {
    "use strict";

    const SEARCH_DEBOUNCE_MS = 150;
    const MAX_FEATURED = 8;
    const PERIODOS = ["proximos", "mes", "todos", "encerrados"];

    const elements = {
        form: document.getElementById("form-busca"),
        search: document.getElementById("busca-eventos"),
        period: document.getElementById("filtro-periodo"),
        categorySelect: document.getElementById("filtro-categoria"),
        chips: document.getElementById("lista-categorias"),
        grid: document.getElementById("lista-eventos"),
        counter: document.getElementById("contador-eventos"),
        featuredSection: document.getElementById("destaques"),
        carousel: document.getElementById("carrossel-destaques"),
        prev: document.getElementById("carrossel-anterior"),
        next: document.getElementById("carrossel-proximo")
    };

    let stopRealtime = null;

    const state = {
        eventos: [],
        categorias: [],
        filtros: { termo: "", periodo: "proximos", categoriaId: "" }
    };

    /* ---------- Filtros ---------- */

    const normalize = (value) => text.slugify(value).replace(/-/g, " ");

    function matchesPeriodo(evento, periodo) {
        const hoje = text.todayIso();
        switch (periodo) {
            case "proximos": return evento.data >= hoje;
            case "mes": return evento.data?.slice(0, 7) === hoje.slice(0, 7);
            case "encerrados": return evento.data < hoje;
            default: return true;
        }
    }

    function filtrar() {
        const { termo, periodo, categoriaId } = state.filtros;
        const termoNormalizado = normalize(termo);

        const resultado = state.eventos.filter((evento) =>
            (!termoNormalizado || normalize(evento.nome).includes(termoNormalizado)) &&
            (!categoriaId || String(evento.categoria?.id) === categoriaId) &&
            matchesPeriodo(evento, periodo)
        );

        // Encerrados: mais recentes primeiro. Demais: mais próximos primeiro.
        return periodo === "encerrados" ? resultado.reverse() : resultado;
    }

    function readFiltersFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const periodo = params.get("quando");

        state.filtros = {
            termo: (params.get("q") ?? "").slice(0, 80),
            periodo: PERIODOS.includes(periodo) ? periodo : "proximos",
            categoriaId: /^\d+$/.test(params.get("categoria") ?? "") ? params.get("categoria") : ""
        };
    }

    function writeFiltersToUrl() {
        const { termo, periodo, categoriaId } = state.filtros;
        const params = new URLSearchParams();
        if (termo) params.set("q", termo);
        if (periodo !== "proximos") params.set("quando", periodo);
        if (categoriaId) params.set("categoria", categoriaId);

        const query = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }

    function syncControls() {
        const { termo, periodo, categoriaId } = state.filtros;
        elements.search.value = termo;
        elements.period.value = periodo;
        elements.categorySelect.value = categoriaId;

        elements.chips.querySelectorAll("button[data-categoria]").forEach((chip) => {
            const active = chip.dataset.categoria === categoriaId;
            chip.classList.toggle("active", active);
            chip.setAttribute("aria-pressed", String(active));
        });
    }

    function setFiltro(changes) {
        state.filtros = { ...state.filtros, ...changes };
        syncControls();
        writeFiltersToUrl();
        renderGrid();
    }

    /* ---------- Render ---------- */

    function renderCategorias() {
        const options = state.categorias
            .map((categoria) => `<option value="${dom.escapeHtml(categoria.id)}">${dom.escapeHtml(categoria.nome)}</option>`)
            .join("");
        elements.categorySelect.innerHTML = `<option value="">Todas</option>${options}`;

        const chip = (id, nome, style = "") => `
            <li><button type="button" class="chip" data-categoria="${dom.escapeHtml(id)}" aria-pressed="false" ${style}>
                ${id ? '<span class="chip-dot" aria-hidden="true"></span>' : ""}${dom.escapeHtml(nome)}
            </button></li>`;

        elements.chips.innerHTML = chip("", "Todos") + state.categorias
            .map((categoria) => chip(String(categoria.id), categoria.nome, eventoView.accentStyle({ categoria })))
            .join("");
    }

    function renderGrid() {
        const eventos = filtrar();
        const total = eventos.length;
        elements.counter.textContent = `${total} ${total === 1 ? "evento encontrado" : "eventos encontrados"}`;

        if (total === 0) {
            const sugereTodos = state.filtros.periodo !== "todos";
            elements.grid.innerHTML = `
                <div class="empty-state" data-reveal>
                    <p class="empty-state-title">Nenhum evento encontrado</p>
                    <p>Tente outro termo, categoria ou período.</p>
                    ${sugereTodos ? '<button type="button" class="btn-ghost" data-action="ver-todos">Ver todas as datas</button>' : ""}
                </div>`;
        } else {
            elements.grid.innerHTML = eventos.map((evento) => eventoView.card(evento)).join("");
        }

        motion.observe(elements.grid);
    }

    function renderFeatured() {
        const proximos = state.eventos.filter((evento) => !text.isPast(evento.data));
        const destaques = proximos.filter((evento) => evento.destaque);
        // Sem destaques marcados → mostra os próximos eventos.
        const lista = (destaques.length ? destaques : proximos).slice(0, MAX_FEATURED);

        if (lista.length === 0) {
            elements.featuredSection.hidden = true;
            return;
        }

        elements.featuredSection.hidden = false;
        elements.carousel.innerHTML = lista.map((evento) => eventoView.card(evento, { variant: "featured" })).join("");
        motion.observe(elements.carousel);
        updateCarouselButtons();
    }

    function renderLoadError() {
        elements.featuredSection.hidden = true;
        elements.counter.textContent = "";
        elements.grid.innerHTML = `
            <div class="empty-state">
                <p class="empty-state-title">Não foi possível carregar os eventos</p>
                <p>Verifique sua conexão e tente novamente.</p>
                <button type="button" class="btn-ghost" data-action="recarregar">Tentar novamente</button>
            </div>`;
    }

    /* ---------- Carrossel ---------- */

    function updateCarouselButtons() {
        const { scrollLeft, scrollWidth, clientWidth } = elements.carousel;
        elements.prev.disabled = scrollLeft <= 4;
        elements.next.disabled = scrollLeft + clientWidth >= scrollWidth - 4;
    }

    function scrollCarousel(direction) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        elements.carousel.scrollBy({ left: direction * elements.carousel.clientWidth * 0.85, behavior: reduce ? "auto" : "smooth" });
    }

    /* ---------- Eventos de UI ---------- */

    function debounce(fn, wait) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    }

    function bindEvents() {
        elements.search.addEventListener("input", debounce(() => setFiltro({ termo: elements.search.value.trim() }), SEARCH_DEBOUNCE_MS));
        elements.period.addEventListener("change", () => setFiltro({ periodo: elements.period.value }));
        elements.categorySelect.addEventListener("change", () => setFiltro({ categoriaId: elements.categorySelect.value }));

        elements.chips.addEventListener("click", (event) => {
            const chip = event.target.closest("button[data-categoria]");
            if (chip) setFiltro({ categoriaId: chip.dataset.categoria });
        });

        elements.grid.addEventListener("click", (event) => {
            const action = event.target.closest("[data-action]")?.dataset.action;
            if (action === "ver-todos") setFiltro({ periodo: "todos" });
            if (action === "recarregar") load();
        });

        // "Buscar": aplica e leva até os resultados.
        elements.form.addEventListener("submit", (event) => {
            event.preventDefault();
            setFiltro({ termo: elements.search.value.trim() });
            document.getElementById("eventos").scrollIntoView({ block: "start" });
        });

        elements.prev.addEventListener("click", () => scrollCarousel(-1));
        elements.next.addEventListener("click", () => scrollCarousel(1));
        elements.carousel.addEventListener("scroll", debounce(updateCarouselButtons, 60), { passive: true });
        window.addEventListener("resize", debounce(updateCarouselButtons, 120));
    }

    /* ---------- Tempo real ---------- */

    // Vagas mudaram (alguém se inscreveu): atualiza as barras no lugar.
    // Se a situação mudou (ex.: esgotou), re-renderiza para atualizar selos e filtros.
    function handleEventoAtualizado(row) {
        const evento = state.eventos.find((item) => String(item.id) === String(row.id));
        if (!evento) return;

        const before = eventoView.situacao(evento).status;
        Object.assign(evento, row, { categoria: evento.categoria }); // payload não traz o join
        const after = eventoView.situacao(evento).status;

        if (before !== after) {
            renderFeatured();
            renderGrid();
            return;
        }

        document.querySelectorAll(`[data-evento-id="${CSS.escape(String(evento.id))}"]`)
            .forEach((card) => eventoView.updateCapacity(card, evento));
    }

    /* ---------- Inicialização ---------- */

    async function load() {
        elements.grid.innerHTML = eventoView.skeletonCards(6);
        elements.carousel.innerHTML = eventoView.skeletonCards(4, "featured");
        elements.counter.textContent = "Carregando eventos...";

        try {
            const [eventos, categorias] = await Promise.all([
                catalogoService.listEventos(),
                catalogoService.listCategorias()
            ]);

            state.eventos = eventos;
            state.categorias = categorias;

            renderCategorias();
            // Categoria da URL que não existe mais → ignora.
            if (!categorias.some((categoria) => String(categoria.id) === state.filtros.categoriaId)) {
                state.filtros.categoriaId = "";
            }

            syncControls();
            renderFeatured();
            renderGrid();

            stopRealtime?.();
            stopRealtime = catalogoService.onEventoAtualizado(handleEventoAtualizado);
        } catch (error) {
            console.error("[home] Falha ao carregar eventos:", error);
            renderLoadError();
        }
    }

    function init() {
        eventoView.hydrateIcons();
        readFiltersFromUrl();
        syncControls();
        bindEvents();
        load();
    }

    init();
})();
